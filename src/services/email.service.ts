import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import sgMail from '@sendgrid/mail';
import { config } from '../config';
import logger from '../utils/logger';
import { 
  getOtpTemplate, 
  getResetPasswordTemplate, 
  getAdminNotificationTemplate,
  getContactConfirmationTemplate 
} from './template.service';

/** ──────────────────────── Initialization ──────────────────────── */

if (config.email.sendgridApiKey) {
  sgMail.setApiKey(config.email.sendgridApiKey);
  logger.info('🚀 SendGrid Engine Initialized');
} else {
  logger.warn('⚠️ SendGrid API Key missing — using SMTP Primary');
}

/** ──────────────────────── Nodemailer Transport ──────────────────────── */

function createTransport(): Mail {
  const { host, port, secure, auth } = config.email.smtp;
  const isGmail = host.toLowerCase().includes('gmail') || host.toLowerCase().includes('google');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: auth.user, pass: auth.pass },
    } as SMTPTransport.Options);
  }

  return nodemailer.createTransport({
    host, port, secure, auth,
    pool: true, maxConnections: 5,
    tls: { rejectUnauthorized: config.env === 'production' }
  } as SMTPTransport.Options);
}

const transport = createTransport();

/** ──────────────────────── Core Delivery Logic ──────────────────────── */

export const sendEmail = async (to: string, subject: string, text: string, html?: string): Promise<void> => {
  const isDev = config.env !== 'production';
  if (!config.email.enableNotifications && !isDev) {
    logger.warn(`🚫 Email Delivery Suppressed for ${to}`);
    return;
  }

  const from = config.email.from || "Hodaltech Security <hodalmuheto1@gmail.com>";

  // Priority 1: SendGrid
  if (config.email.sendgridApiKey) {
    try {
      await sgMail.send({ to, from, subject, text, html: html || text });
      logger.info(`📧 SendGrid: Transmitted to ${to}`);
      return;
    } catch (err: any) {
      const details = err.response?.body ? JSON.stringify(err.response.body) : 'No extra details';
      logger.error(`❌ SendGrid Failed for ${to}: ${err.message} | Payload: ${details}`);
      logger.info('🔄 Switching to SMTP Failover...');
    }
  }

  // Priority 2: SMTP / Nodemailer
  try {
    await sendWithRetry({ from, to, subject, text, html });
  } catch (err: any) {
    logger.error(`🚨 FATAL: All delivery systems exhausted for ${to}. Error: ${err.message}`);
    throw err;
  }
};

const sendWithRetry = async (options: Mail.Options, maxAttempts = 3): Promise<void> => {
  let lastError: Error | undefined;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await transport.sendMail(options);
      logger.info(`📧 SMTP: Success on attempt ${i} for ${options.to}`);
      return;
    } catch (err: any) {
      lastError = err;
      logger.error(`⚠️ SMTP Attempt ${i} Failed: ${err.message}`);
      if (i < maxAttempts) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i - 1)));
    }
  }
  throw lastError;
};

export const sendEmailAsync = (to: string, subject: string, text: string, html?: string): void => {
  sendEmail(to, subject, text, html).catch(err => logger.error(`Async Email Failed: ${err.message}`));
};

/** ──────────────────────── Functional Emails ──────────────────────── */

export const sendOtpEmail = async (to: string, name: string, otp: string) => {
  const html = getOtpTemplate(otp, name);
  return sendEmail(to, '🔐 HodalTech: Verification Code', `Your OTP is ${otp}`, html);
};

export const sendPasswordResetOtpEmail = async (to: string, otp: string) => {
  const html = getResetPasswordTemplate(otp, 'Security Protocol');
  return sendEmail(to, '🔑 HodalTech: Password Reset', `Your Reset Code is ${otp}`, html);
};

export const sendAdminNotification = async (userEmail: string, userName: string) => {
  const subject = '🚀 INTEL: New User Registration';
  const details = `<strong>Entity Name:</strong> ${userName}<br><strong>Entity Email:</strong> ${userEmail}`;
  const html = getAdminNotificationTemplate(subject, details);
  const adminList = config.email.adminEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
  
  if (adminList.length > 0) {
    return Promise.all(adminList.map((email: string) => sendEmail(email, subject, `User Registered: ${userName}`, html)));
  }
};

export const sendContactNotification = async (contactData: any) => {
  const { name, email, subject, message } = contactData;
  const userHtml = getContactConfirmationTemplate(name);
  sendEmailAsync(email, `HodalTech: Message Received`, `We received your message!`, userHtml);

  const adminSubject = `💬 Contact Inquiry: ${subject}`;
  const adminDetails = `<strong>From:</strong> ${name} (${email})<br><strong>Content:</strong> ${message}`;
  const adminHtml = getAdminNotificationTemplate(adminSubject, adminDetails);
  const adminList = config.email.adminEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
  
  if (adminList.length > 0) {
    adminList.forEach((admin: string) => sendEmailAsync(admin, adminSubject, `Message from ${name}`, adminHtml));
  }
};

export const logOtpForDev = (to: string, otp: string, purpose: string): void => {
  if (config.env !== 'production') {
    logger.info(`\n[DEV OTP] To: ${to} | Code: ${otp} | Purpose: ${purpose}`);
  }
};

// Legacy stubs for compatibility
export const sendRegistrationEmail = (to: string, name: string) => sendEmailAsync(to, 'Welcome to HodalTech', `Hi ${name}!`, getOtpTemplate('WELCOME', name));
export const sendMessageNotificationEmail = (to: string, senderName: string, preview: string, url: string) => sendEmailAsync(to, `New Message from ${senderName}`, preview);
export const sendMeetingReminderEmail = (to: string, title: string, time: string, url: string) => sendEmailAsync(to, `Meeting Reminder: ${title}`, `At ${time}`);
export const sendResetPasswordEmail = (to: string, token: string) => sendEmailAsync(to, 'Reset Your Password', `Use token: ${token}`);
