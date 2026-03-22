import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3300,
  frontendUrl: process.env.FRONTEND_URL || 'https://hodal-new-portfolio.onrender.com',
  mongoose: {
    url: process.env.MONGODB_URI || process.env.MONGODB_URL || '',
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },
  jwt: {
    secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'CHANGE_ME_USE_STRONG_SECRET',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'CHANGE_ME_USE_STRONG_REFRESH_SECRET',
    // accessExpirationMinutes: read from JWT_ACCESS_EXPIRATION_MINUTES (number)
    accessExpirationMinutes: Number(process.env.JWT_ACCESS_EXPIRATION_MINUTES) || 60,
    refreshExpirationDays: Number(process.env.JWT_REFRESH_EXPIRATION_DAYS) || 7,
    resetPasswordExpirationMinutes: 30,
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  email: {
    smtp: {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || process.env.SMTP_USERNAME,
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD,
      },
    },
    from: process.env.EMAIL_FROM || 'noreply@hodaltech.com',
    adminEmails: process.env.ADMIN_EMAILS || '',
    enableNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  },
};
