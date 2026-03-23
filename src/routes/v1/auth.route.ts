import express from 'express';
import * as authController from '../../controllers/auth.controller';
import { validate } from '../../middlewares/validate'; // Still using existing middleware for generic validation
import { rateLimitOtpSubmit, rateLimitOtpVerify } from '../../middlewares/rateLimiter';
import { 
  registerSchema, 
  loginSchema, 
  sendOtpSchema, 
  verifyOtpSchema 
} from '../../validations/auth.zod';

const router = express.Router();

// Registration flow
router.post('/register', rateLimitOtpSubmit, validate(registerSchema), authController.register);
router.post('/verify-otp', rateLimitOtpVerify, validate(verifyOtpSchema), authController.verifyRegistrationOtp);
router.post('/resend-otp', rateLimitOtpSubmit, validate(sendOtpSchema), authController.resendOtpHandler);

// Login / Logout
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-tokens', authController.refreshTokens);

// Password reset flow
router.post('/forgot-password', rateLimitOtpSubmit, validate(sendOtpSchema), authController.forgotPassword);
router.post('/verify-reset-otp', rateLimitOtpVerify, validate(verifyOtpSchema), authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

export default router;
