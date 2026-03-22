import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';

const transport = nodemailer.createTransport({
  pool: true, // Reuse SMTP connections for faster delivery
  service: 'gmail',
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.auth.user,
    pass: config.email.smtp.auth.pass,
  },
  tls: {
    rejectUnauthorized: false,
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
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.05);border:1px solid #f1f5f9;">
      <div style="background:#3b82f6;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:2px;font-weight:800;">HODALTECH</h1>
      </div>
      <div style="padding:40px 32px;">
        <h2 style="color:#1e293b;margin:0 0 16px 0;font-size:22px;text-align:center;">Verify Your Identity</h2>
        <p style="text-align:center;color:#64748b;font-size:16px;line-height:1.6;">Hi <strong>${name}</strong>, use the secure code below to complete your registration:</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:#f8fafc;border:2px dashed #cbd5e1;padding:20px 40px;border-radius:16px;">
            <span style="color:#3b82f6;font-size:36px;font-weight:800;letter-spacing:10px;font-family:monospace;">${otp}</span>
          </div>
        </div>
        <p style="text-align:center;color:#ef4444;font-size:14px;font-weight:600;margin:0;">Expires in 5 minutes</p>
      </div>
      <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #f1f5f9;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">If you did not request this code, you can safely ignore this email.</p>
        <p style="color:#94a3b8;font-size:12px;margin:8px 0 0 0;">&copy; 2026 Hodaltech. Secure Authentication System.</p>
      </div>
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
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:20px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.05);border:1px solid #f1f5f9;">
      <div style="background:#3b82f6;padding:32px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:2px;font-weight:800;">HODALTECH</h1>
      </div>
      <div style="padding:40px 32px;">
        <h2 style="color:#1e293b;margin:0 0 16px 0;font-size:22px;text-align:center;">Reset Your Password</h2>
        <p style="text-align:center;color:#64748b;font-size:16px;line-height:1.6;">Someone requested a password reset for your account. Use this code to continue:</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="display:inline-block;background:#fefce8;border:2px dashed #facc15;padding:20px 40px;border-radius:16px;">
            <span style="color:#854d0e;font-size:36px;font-weight:800;letter-spacing:10px;font-family:monospace;">${otp}</span>
          </div>
        </div>
        <p style="text-align:center;color:#ef4444;font-size:14px;font-weight:600;margin:0;">Expires in 5 minutes</p>
      </div>
      <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #f1f5f9;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">If you did not request a password reset, you can safely ignore this email.</p>
        <p style="color:#94a3b8;font-size:12px;margin:8px 0 0 0;">&copy; 2026 Hodaltech. Secure Authentication System.</p>
      </div>
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
/**
 * Notify recipient of a new message
 */
export const sendMessageNotificationEmail = async (to: string, senderName: string, messagePreview: string, conversationUrl: string) => {
  const subject = `New Message from ${senderName} — Hodaltech`;
  const text = `Hi,\n\nYou have received a new message from ${senderName}:\n\n"${messagePreview}"\n\nView conversation: ${conversationUrl}\n\nBest regards,\nHodaltech Team`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;">
      <h2 style="color:#3b82f6;text-align:center;">New Message</h2>
      <p style="text-align:center;color:#374151;">You have received a new message from <strong>${senderName}</strong>:</p>
      <div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e5e7eb;margin:24px 0;font-style:italic;color:#4b5563;">
        "${messagePreview}"
      </div>
      <div style="text-align:center;">
        <a href="${conversationUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Conversation</a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">You are receiving this because someone sent you a message on Hodaltech.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};

/**
 * Send meeting reminder email
 */
export const sendMeetingReminderEmail = async (
  to: string,
  meetingTitle: string,
  meetingTime: string,
  joinLink: string
) => {
  const subject = `Meeting Reminder: ${meetingTitle} — Hodaltech`;
  const text = `Reminder: Your meeting "${meetingTitle}" starts at ${meetingTime}.\n\nJoin link: ${joinLink}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb;">
      <h2 style="color:#3b82f6;text-align:center;">⏰ Meeting Reminder</h2>
      <p style="text-align:center;color:#374151;">Your meeting is starting soon.</p>
      <div style="background:#fff;padding:20px;border-radius:12px;margin:24px 0;text-align:center;">
        <h3 style="margin:0 0 10px 0;color:#1e293b;">${meetingTitle}</h3>
        <p style="margin:0;color:#6b7280;font-size:14px;"><strong>Time:</strong> ${meetingTime}</p>
      </div>
      <div style="text-align:center;">
        <a href="${joinLink}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;box-shadow:0 4px 12px rgba(59,130,246,0.3);">Join Meeting</a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">You are receiving this because you are invited to a meeting on Hodaltech.</p>
    </div>
  `;
  await sendEmail(to, subject, text, html);
};
