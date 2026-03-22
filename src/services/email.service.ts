import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import sgMail from '@sendgrid/mail';
import { config } from '../config';
import logger from '../utils/logger';

// ─────────────────────── SendGrid Initialization ───────────────────────
if (config.email.sendgridApiKey) {
  sgMail.setApiKey(config.email.sendgridApiKey);
  logger.info('✅ SendGrid API active and initialized');
}

// ─────────────────────── Nodemailer Transport (Fallback) ───────────────────────
// Gmail: use the `service` key alone (it sets host/port internally).
// Custom SMTP: omit `service`, set host/port explicitly.

function createTransport(): Mail {
  const { host, port, secure, auth } = config.email.smtp;

  const isGmail =
    host.toLowerCase().includes('gmail') ||
    host.toLowerCase().includes('google');

  if (isGmail) {
    // Gmail transport
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: auth.user,
        pass: auth.pass, // Must be a Gmail App Password, NOT your login password
      },
    } as SMTPTransport.Options);
  }

  // Generic SMTP
  const options = {
    host,
    port,
    secure,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    tls: {
      rejectUnauthorized: config.env === 'production',
    },
  } as SMTPTransport.Options;
  return nodemailer.createTransport(options);
}

let transport = createTransport();

// ─────────────────────── Connection Verification ───────────────────────
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('✅ Email transport connected and ready'))
    .catch((err: Error) => {
      logger.warn(
        '⚠️  Email transport connection failed — emails will be logged in dev mode. ' +
          'Check SMTP credentials in .env. Error: ' +
          err.message
      );
    });
}

// ─────────────────────── Core Send with Priority ───────────────────────

/**
 * Send email using SendGrid (Priority) or Nodemailer (Fallback).
 * Includes automatic retry for both.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> => {
  const isDev = config.env !== 'production';

  if (!config.email.enableNotifications && !isDev) {
    logger.warn(`[Email skip-check] Delivery is currently DISABLED on this instance based on ENABLE_EMAIL_NOTIFICATIONS=false.`);
    return;
  }

  // ── Case 1: SendGrid (if available) ──
  if (config.email.sendgridApiKey) {
    try {
      await sgMail.send({
        to,
        from: config.email.from || "Hodaltech <hodalmuheto1@gmail.com>",
        subject,
        text,
        html: html || text,
      });
      logger.info(`📧 SendGrid email sent → ${to} | "${subject}"`);
      return;
    } catch (err: any) {
      // Detailed logging for SendGrid — they often put reasons in response.body
      const details = err.response?.body ? JSON.stringify(err.response.body, null, 2) : 'No extra details';
      logger.error(`❌ SendGrid failed for ${to}. Error: ${err.message} | Details: ${details}`);
      logger.info('🔄 Attempting fallback delivery via SMTP...');
      // Fall through to SMTP if SendGrid fails
    }
  }

  // ── Case 2: Nodemailer / SMTP Fallback ──
  const msg: Mail.Options = {
    from: config.email.from || "Hodaltech <hodalmuheto1@gmail.com>",
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  };

  try {
    await sendWithRetry(msg);
  } catch (err: any) {
    logger.error(`🚨 CRITICAL: All email delivery methods failed for ${to}. Finally giving up.`);
    throw err; // Re-throw to be caught by the service caller
  }
};

const sendWithRetry = async (
  options: Mail.Options,
  maxAttempts = 3
): Promise<void> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transport.sendMail(options);
      logger.info(`📧 SMTP Fallback delivery SUCCESS → ${options.to} (attempt ${attempt})`);
      return;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error(`⚠️ SMTP fallback attempt ${attempt} failed for ${options.to}: ${err.message}`);
      
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Email delivery system exhaustion. Last attempt error: ${lastError?.message}`);
};

// ─────────────────────── OTP Dev Fallback ───────────────────────

/**
 * Log the OTP plainly to the server console in non-production.
 */
export const logOtpForDev = (to: string, otp: string, purpose: string): void => {
  if (config.env !== 'production') {
    logger.info(
      `\n${'═'.repeat(60)}\n` +
        `🔑  DEV OTP CODE\n` +
        `   Email   : ${to}\n` +
        `   Purpose : ${purpose}\n` +
        `   OTP     : ${otp}\n` +
        `   Expires : 5 minutes\n` +
        `${'═'.repeat(60)}`
    );
  }
};

// ─────────────────────── OTP Email Functions ───────────────────────

/**
 * Send OTP verification email during account registration.
 */
export const sendOtpEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<void> => {
  logOtpForDev(to, otp, 'EMAIL_VERIFICATION');

  const subject = 'Verify Your Email — Hodaltech';
  const text = `Your email verification code is: ${otp}`;

  const html = buildHodalEmailTemplate({
    title: 'Verify Your Email',
    subtitle: `Hi ${name}, use the secure code below to complete your registration:`,
    content: `<div style="text-align:center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #993300; background: #fef2f2; padding: 10px 20px; border: 2px dashed #993300; border-radius: 10px;">${otp}</span></div>`,
    buttonLabel: 'Verify Account',
    buttonUrl: `${config.frontendUrl}/login`,
  });

  await sendEmail(to, subject, text, html);
};

/**
 * Send OTP for password reset.
 */
export const sendPasswordResetOtpEmail = async (
  to: string,
  otp: string
): Promise<void> => {
  logOtpForDev(to, otp, 'PASSWORD_RESET');

  const subject = 'Password Reset Code — Hodaltech';
  const text = `Your password reset code is: ${otp}`;

  const html = buildHodalEmailTemplate({
    title: 'Reset Your Password',
    subtitle: 'Someone requested a password reset for your account. Use the code below:',
    content: `<div style="text-align:center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #993300; background: #fffbeb; padding: 10px 20px; border: 2px dashed #993300; border-radius: 10px;">${otp}</span></div>`,
    buttonLabel: 'Reset Password',
    buttonUrl: `${config.frontendUrl}/forgot-password`,
  });

  await sendEmail(to, subject, text, html);
};

// ─────────────────────── Other Email Functions ───────────────────────

/**
 * Send welcome email to new users.
 */
export const sendRegistrationEmail = async (to: string, name: string): Promise<void> => {
  const subject = 'Welcome to Hodaltech! 🎉';
  const text = `Hi ${name}, welcome to Hodaltech! We are thrilled to have you.`;

  const html = buildHodalEmailTemplate({
    title: 'Welcome to Hodaltech!',
    subtitle: `Hi ${name}, we couldn't be more thrilled to have you join our specialized tech community.`,
    content: 'Our mission is to empower innovation through code. Explore your dashboard to start managing your projects or discover new opportunities.',
    buttonLabel: 'Go to Dashboard',
    buttonUrl: `${config.frontendUrl}/dashboard`,
  });

  await sendEmailAsync(to, subject, text, html);
};

/**
 * Notify admin of a new user registration.
 */
export const sendAdminNotification = async (
  newUserEmail: string,
  newUserName: string
): Promise<void> => {
  const adminEmails = config.email.adminEmails;
  if (!adminEmails) return;

  const subject = 'Admin Notification: New User Registered';
  const text = `New user joined: ${newUserName} (${newUserEmail})`;

  const html = buildHodalEmailTemplate({
    title: 'New User Onboarding',
    subtitle: 'A new user has just successfully registered on the platform.',
    content: `<div style="background:#f8fafc; padding:20px; border-radius:12px;"><strong>Name:</strong> ${newUserName}<br><strong>Email:</strong> ${newUserEmail}</div>`,
    buttonLabel: 'Review User Account',
    buttonUrl: `${config.frontendUrl}/admin/users`,
  });

  sendEmailAsync(adminEmails, subject, text, html);
};

/**
 * Notify about a new message.
 */
export const sendMessageNotificationEmail = async (
  to: string,
  senderName: string,
  messagePreview: string,
  conversationUrl: string
): Promise<void> => {
  const subject = `New Message from ${senderName}`;
  const text = `You have a new message from ${senderName}: "${messagePreview}"`;

  const html = buildHodalEmailTemplate({
    title: 'New Message Received',
    subtitle: `<strong>${senderName}</strong> sent you a message:`,
    content: `<div style="background:#f1f5f9; padding:20px; border-radius:12px; font-style: italic;">"${messagePreview}"</div>`,
    buttonLabel: 'Reply in Chat',
    buttonUrl: conversationUrl,
  });

  await sendEmailAsync(to, subject, text, html);
};

/**
 * Reminder for a meeting.
 */
export const sendMeetingReminderEmail = async (
  to: string,
  meetingTitle: string,
  meetingTime: string,
  joinLink: string
): Promise<void> => {
  const subject = `Meeting Reminder: ${meetingTitle}`;
  const text = `Reminder for your meeting "${meetingTitle}" at ${meetingTime}.`;

  const html = buildHodalEmailTemplate({
    title: 'Upcoming Meeting Reminder',
    subtitle: `${meetingTitle}`,
    content: `<p style="text-align:center;"><strong>Time:</strong> ${meetingTime}</p>`,
    buttonLabel: 'Join Meeting Now',
    buttonUrl: joinLink,
  });

  await sendEmailAsync(to, subject, text, html);
};

/**
 * Legacy reset email.
 */
export const sendResetPasswordEmail = async (to: string, resetToken: string): Promise<void> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password — Hodaltech';
  const text = `Reset link (valid 30 min):\n${resetUrl}`;

  const html = buildHodalEmailTemplate({
    title: 'Password Reset Request',
    subtitle: 'This secure link will expire in 30 minutes.',
    content: '<p style="text-align:center;">If you didn\'t request this, you can safely ignore this email.</p>',
    buttonLabel: 'Reset My Password',
    buttonUrl: resetUrl,
  });

  await sendEmailAsync(to, subject, text, html);
};

// ─────────────────────── Email Template Builder ───────────────────────

interface TemplateOptions {
  title: string;
  subtitle: string;
  content: string;
  buttonLabel: string;
  buttonUrl: string;
}

/**
 * Builds the responsive HTML template based on the provided SendGrid boilerplate.
 */
const buildHodalEmailTemplate = (options: TemplateOptions): string => {
  const { title, subtitle, content, buttonLabel, buttonUrl } = options;

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
      <meta http-equiv="X-UA-Compatible" content="IE=Edge">
      <style type="text/css">
        body, p, div { font-family: verdana,geneva,sans-serif; font-size: 16px; color: #516775; }
        body { margin: 0; padding: 0; background-color: #F9F5F2; }
        p { margin: 0; padding: 0; }
        table.wrapper { width:100% !important; table-layout: fixed; -webkit-font-smoothing: antialiased; }
        img.max-width { max-width: 100% !important; height: auto !important; }
        .button-css { background-color:#993300; border-radius:6px; color:#ffffff; display:inline-block; font-family:verdana,geneva,sans-serif; font-size:16px; padding:12px 20px; text-align:center; text-decoration:none; }
        @media screen and (max-width:480px) {
          .column { display: block !important; width: 100% !important; }
        }
      </style>
    </head>
    <body>
      <center class="wrapper" style="background-color:#F9F5F2; padding: 20px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; max-width:600px; background-color:#ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin: 0 auto;">
          <!-- Header Image -->
          <tr>
            <td align="center" style="padding: 30px 0;">
              <img src="https://res.cloudinary.com/dqd87p5cz/image/upload/v1742674937/HodalTechLogo_xrm8ah.png" alt="HodalTech" width="180" style="display:block;">
            </td>
          </tr>
          <!-- Hero Section -->
          <tr>
            <td align="center" style="padding: 0 40px;">
              <h1 style="font-family: georgia, serif; color: #516775; font-size: 28px; margin-bottom: 10px;">${title}</h1>
              <p style="color: #64748b; line-height: 1.6;">${subtitle}</p>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px; color: #516775; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 40px;">
              <a href="${buttonUrl}" class="button-css">${buttonLabel}</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #F9F5F2; padding: 30px 40px; color: #94a3b8; font-size: 12px;">
              <div style="margin-bottom: 15px;">
                <a href="https://facebook.com" style="margin: 0 10px;"><img src="https://mc.sendgrid.com/assets/social/white/facebook.png" width="24" height="24"></a>
                <a href="https://twitter.com" style="margin: 0 10px;"><img src="https://mc.sendgrid.com/assets/social/white/twitter.png" width="24" height="24"></a>
                <a href="https://instagram.com" style="margin: 0 10px;"><img src="https://mc.sendgrid.com/assets/social/white/instagram.png" width="24" height="24"></a>
              </div>
              <p>&copy; ${new Date().getFullYear()} HodalTech. All rights reserved.</p>
              <p style="margin-top: 5px;">If you didn't expect this email, you can <a href="{{{unsubscribe}}}" style="color: #993300; text-decoration: underline;">unsubscribe</a>.</p>
            </td>
          </tr>
        </table>
      </center>
    </body>
</html>
  `;
};

/**
 * Wrapper for fire-and-forget sending.
 */
export const sendEmailAsync = (
  to: string,
  subject: string,
  text: string,
  html?: string
): void => {
  sendEmail(to, subject, text, html).catch((err) => {
    logger.error('Async email delivery failed', { to, subject, error: err.message });
  });
};
