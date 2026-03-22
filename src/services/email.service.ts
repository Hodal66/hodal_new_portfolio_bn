import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from '../config';
import logger from '../utils/logger';

// ─────────────────────── Transport Factory ───────────────────────
// IMPORTANT: Do NOT combine `service` with explicit `host`/`port` — they conflict.
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

  // Generic SMTP (SendGrid, Mailgun, custom)
  // Cast to any: pool/maxConnections/maxMessages are valid nodemailer options
  // but are missing from the SMTPTransport.Options TypeScript definition.
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

// ─────────────────────── Core Send with Retry ───────────────────────

/**
 * Send email with automatic retry (exponential back-off).
 * Retries up to `maxAttempts` times with increasing delays.
 */
const sendWithRetry = async (
  options: Mail.Options,
  maxAttempts = 3
): Promise<void> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await transport.sendMail(options);
      logger.info(
        `📧 Email sent → ${options.to} | "${options.subject}" (attempt ${attempt})`
      );
      return;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `Email attempt ${attempt}/${maxAttempts} failed → ${options.to}: ${lastError.message}`
      );

      if (attempt < maxAttempts) {
        // Exponential back-off: 1s → 2s → 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));

        // Recreate transport on connection-level errors
        const connErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'];
        const errCode = (err as NodeJS.ErrnoException).code ?? '';
        if (connErrors.some((c) => errCode === c || lastError!.message.includes(c))) {
          logger.info('Recreating email transport after connection error…');
          transport = createTransport();
        }
      }
    }
  }

  throw lastError ?? new Error('Email send failed after all retry attempts');
};

// ─────────────────────── OTP Dev Fallback ───────────────────────

/**
 * Log the OTP plainly to the server console in non-production.
 * Lets developers test the OTP flow locally without needing real email delivery.
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

// ─────────────────────── Public sendEmail ───────────────────────

/**
 * Core email sender.
 * - Production: only sends if ENABLE_EMAIL_NOTIFICATIONS=true
 * - Development: always attempts to send; OTP is also logged to console
 */
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> => {
  const isDev = config.env !== 'production';

  if (!config.email.enableNotifications && !isDev) {
    logger.debug(`[Email skipped — notifications disabled] To: ${to}`);
    return;
  }

  const msg: Mail.Options = {
    from: config.email.from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    headers: {
      'X-Mailer': 'Hodaltech Mailer 2.0',
    },
  };

  await sendWithRetry(msg);
};

/**
 * Fire-and-forget email wrapper — never blocks the caller.
 * Errors are logged but do not propagate.
 */
export const sendEmailAsync = (
  to: string,
  subject: string,
  text: string,
  html?: string
): void => {
  sendEmail(to, subject, text, html).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`❌ Async email failed → ${to}: ${message}`, { subject });
  });
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
  const text =
    `Hi ${name},\n\n` +
    `Your email verification code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not create an account, please ignore this email.\n\n` +
    `Best regards,\nHodaltech Team`;

  const html = buildOtpHtml({
    name,
    otp,
    title: 'Verify Your Email',
    subtitle: `Hi <strong>${name}</strong>, use the secure code below to complete your registration:`,
    accentColor: '#3b82f6',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    otpColor: '#3b82f6',
    purpose: 'Email Verification',
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
  const text =
    `Your password reset code is: ${otp}\n\n` +
    `This code expires in 5 minutes.\n\n` +
    `If you did not request this, your password will remain unchanged.\n\n` +
    `Never share this code with anyone.\n\n` +
    `Hodaltech Team`;

  const html = buildOtpHtml({
    name: null,
    otp,
    title: 'Reset Your Password',
    subtitle:
      'Someone requested a password reset for your Hodaltech account. Use the code below to continue:',
    accentColor: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    otpColor: '#92400e',
    purpose: 'Password Reset',
  });

  await sendEmail(to, subject, text, html);
};

// ─────────────────────── Other Email Functions ───────────────────────

export const sendRegistrationEmail = async (to: string, name: string): Promise<void> => {
  const subject = 'Welcome to Hodaltech! 🎉';
  const text = `Hi ${name},\n\nThank you for joining us. Your account is now active.\n\nBest regards,\nHodaltech Team`;
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #f1f5f9;">
      <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:2px;font-weight:800;">HODALTECH</h1>
      </div>
      <div style="padding:40px 32px;text-align:center;">
        <h2 style="color:#1e293b;margin:0 0 16px 0;">Welcome aboard, ${name}! 🎉</h2>
        <p style="color:#64748b;font-size:16px;line-height:1.6;">Your email is verified and your account is fully active.</p>
        <a href="${config.frontendUrl}" style="display:inline-block;margin:24px 0;background:#3b82f6;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">Go to Dashboard</a>
      </div>
      <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #f1f5f9;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; 2026 Hodaltech. All rights reserved.</p>
      </div>
    </div>
  `;
  sendEmailAsync(to, subject, text, html);
};

export const sendAdminNotification = async (
  newUserEmail: string,
  newUserName: string
): Promise<void> => {
  const adminEmails = config.email.adminEmails;
  if (!adminEmails) return;
  const subject = 'New User Registration Alert';
  const text = `Admin,\n\nNew user registered.\nName: ${newUserName}\nEmail: ${newUserEmail}\n\nSystem Bot`;
  sendEmailAsync(adminEmails, subject, text);
};

export const sendMessageNotificationEmail = async (
  to: string,
  senderName: string,
  messagePreview: string,
  conversationUrl: string
): Promise<void> => {
  const subject = `New Message from ${senderName} — Hodaltech`;
  const text = `Hi,\n\nNew message from ${senderName}:\n\n"${messagePreview}"\n\nView: ${conversationUrl}\n\nHodaltech Team`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;">
      <h2 style="color:#3b82f6;text-align:center;">New Message</h2>
      <p style="text-align:center;color:#374151;">New message from <strong>${senderName}</strong>:</p>
      <div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e5e7eb;margin:24px 0;font-style:italic;color:#4b5563;">"${messagePreview}"</div>
      <div style="text-align:center;">
        <a href="${conversationUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Conversation</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">You are receiving this because someone sent you a message on Hodaltech.</p>
    </div>
  `;
  sendEmailAsync(to, subject, text, html);
};

export const sendMeetingReminderEmail = async (
  to: string,
  meetingTitle: string,
  meetingTime: string,
  joinLink: string
): Promise<void> => {
  const subject = `Meeting Reminder: ${meetingTitle} — Hodaltech`;
  const text = `Reminder: "${meetingTitle}" starts at ${meetingTime}.\n\nJoin: ${joinLink}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb;">
      <h2 style="color:#3b82f6;text-align:center;">⏰ Meeting Reminder</h2>
      <div style="background:#fff;padding:20px;border-radius:12px;margin:24px 0;text-align:center;">
        <h3 style="margin:0 0 10px 0;color:#1e293b;">${meetingTitle}</h3>
        <p style="margin:0;color:#6b7280;font-size:14px;"><strong>Time:</strong> ${meetingTime}</p>
      </div>
      <div style="text-align:center;">
        <a href="${joinLink}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">Join Meeting</a>
      </div>
    </div>
  `;
  sendEmailAsync(to, subject, text, html);
};

/** Legacy link-based reset (backward compatibility) */
export const sendResetPasswordEmail = async (to: string, resetToken: string): Promise<void> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password — Hodaltech';
  const text = `Reset link (valid 30 min):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#3b82f6;">Reset Your Password</h2>
      <p>This link expires in <strong>30 minutes</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a>
      <p style="color:#6b7280;font-size:14px;">If you didn't request this, ignore this email.</p>
    </div>
  `;
  sendEmailAsync(to, subject, text, html);
};

// ─────────────────────── HTML Template Builder ───────────────────────

interface OtpHtmlOptions {
  name: string | null;
  otp: string;
  title: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  otpColor: string;
  purpose: string;
}

function buildOtpHtml(opts: OtpHtmlOptions): string {
  const { name: _name, otp, title, subtitle, accentColor, bgColor, borderColor, otpColor } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,${accentColor},#6366f1);padding:36px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:3px;font-weight:900;text-transform:uppercase;">HODALTECH</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0 0;font-size:13px;letter-spacing:1px;">Secure Authentication</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 40px;">
              <h2 style="color:#1e293b;margin:0 0 16px 0;font-size:24px;text-align:center;font-weight:700;">${title}</h2>
              <p style="text-align:center;color:#64748b;font-size:16px;line-height:1.7;margin:0 0 36px 0;">${subtitle}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 28px 0;">
                    <div style="display:inline-block;background:${bgColor};border:2px dashed ${borderColor};padding:24px 48px;border-radius:20px;">
                      <span style="color:${otpColor};font-size:42px;font-weight:900;letter-spacing:14px;font-family:'Courier New',Courier,monospace;display:block;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 32px 0;">
                    <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;padding:10px 20px;border-radius:50px;">
                      <span style="color:#dc2626;font-size:14px;font-weight:700;">⏱ This code expires in 5 minutes</span>
                    </div>
                  </td>
                </tr>
              </table>
              <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;border-left:4px solid ${accentColor};">
                <p style="color:#475569;font-size:14px;margin:0 0 8px 0;font-weight:600;">How to use this code:</p>
                <ol style="color:#64748b;font-size:14px;margin:0;padding-left:20px;line-height:1.8;">
                  <li>Return to the Hodaltech application</li>
                  <li>Enter the 6-digit code shown above</li>
                  <li>Complete your ${opts.purpose.toLowerCase()}</li>
                </ol>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#fffbeb;padding:20px 40px;border-top:1px solid #fde68a;">
              <p style="color:#92400e;font-size:13px;margin:0;text-align:center;">
                🔒 <strong>Security Notice:</strong> If you did not request this code, ignore this email. Your account is secure. Never share this code.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #f1f5f9;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; 2026 Hodaltech. All rights reserved.</p>
              <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0 0;">This is an automated email. Please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
