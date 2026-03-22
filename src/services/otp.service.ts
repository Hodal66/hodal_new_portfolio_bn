import crypto from 'crypto';
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import Otp, { OtpPurpose, IOtp } from '../models/otp.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

// ───────────────────── Configuration ─────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_RESENDS_PER_HOUR = 5;      // Max OTP requests per hour per email+purpose
const OTP_COOLDOWN_SECONDS = 60;     // Minimum gap between successive OTP requests
const BCRYPT_ROUNDS = 6;             // Low rounds intentional — OTPs are short-lived codes

// ───────────────────── OTP Generation ─────────────────────

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt for uniform, bias-free distribution.
 */
export const generateOtpCode = (): string => {
  // Range [100000, 999999] guarantees always 6 digits
  const code = crypto.randomInt(100000, 1000000);
  return code.toString().padStart(OTP_LENGTH, '0');
};

/**
 * Hash an OTP code before database storage.
 * bcrypt provides constant-time comparison defense against timing attacks.
 */
const hashOtp = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
};

/**
 * Constant-time verification of a plain OTP against its stored hash.
 */
const verifyOtpHash = async (plainOtp: string, hashedOtp: string): Promise<boolean> => {
  return bcrypt.compare(plainOtp, hashedOtp);
};

// ───────────────────── Create OTP ─────────────────────

/**
 * Create and store a new OTP for an email+purpose combination.
 *
 * Security controls:
 *  - Rate limit: max MAX_RESENDS_PER_HOUR per email+purpose per hour
 *  - Cooldown: reject if a fresh OTP was issued within OTP_COOLDOWN_SECONDS
 *  - Invalidation: mark all previous unused OTPs as used before creating new one
 *
 * @returns the plain-text OTP (to be sent via email, NEVER stored)
 */
export const createOtp = async (email: string, purpose: OtpPurpose): Promise<string> => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - OTP_COOLDOWN_SECONDS * 1000);

  // ── Rate limit: max N requests per hour ──
  const recentCount = await Otp.countDocuments({
    email: normalizedEmail,
    purpose,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentCount >= MAX_RESENDS_PER_HOUR) {
    logger.warn(`OTP rate limit reached for ${normalizedEmail} (${purpose})`);
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      `Too many OTP requests. Please wait before requesting a new code.`
    );
  }

  // ── Cooldown: prevent hammering within 60 seconds ──
  const recentOtp = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    createdAt: { $gte: cooldownCutoff },
    used: false,
  });

  if (recentOtp) {
    const secondsLeft = Math.ceil(
      (recentOtp.createdAt.getTime() + OTP_COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000
    );
    logger.warn(`OTP cooldown active for ${normalizedEmail} (${purpose}) — ${secondsLeft}s left`);
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''} before requesting a new code.`
    );
  }

  // ── Invalidate all existing unused OTPs for this email+purpose ──
  const invalidated = await Otp.updateMany(
    { email: normalizedEmail, purpose, used: false },
    { $set: { used: true } }
  );
  if (invalidated.modifiedCount > 0) {
    logger.debug(`Invalidated ${invalidated.modifiedCount} previous OTP(s) for ${normalizedEmail}`);
  }

  // ── Generate and store the new OTP ──
  const plainOtp = generateOtpCode();
  const otpHash = await hashOtp(plainOtp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    expiresAt,
    attempts: 0,
    used: false,
  });

  logger.info(
    `OTP created for ${normalizedEmail} (${purpose}) — expires at ${expiresAt.toISOString()}`
  );

  return plainOtp;
};

// ───────────────────── Verify OTP ─────────────────────

/**
 * Verify an OTP code against the database.
 *
 * Security controls:
 *  - Only finds unused, non-expired records
 *  - Enforces MAX_VERIFICATION_ATTEMPTS — burns OTP after limit reached
 *  - Increments attempt counter before hash comparison (prevents timing side-channel)
 *  - Marks OTP as used immediately on success (single-use enforcement)
 *
 * @returns the OTP document on success
 * @throws ApiError on invalid, expired, or exceeded attempts
 */
export const verifyOtp = async (
  email: string,
  otp: string,
  purpose: OtpPurpose
): Promise<IOtp> => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find the most recent unused, non-expired OTP
  const otpDoc = await Otp.findOne({
    email: normalizedEmail,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    // Check if there is an expired OTP — gives a more specific message
    const expiredOtp = await Otp.findOne({
      email: normalizedEmail,
      purpose,
      used: false,
      expiresAt: { $lte: new Date() },
    });

    if (expiredOtp) {
      // Mark it used so it doesn't accumulate
      expiredOtp.used = true;
      await expiredOtp.save();
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Your OTP has expired. Please request a new one.'
      );
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid or expired OTP. Please request a new one.'
    );
  }

  // ── Check attempt limit BEFORE doing the hash compare ──
  if (otpDoc.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    otpDoc.used = true; // Burn this OTP — too many attempts
    await otpDoc.save();
    logger.warn(`OTP burned (max attempts) for ${normalizedEmail} (${purpose})`);
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      'Too many incorrect attempts. Please request a new OTP.'
    );
  }

  // ── Increment attempt BEFORE the hash check (prevents timing-based enumeration) ──
  otpDoc.attempts += 1;
  await otpDoc.save();

  // ── Constant-time hash comparison ──
  const isValid = await verifyOtpHash(otp, otpDoc.otpHash);

  if (!isValid) {
    const remaining = MAX_VERIFICATION_ATTEMPTS - otpDoc.attempts;
    logger.warn(
      `Invalid OTP attempt for ${normalizedEmail} (${purpose}) — ${remaining} attempt(s) left`
    );
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      remaining > 0
        ? `Invalid OTP code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Invalid OTP code. No attempts remaining. Please request a new OTP.'
    );
  }

  // ── Mark as used immediately (single-use enforcement) ──
  otpDoc.used = true;
  await otpDoc.save();

  logger.info(`OTP verified successfully for ${normalizedEmail} (${purpose})`);
  return otpDoc;
};

// ───────────────────── Resend OTP ─────────────────────

/**
 * Resend / regenerate an OTP for an email+purpose.
 * Internally alias for createOtp — rate limits are enforced there.
 */
export const resendOtp = async (email: string, purpose: OtpPurpose): Promise<string> => {
  return createOtp(email, purpose);
};

// ───────────────────── Utility: Invalidate All ─────────────────────

/**
 * Unconditionally invalidate all OTPs for an email+purpose.
 * Use after successful password reset / email verification to clean up.
 */
export const invalidateAllOtps = async (
  email: string,
  purpose: OtpPurpose
): Promise<void> => {
  const normalizedEmail = email.toLowerCase().trim();
  await Otp.updateMany(
    { email: normalizedEmail, purpose, used: false },
    { $set: { used: true } }
  );
};
