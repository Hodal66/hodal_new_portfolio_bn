/**
 * Professional Email Template Engine for HodalTech.
 * Wraps content in a high-conversion, responsive HTML structure.
 */

interface TemplateOptions {
  title: string;
  preheader?: string;
  content: string;
  actionUrl?: string;
  actionText?: string;
  footerText?: string;
}

export const wrapInTemplate = (options: TemplateOptions): string => {
  const { title, preheader = '', content, actionUrl, actionText, footerText = 'Sent by HodalTech Security Gateway' } = options;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
      <meta http-equiv="X-UA-Compatible" content="IE=Edge">
      <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }
        body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f4f7f9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f9; padding-bottom: 40px; }
        .main { background-color: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
        .content { padding: 40px 30px; line-height: 1.6; color: #334155; font-size: 16px; }
        .button-container { text-align: center; padding: 20px 0; }
        .button { background-color: #3b82f6; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; }
        h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.025em; }
        .brand { font-weight: 900; color: #ffffff; text-decoration: none; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div style="display:none;font-size:1px;color:#f4f7f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table class="main" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px;">
                <tr>
                  <td class="header">
                    <a href="https://hodaltech.space" class="brand">HODALTECH</a>
                    <h1 style="margin-top: 10px;">${title}</h1>
                  </td>
                </tr>
                <tr>
                  <td class="content">
                    ${content}
                    ${actionUrl ? `
                    <div class="button-container">
                      <a href="${actionUrl}" class="button">${actionText || 'Click Here'}</a>
                    </div>` : ''}
                  </td>
                </tr>
                <tr>
                  <td class="footer">
                    <p>${footerText}</p>
                    <p>&copy; ${new Date().getFullYear()} HodalTech. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    </body>
</html>`;
};

/** Specific Templates */

export const getOtpTemplate = (otp: string, name: string) => wrapInTemplate({
  title: 'Verification Protocol',
  preheader: `Your security code is ${otp}`,
  content: `
    <p>Hello <strong>${name}</strong>,</p>
    <p>To finalize your initialization on the HodalTech platform, please use the following secure verification token:</p>
    <div style="background: #f8fafc; border: 2px solid #e2e8f0; padding: 20px; text-align: center; border-radius: 12px; margin: 25px 0;">
      <span style="font-size: 36px; font-weight: 900; letter-spacing: 0.5em; color: #3b82f6;">${otp}</span>
    </div>
    <p style="font-size: 14px; opacity: 0.8;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
  `,
  footerText: 'Security Gateway • Identity & Access Management'
});

export const getResetPasswordTemplate = (otp: string, name: string) => wrapInTemplate({
  title: 'Password Reset Sequence',
  preheader: `Use code ${otp} to reset your password`,
  content: `
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to override the password for your account. Use the token below to proceed with the reset protocol:</p>
    <div style="background: #f8fafc; border: 2px solid #e2e8f0; padding: 20px; text-align: center; border-radius: 12px; margin: 25px 0;">
      <span style="font-size: 36px; font-weight: 900; letter-spacing: 0.5em; color: #f43f5e;">${otp}</span>
    </div>
    <p>If you did not initiate this change, please contact support immediately as your account security may be compromised.</p>
  `,
  footerText: 'Security Gateway • Account Recovery'
});

export const getAdminNotificationTemplate = (subject: string, details: string) => wrapInTemplate({
  title: 'Admin Intelligence Alert',
  preheader: subject,
  content: `
    <p><strong>System Alert:</strong> ${subject}</p>
    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; font-size: 14px;">
      ${details}
    </div>
    <p>Please log in to the command center to manage this activity.</p>
  `,
  actionUrl: 'https://hodaltech.space/login',
  actionText: 'Access Command Center',
  footerText: 'Internal System Notification • Admin Only'
});

export const getContactConfirmationTemplate = (name: string) => wrapInTemplate({
  title: 'Message Transmitted',
  preheader: 'We received your message!',
  content: `
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your message has been successfully transmitted to the HodalTech team. We have received your inquiry and a specialist will analyze it shortly.</p>
    <p>Thank you for reaching out to us. We typically respond within 24 hours.</p>
  `,
  footerText: 'Automated Transmission Receipt • HodalTech Systems'
});
