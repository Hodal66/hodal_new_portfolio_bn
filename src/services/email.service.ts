import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';

const transport = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.auth.user,
    pass: config.email.smtp.auth.pass,
  },
});

/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() =>
      logger.warn('Unable to connect to email server. Make sure SMTP options are configured in .env')
    );
}

/**
 * Send an email
 */
export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  if (!config.email.enableNotifications) {
    logger.debug(`[Email skipped - notifications disabled] To: ${to}, Subject: ${subject}`);
    return;
  }
  const msg = {
    from: config.email.from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  };
  await transport.sendMail(msg);
  logger.info(`Email sent to ${to}: ${subject}`);
};

/**
 * Send registration welcome email
 */
export const sendRegistrationEmail = async (to: string, name: string) => {
  const subject = 'Welcome to Hodaltech!';
  const text = `Hi ${name},\n\nThank you for registering on our website. We are thrilled to have you here!\n\nBest regards,\nHodaltech Team`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#3b82f6;">Welcome to Hodaltech, ${name}! 🎉</h2>
      <p>Thank you for joining us. Your account is now active.</p>
      <p>Best regards,<br/><strong>Hodaltech Team</strong></p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};

/**
 * Notify admin of new user registration
 */
export const sendAdminNotification = async (newUserEmail: string, newUserName: string) => {
  const adminEmails = config.email.adminEmails;
  if (!adminEmails) return;
  const subject = 'New User Registration Alert';
  const text = `Admin,\n\nA new user has just registered.\nName: ${newUserName}\nEmail: ${newUserEmail}\n\nSystem Bot`;
  await sendEmail(adminEmails, subject, text);
};

/**
 * Send OTP verification email for registration
 */
export const sendOtpEmail = async (to: string, name: string, otp: string) => {
  const subject = 'Verify Your Email — Hodaltech';
  const text = `Hi ${name},\n\nYour verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not create an account, please ignore this email.\n\nBest regards,\nHodaltech Team`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;">
      <h2 style="color:#3b82f6;text-align:center;">Verify Your Email</h2>
      <p style="text-align:center;color:#374151;">Hi <strong>${name}</strong>, use the code below to verify your email address:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff;font-size:32px;font-weight:bold;letter-spacing:12px;padding:16px 32px;border-radius:12px;">${otp}</span>
      </div>
      <p style="text-align:center;color:#6b7280;font-size:14px;">This code expires in <strong>5 minutes</strong>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">If you did not create an account, you can safely ignore this email.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};

/**
 * Send OTP email for password reset
 */
export const sendPasswordResetOtpEmail = async (to: string, otp: string) => {
  const subject = 'Password Reset Code — Hodaltech';
  const text = `Your password reset code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;">
      <h2 style="color:#3b82f6;text-align:center;">Reset Your Password</h2>
      <p style="text-align:center;color:#374151;">Enter the code below to reset your password:</p>
      <div style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff;font-size:32px;font-weight:bold;letter-spacing:12px;padding:16px 32px;border-radius:12px;">${otp}</span>
      </div>
      <p style="text-align:center;color:#6b7280;font-size:14px;">This code expires in <strong>5 minutes</strong>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};

/**
 * Send password reset email (legacy link-based — kept for backward compatibility)
 */
export const sendResetPasswordEmail = async (to: string, resetToken: string) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your Password — Hodaltech';
  const text = `You requested a password reset.\n\nClick the link below (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#3b82f6;">Reset Your Password</h2>
      <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a>
      <p style="color:#6b7280;font-size:14px;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};
