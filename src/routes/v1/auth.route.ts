import express from 'express';
import * as authController from '../../controllers/auth.controller';
import { validate } from '../../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  verifyOtpSchema,
  resendOtpSchema,
  verifyResetOtpSchema,
} from '../../validations/auth.validation';

const router = express.Router();

// Registration flow
router.post('/register', validate(registerSchema), authController.register);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyRegistrationOtp);
router.post('/resend-otp', validate(resendOtpSchema), authController.resendOtpHandler);

// Login / Logout
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', validate(refreshTokenSchema), authController.logout);
router.post('/refresh-tokens', validate(refreshTokenSchema), authController.refreshTokens);

// Password reset flow
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-reset-otp', validate(verifyResetOtpSchema), authController.verifyResetOtp);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
