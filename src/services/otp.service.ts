import crypto from 'crypto';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import Otp, { OtpPurpose, IOtp } from '../models/otp.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

// ─────────────────────── Configuration ───────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 3;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export const generateOtpCode = (): string => {
  // Use crypto.randomInt for uniform distribution of 6-digit codes
  const code = crypto.randomInt(100000, 999999);
  return code.toString();
};

/**
 * Hash an OTP code before storage
 */
const hashOtp = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
};

/**
 * Constant-time comparison of OTP
 */
const verifyOtpHash = async (plainOtp: string, hashedOtp: string): Promise<boolean> => {
  return bcrypt.compare(plainOtp, hashedOtp);
};

/**
 * Create and store a new OTP for an email
 * Returns the plain-text OTP (to be sent via email)
 */
export const createOtp = async (email: string, purpose: OtpPurpose): Promise<string> => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check resend rate limit: max N resends per hour for same email+purpose
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await Otp.countDocuments({
    email: normalizedEmail,
    purpose,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentCount >= MAX_RESENDS_PER_HOUR) {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      'Too many OTP requests. Please try again later.'
    );
  }

  // Invalidate any previous unused OTPs for the same email+purpose
  await Otp.updateMany(
    { email: normalizedEmail, purpose, used: false },
    { used: true }
  );

  // Generate new OTP
  const plainOtp = generateOtpCode();
  const otpHash = await hashOtp(plainOtp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    expiresAt,
    attempts: 0,
    used: false,
  });

  logger.info(`OTP created for ${normalizedEmail} (${purpose}), expires at ${expiresAt.toISOString()}`);
  return plainOtp;
};

/**
 * Verify an OTP code
 * Returns the OTP document if valid
 * Throws ApiError if invalid, expired, or too many attempts
 */
export const verifyOtp = async (
  email: string,
  otp: string,
  purpose: OtpPurpose
): Promise<IOtp> => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find the latest unused, non-expired OTP for this email+purpose
  const otpDoc = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'OTP has expired or is invalid. Please request a new one.'
    );
  }

  // Check attempt limit
  if (otpDoc.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    // Mark as used (burned)
    otpDoc.used = true;
    await otpDoc.save();
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      'Too many verification attempts. Please request a new OTP.'
    );
  }

  // Increment attempt counter
  otpDoc.attempts += 1;
  await otpDoc.save();

  // Verify the OTP hash (constant-time via bcrypt)
  const isValid = await verifyOtpHash(otp, otpDoc.otpHash);

  if (!isValid) {
    const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpDoc.attempts;
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid OTP code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
    );
  }

  // Mark as used (single-use)
  otpDoc.used = true;
  await otpDoc.save();

  logger.info(`OTP verified successfully for ${normalizedEmail} (${purpose})`);
  return otpDoc;
};

/**
 * Resend an OTP — creates a new one and invalidates previous
 * Rate-limited by createOtp internally
 */
export const resendOtp = async (email: string, purpose: OtpPurpose): Promise<string> => {
  return createOtp(email, purpose);
};
