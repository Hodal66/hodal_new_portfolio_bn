import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const testEmail = async () => {
    console.log('--- Email Diagnostic Tool ---');
    console.log('Host:', process.env.EMAIL_HOST);
    console.log('Port:', process.env.EMAIL_PORT);
    console.log('User:', process.env.EMAIL_USER);
    console.log('Checking connection...');

    const isGmail = (process.env.EMAIL_HOST || '').includes('gmail');

    const transporter = nodemailer.createTransport(
        isGmail ? {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        } : {
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        }
    );

    try {
        await transporter.verify();
        console.log('✅ SMTP Connection Successful!');

        console.log('Attempting to send test email to:', process.env.EMAIL_USER);
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'Hodaltech Email Diagnostic - OTP Test',
            text: 'If you are reading this, your SMTP configuration is working perfectly!',
            html: '<h1>✅ Success!</h1><p>Your email system is ready for OTP delivery.</p>'
        });

        console.log('✅ Test Email Sent!');
        console.log('Message ID:', info.messageId);
        console.log('----------------------------');
        console.log('IMPORTANT: If you dont see it in your inbox, check SPAM folder.');
    } catch (err: any) {
        console.error('❌ Diagnostic Failed!');
        console.error('Error Details:', err.message);
        if (isGmail && err.message.includes('Invalid login')) {
            console.log('\n💡 HINT: For Gmail, ensure you are using an "App Password".');
            console.log('Go to: https://myaccount.google.com/apppasswords');
        }
    }
};

testEmail();
