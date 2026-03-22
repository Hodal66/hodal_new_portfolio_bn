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
import { createOtp, verifyOtp, resendOtp, invalidateAllOtps } from '../services/otp.service';
import { OtpPurpose } from '../models/otp.model';
import catchAsync from '../utils/catchAsync';
import {
  sendRegistrationEmail,
  sendAdminNotification,
  sendOtpEmail,
  sendPasswordResetOtpEmail,
  sendEmailAsync,
  logOtpForDev,
} from '../services/email.service';
import Notification from '../models/notification.model';
import Token, { TokenType } from '../models/token.model';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { config } from '../config';

// ─────────────────────── Helpers ───────────────────────

/** Strip password hash from user object before sending in API response */
const sanitizeUser = (user: any) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

/**
 * Generate OTP and queue the email in a non-blocking way.
 * Returns the plain OTP immediately so the caller can respond to the client.
 * Any email failure is logged but does NOT throw — the OTP still exists in DB.
 */
const generateAndQueueOtpEmail = async (
  email: string,
  purpose: OtpPurpose,
  sendFn: (otp: string) => Promise<void>
): Promise<string> => {
  const otp = await createOtp(email, purpose);

  // Always log OTP in non-production for easy dev testing
  logOtpForDev(email, otp, purpose);

  // Fire-and-forget: send email asynchronously — NEVER block the API response
  sendFn(otp).catch((err: Error) => {
    logger.error(`OTP email delivery failed for ${email} (${purpose})`, {
      error: err.message,
      purpose,
    });
  });

  return otp;
};

// ─────────────────────── REGISTRATION — Step 1: Submit Form ───────────────────────

export const register = catchAsync(async (req: Request, res: Response) => {
  // createUser sets status='pending' by default
  const user = await createUser(req.body);

  // Generate OTP — fire-and-forget email (response is not blocked by email sending)
  const otp = await generateAndQueueOtpEmail(
    user.email,
    OtpPurpose.EMAIL_VERIFICATION,
    (otp) => sendOtpEmail(user.email, user.name, otp)
  );

  // Admin notification — fully async, never blocks
  sendAdminNotification(user.email, user.name).catch((err) =>
    logger.error('Admin notification email failed', { error: err.message })
  );

  // In-app notification for admin
  Notification.create({
    title: 'New User Registration',
    message: `${user.name} (${user.email}) has signed up (pending verification).`,
    type: 'newUser',
  }).catch((err) => logger.error('Notification create failed', { error: err.message }));

  logger.info(`New user registered (pending verification): ${user.email}`);

  res.status(httpStatus.CREATED).json({
    message: 'Registration successful. Please check your email for the verification code.',
    email: user.email,
    ...(config.env !== 'production' ? { devOtp: otp } : {}),
  });
});

// ─────────────────────── REGISTRATION — Step 2: Verify OTP ───────────────────────

export const verifyRegistrationOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Verify OTP — throws ApiError on failure
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

  // Generate auth tokens — user is logged in immediately after verification
  const tokens = await generateAuthTokens(user);

  // Send welcome email async — does not block
  sendRegistrationEmail(user.email, user.name).catch((err) =>
    logger.error('Welcome email failed', { error: err.message })
  );

  logger.info(`User email verified and account activated: ${user.email}`);

  res.status(httpStatus.OK).json({
    message: 'Email verified successfully. Your account is now active.',
    user: sanitizeUser(user),
    tokens,
  });
});

// ─────────────────────── RESEND OTP ───────────────────────

export const resendOtpHandler = catchAsync(async (req: Request, res: Response) => {
  const { email, purpose } = req.body;

  const otpPurpose =
    purpose === 'passwordReset'
      ? OtpPurpose.PASSWORD_RESET
      : OtpPurpose.EMAIL_VERIFICATION;

  let otp;
  // For email verification: check the user exists and is not already active
  if (otpPurpose === OtpPurpose.EMAIL_VERIFICATION) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Generic response to prevent email enumeration
      return res.status(httpStatus.OK).json({
        message: 'If an account with that email exists, a new OTP has been sent.',
      });
    }
    if (user.status === 'active') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Account is already verified');
    }

    // Generate OTP and send verification email asynchronously
    otp = await generateAndQueueOtpEmail(
      email,
      OtpPurpose.EMAIL_VERIFICATION,
      (otp) => sendOtpEmail(email, user.name, otp)
    );
  } else {
    // Password reset resend — exact same pattern as forgotPassword
    otp = await generateAndQueueOtpEmail(
      email,
      OtpPurpose.PASSWORD_RESET,
      (otp) => sendPasswordResetOtpEmail(email, otp)
    );
  }

  logger.info(`OTP resent for ${email} (${purpose})`);

  res.status(httpStatus.OK).json({
    message: 'If an account with that email exists, a new OTP has been sent.',
    ...(config.env !== 'production' ? { devOtp: otp } : {}),
  });
});

// ─────────────────────── LOGIN ───────────────────────

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await loginUserWithEmailAndPassword(email, password);

  // If account is unverified, resend OTP automatically
  if (user.status === 'pending') {
    // Generate code synchronously so we can return it in the response for dev mode
    const otp = await generateAndQueueOtpEmail(
      user.email,
      OtpPurpose.EMAIL_VERIFICATION,
      (otp) => sendOtpEmail(user.email, user.name, otp)
    );

    return res.status(httpStatus.FORBIDDEN).json({
      message:
        'Your account is not verified. A new verification code has been sent to your email.',
      email: user.email,
      requiresVerification: true,
      ...(config.env !== 'production' ? { devOtp: otp } : {}),
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
  logger.info(`User logged out, refresh token blacklisted`);
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
  // Rotate: blacklist old refresh token, issue fresh pair
  tokenDoc.blacklisted = true;
  await tokenDoc.save();
  const tokens = await generateAuthTokens(user);
  res.send(tokens);
});

// ─────────────────────── FORGOT PASSWORD — Step 1: Request OTP ───────────────────────

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Look up user BEFORE responding — but ALWAYS return 200 to prevent enumeration
  const user = await User.findOne({ email: normalizedEmail });

  if (user) {
    try {
      // ★ KEY FIX: Generate OTP synchronously (must complete before responding)
      //   but send the email asynchronously (fire-and-forget)
      const otp = await generateAndQueueOtpEmail(
        user.email,
        OtpPurpose.PASSWORD_RESET,
        (otp) => sendPasswordResetOtpEmail(user.email, otp)
      );
      
      return res.status(httpStatus.OK).json({
        message: 'If an account with that email exists, a password reset code has been sent.',
        ...(config.env !== 'production' ? { devOtp: otp } : {}),
      });
    } catch (err: any) {
      if (err.statusCode === httpStatus.TOO_MANY_REQUESTS) {
        // Rate limit hit — still return generic message to prevent enumeration
        logger.warn(`Password reset OTP rate limit for: ${normalizedEmail}`);
      } else {
        // Unexpected error — log and rethrow so error middleware handles it
        logger.error(`Password reset OTP generation failed for: ${normalizedEmail}`, {
          error: err.message,
        });
        throw err;
      }
    }
  } else {
    // Log in non-production to aid debugging (don't log user emails in production)
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Forgot password: no user found for email ${normalizedEmail}`);
    }
  }

  // Always respond 200 — prevents email enumeration
  res.status(httpStatus.OK).json({
    message: 'If an account with that email exists, a password reset code has been sent.',
  });
});

// ─────────────────────── FORGOT PASSWORD — Step 2: Verify Reset OTP ───────────────────────

export const verifyResetOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  // Verify OTP — throws ApiError on failure (expired, invalid, too many attempts)
  await verifyOtp(email, otp, OtpPurpose.PASSWORD_RESET);

  // OTP verified — find the user
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Issue a short-lived reset JWT (30 min window) for the actual password change step
  const resetToken = await generateResetPasswordToken(user._id.toString());

  logger.info(`Password reset OTP verified for: ${user.email}`);

  res.status(httpStatus.OK).json({
    message: 'OTP verified successfully. You can now reset your password.',
    resetToken,
  });
});

// ─────────────────────── FORGOT PASSWORD — Step 3: Set New Password ───────────────────────

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { resetToken, password } = req.body;

  // Validate the reset JWT from step 2
  const tokenDoc = await verifyToken(resetToken, TokenType.RESET_PASSWORD);
  const user = await User.findById(tokenDoc.user).select('+password');
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
  }

  // Apply new password (pre-save hook hashes it)
  user.password = password;
  await user.save();

  // Burn the reset token — single-use
  tokenDoc.blacklisted = true;
  await tokenDoc.save();

  // Invalidate ALL refresh tokens — forces re-login on all devices (security best practice)
  await blacklistUserTokens(user._id.toString());

  // Clean up any leftover password reset OTPs (belt-and-suspenders)
  await invalidateAllOtps(user.email, OtpPurpose.PASSWORD_RESET);

  logger.info(`Password reset successfully for user: ${user.email}`);

  res.status(httpStatus.OK).json({
    message: 'Password has been reset successfully. Please log in with your new password.',
  });
});
