import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from '../utils/redis';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

/**
 * Advanced Rate Limiting System.
 * Protects against: brute force, spamming, and credential stuffing.
 */

// 1. Strict Limiter for OTP Requests (Targeted at Email + IP)
const otpSubmitLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit_otp_submit',
  points: 3, // 3 requests
  duration: 3600, // per 1 hour
  blockDuration: 3600, // block for 1 hour if exceeded
});

// 2. Strict Limiter for OTP Verification (Brute Force protection)
const otpVerifyLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit_otp_verify',
  points: 5, // 5 attempts per OTP
  duration: 600, // within the lifetime of the OTP
  blockDuration: 300, // block for 5 minutes if brute-forced
});

export const rateLimitOtpSubmit = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();
  
  const email = req.body.email?.toLowerCase();
  const ip = req.ip;
  const key = `${email}_${ip}`;

  try {
    await otpSubmitLimiter.consume(key);
    next();
  } catch (err: any) {
    next(new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Security Alert: Too many OTP requests. Please try again in 1 hour.'));
  }
};

export const rateLimitOtpVerify = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') return next();

  const email = req.body.email?.toLowerCase();
  try {
    await otpVerifyLimiter.consume(email);
    next();
  } catch (err: any) {
    next(new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Security Alert: Too many failed attempts. Verification locked for 5 minutes.'));
  }
};
