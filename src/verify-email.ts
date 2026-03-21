import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const transport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

console.log('Verifying transport with config:', {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE,
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS === 'REPLACE_WITH_APP_PASSWORD' ? 'PLACEHOLDER' : 'HIDDEN',
});

transport.verify()
  .then(() => {
    console.log('✅ Connected to email server successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Unable to connect to email server:');
    console.error(err);
    process.exit(1);
  });
