import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { createUser } from '../services/user.service';
import { loginUserWithEmailAndPassword } from '../services/auth.service';
import {
  generateAuthTokens,
  generateResetPasswordToken,
  verifyToken,
  blacklistUserTokens,
} from '../services/token.service';
import { createOtp, verifyOtp, resendOtp } from '../services/otp.service';
import { OtpPurpose } from '../models/otp.model';
import catchAsync from '../utils/catchAsync';
import {
  sendRegistrationEmail,
  sendAdminNotification,
  sendOtpEmail,
  sendPasswordResetOtpEmail,
} from '../services/email.service';
import Notification from '../models/notification.model';
import Token, { TokenType } from '../models/token.model';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

// Helper: strip password from user object before sending
const sanitizeUser = (user: any) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

// ─────────────────────── REGISTRATION (Step 1: Submit Form) ───────────────────────

export const register = catchAsync(async (req: Request, res: Response) => {
  // createUser sets status='pending' by default
  const user = await createUser(req.body);

  // Generate OTP and send verification email
  const otp = await createOtp(user.email, OtpPurpose.EMAIL_VERIFICATION);

  // Fire-and-forget OTP email
  sendOtpEmail(user.email, user.name, otp).catch((err) =>
    logger.error('OTP verification email failed', { error: err.message })
  );

  // Admin notification
  sendAdminNotification(user.email, user.name).catch((err) =>
    logger.error('Admin notification email failed', { error: err.message })
  );

  // Create in-app notification for admin
  Notification.create({
    title: 'New User Registration',
    message: `${user.name} (${user.email}) has signed up (pending verification).`,
    type: 'newUser',
  }).catch((err) => logger.error('Notification create failed', { error: err.message }));

  logger.info(`New user registered (pending): ${user.email}`);

  res.status(httpStatus.CREATED).json({
    message: 'Registration successful. Please check your email for the verification code.',
    email: user.email,
  });
});

// ─────────────────────── REGISTRATION (Step 2: Verify OTP) ───────────────────────

export const verifyRegistrationOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Verify the OTP
  await verifyOtp(email, otp, OtpPurpose.EMAIL_VERIFICATION);

  // Activate the user account
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.status === 'active') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Account is already verified');
  }

  user.status = 'active';
  user.isEmailVerified = true;
  await user.save();

  // Generate auth tokens
  const tokens = await generateAuthTokens(user);

  // Send welcome email
  sendRegistrationEmail(user.email, user.name).catch((err) =>
    logger.error('Welcome email failed', { error: err.message })
  );

  logger.info(`User email verified and activated: ${user.email}`);

  res.status(httpStatus.OK).json({
    message: 'Email verified successfully. Your account is now active.',
    user: sanitizeUser(user),
    tokens,
  });
});

// ─────────────────────── RESEND OTP ───────────────────────

export const resendOtpHandler = catchAsync(async (req: Request, res: Response) => {
  const { email, purpose } = req.body;

  const otpPurpose = purpose === 'passwordReset'
    ? OtpPurpose.PASSWORD_RESET
    : OtpPurpose.EMAIL_VERIFICATION;

  // For email verification, check that user exists and is still pending
  if (otpPurpose === OtpPurpose.EMAIL_VERIFICATION) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Generic message to prevent enumeration
      return res.status(httpStatus.OK).json({
        message: 'If an account with that email exists, a new OTP has been sent.',
      });
    }
    if (user.status === 'active') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account is already verified');
    }
  }

  const otp = await resendOtp(email, otpPurpose);

  if (otpPurpose === OtpPurpose.EMAIL_VERIFICATION) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    sendOtpEmail(email, user?.name || 'User', otp).catch((err) =>
      logger.error('Resend OTP email failed', { error: err.message })
    );
  } else {
    sendPasswordResetOtpEmail(email, otp).catch((err) =>
      logger.error('Resend reset OTP email failed', { error: err.message })
    );
  }

  logger.info(`OTP resent for ${email} (${purpose})`);

  res.status(httpStatus.OK).json({
    message: 'If an account with that email exists, a new OTP has been sent.',
  });
});

// ─────────────────────── LOGIN ───────────────────────

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await loginUserWithEmailAndPassword(email, password);

  // Check if account is activated
  if (user.status === 'pending') {
    // Resend OTP automatically
    const otp = await createOtp(user.email, OtpPurpose.EMAIL_VERIFICATION);
    sendOtpEmail(user.email, user.name, otp).catch((err) =>
      logger.error('Auto-resend OTP on login failed', { error: err.message })
    );

    return res.status(httpStatus.FORBIDDEN).json({
      message: 'Your account is not verified. A new verification code has been sent to your email.',
      email: user.email,
      requiresVerification: true,
    });
  }

  const tokens = await generateAuthTokens(user);
  logger.info(`User logged in: ${user.email}`);
  res.send({ user: sanitizeUser(user), tokens });
});

// ─────────────────────── LOGOUT ───────────────────────

export const logout = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Refresh token is required');
  }
  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: TokenType.REFRESH,
    blacklisted: false,
  });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Token not found');
  }
  tokenDoc.blacklisted = true;
  await tokenDoc.save();
  logger.info(`User logged out, token blacklisted`);
  res.status(httpStatus.NO_CONTENT).send();
});

// ─────────────────────── REFRESH TOKENS ───────────────────────

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const tokenDoc = await verifyToken(refreshToken, TokenType.REFRESH);
  const user = await User.findById(tokenDoc.user);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
  }
  // Blacklist old refresh token
  tokenDoc.blacklisted = true;
  await tokenDoc.save();
  // Issue new tokens
  const tokens = await generateAuthTokens(user);
  res.send(tokens);
});

// ─────────────────────── FORGOT PASSWORD (Step 1: Request OTP) ───────────────────────

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Always return 200 regardless to prevent email enumeration
  if (user) {
    try {
      const otp = await createOtp(user.email, OtpPurpose.PASSWORD_RESET);
      sendPasswordResetOtpEmail(user.email, otp).catch((err) =>
        logger.error('Reset OTP email failed', { error: err.message })
      );
      logger.info(`Password reset OTP requested for: ${user.email}`);
    } catch (err: any) {
      // If rate limited, still return generic message
      if (err.statusCode === httpStatus.TOO_MANY_REQUESTS) {
        logger.warn(`Rate limit hit for password reset OTP: ${email}`);
      } else {
        throw err;
      }
    }
  }

  res.status(httpStatus.OK).json({
    message: 'If an account with that email exists, a password reset code has been sent.',
  });
});

// ─────────────────────── FORGOT PASSWORD (Step 2: Verify Reset OTP) ───────────────────────

export const verifyResetOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Verify the OTP
  await verifyOtp(email, otp, OtpPurpose.PASSWORD_RESET);

  // Generate a short-lived reset token (JWT) for the actual password reset
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const resetToken = await generateResetPasswordToken(user._id.toString());

  logger.info(`Password reset OTP verified for: ${user.email}`);

  res.status(httpStatus.OK).json({
    message: 'OTP verified successfully. You can now reset your password.',
    resetToken,
  });
});

// ─────────────────────── FORGOT PASSWORD (Step 3: Set New Password) ───────────────────────

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { resetToken, password } = req.body;

  const tokenDoc = await verifyToken(resetToken, TokenType.RESET_PASSWORD);
  const user = await User.findById(tokenDoc.user).select('+password');
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
  }

  user.password = password;
  await user.save();

  // Invalidate the used reset token
  tokenDoc.blacklisted = true;
  await tokenDoc.save();

  // Also invalidate all refresh tokens for security (force re-login)
  await blacklistUserTokens(user._id.toString());

  logger.info(`Password reset successfully for user: ${user.email}`);
  res.status(httpStatus.OK).json({
    message: 'Password has been reset successfully. Please log in with your new password.',
  });
});
