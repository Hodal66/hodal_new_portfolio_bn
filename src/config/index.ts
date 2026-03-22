import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(10000),
    MONGODB_URI: Joi.string().required().description('MongoDB connection string'),
    JWT_ACCESS_SECRET: Joi.string().required().description('JWT Access Secret'),
    JWT_REFRESH_SECRET: Joi.string().required().description('JWT Refresh Secret'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(60),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(7),
    EMAIL_HOST: Joi.string().default('smtp.gmail.com'),
    EMAIL_PORT: Joi.number().default(587),
    EMAIL_USER: Joi.string().required(),
    EMAIL_PASS: Joi.string().required(),
    EMAIL_FROM: Joi.string().description('the from field in the emails sent by the app'),
    EMAIL_SECURE: Joi.string().default('false'),
    ENABLE_EMAIL_NOTIFICATIONS: Joi.string().default('false'),
    ADMIN_EMAILS: Joi.string().allow('').default(''),
    CLOUDINARY_CLOUD_NAME: Joi.string().required(),
    CLOUDINARY_API_KEY: Joi.string().required(),
    CLOUDINARY_API_SECRET: Joi.string().required(),
    FRONTEND_URL: Joi.string().default('https://hodal-new-portfolio.onrender.com'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const env = envVars.NODE_ENV || 'development';

export const config = {
  env,
  port: envVars.PORT,
  frontendUrl: envVars.FRONTEND_URL,

  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      serverSelectionTimeoutMS: 5000,
    },
  },

  jwt: {
    secret: envVars.JWT_ACCESS_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: 30,
  },

  cloudinary: {
    cloud_name: envVars.CLOUDINARY_CLOUD_NAME,
    api_key: envVars.CLOUDINARY_API_KEY,
    api_secret: envVars.CLOUDINARY_API_SECRET,
  },

  email: {
    smtp: {
      host: envVars.EMAIL_HOST,
      port: envVars.EMAIL_PORT,
      secure: envVars.EMAIL_SECURE === 'true',
      auth: {
        user: envVars.EMAIL_USER,
        pass: envVars.EMAIL_PASS,
      },
    },
    from: envVars.EMAIL_FROM || `"Hodaltech" <noreply@hodaltech.com>`,
    adminEmails: envVars.ADMIN_EMAILS || '',
    enableNotifications:
      env === 'production'
        ? envVars.ENABLE_EMAIL_NOTIFICATIONS === 'true'
        : true,
  },

  otp: {
    expiryMinutes: Number(envVars.OTP_EXPIRY_MINUTES) || 5,
    maxAttempts: Number(envVars.OTP_MAX_ATTEMPTS) || 5,
    maxResendsPerHour: Number(envVars.OTP_MAX_RESENDS_PER_HOUR) || 5,
    cooldownSeconds: Number(envVars.OTP_COOLDOWN_SECONDS) || 60,
  },
};
