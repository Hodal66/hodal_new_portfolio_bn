import { z } from 'zod';

/**
 * Zod schemas for stricter, production-grade authentication validation.
 * Features: complex password enforcement and normalized email storage.
 */

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;

export const emailSchema = z.string().email('Please enter a valid email address').trim().toLowerCase();

export const otpSchema = z.string().length(6, 'The OTP must be exactly 6 digits').regex(/^\d+$/, 'The OTP must contain only numbers');

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: emailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters').regex(passwordRegex, 'Password must include uppercase, lowercase, number, and special character'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string(),
  }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: emailSchema,
    otp: otpSchema,
  }),
});
