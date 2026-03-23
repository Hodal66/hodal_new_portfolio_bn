import httpStatus from 'http-status';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { createUser } from '../services/user.service';
import { loginUserWithEmailAndPassword } from '../services/auth.service';
import { generateAuthTokens, generateResetPasswordToken, verifyToken, blacklistUserTokens } from '../services/token.service';
import catchAsync from '../utils/catchAsync';
import { sendRegistrationEmail, sendAdminNotification, sendOtpEmail, sendPasswordResetOtpEmail, logOtpForDev } from '../services/email.service';
import Notification from '../models/notification.model';
import Token, { TokenType } from '../models/token.model';
import User from '../models/user.model';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { config } from '../config';
import redis from '../utils/redis';

/** ──────────────────────── Helpers ──────────────────────── */

const sanitizeUser = (user: any) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

/**
 * Professional OTP Generator & Redis Storer.
 * Uses crypto.randomInt for high-entropy 6-digit codes.
 * Stores in Redis with 10-minute TTL.
 */
const issueOtp = async (email: string, purpose: 'verify' | 'reset'): Promise<string> => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const key = `otp:${purpose}:${email.toLowerCase().trim()}`;
  
  // Store in Redis: { otp, attempts: 0 } with 10 min TTL
  await redis.set(key, JSON.stringify({ otp, attempts: 0 }), 'EX', 600);
  
  logOtpForDev(email, otp, purpose);
  return otp;
};

/** ──────────────────────── Auth Handlers ──────────────────────── */

export const register = catchAsync(async (req: Request, res: Response) => {
  const user = await createUser(req.body);
  const otp = await issueOtp(user.email, 'verify');

  // Async notifications
  sendOtpEmail(user.email, user.name, otp).catch(e => logger.error('OTP Email Fail', e));
  sendAdminNotification(user.email, user.name).catch(e => logger.error('Admin Alert Fail', e));
  
  Notification.create({
    title: 'New User Registration',
    message: `${user.name} (${user.email}) initiated registration.`,
    type: 'newUser',
  }).catch(() => {});

  res.status(httpStatus.CREATED).json({
    message: 'Entity initialized. Security token dispatched to email ecosystem.',
    email: user.email,
    ...(config.env !== 'production' ? { devOtp: otp } : {}),
  });
});

export const verifyRegistrationOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const key = `otp:verify:${email.toLowerCase().trim()}`;
  const data = await redis.get(key);

  if (!data) throw new ApiError(httpStatus.BAD_REQUEST, 'Security token expired or invalid initialization.');
  const { otp: storedOtp } = JSON.parse(data);

  if (storedOtp !== otp) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid security token sequence.');
  }

  // Success: Burn the OTP
  await redis.del(key);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'Entity not found in cryptovault.');
  
  user.status = 'active';
  user.isEmailVerified = true;
  await user.save();

  const tokens = await generateAuthTokens(user);
  sendRegistrationEmail(user.email, user.name).catch(() => {});

  res.json({ message: 'Identity verified. Access tokens granted.', user: sanitizeUser(user), tokens });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await loginUserWithEmailAndPassword(email, password);

  if (user.status === 'pending') {
    const otp = await issueOtp(user.email, 'verify');
    sendOtpEmail(user.email, user.name, otp).catch(() => {});
    return res.status(httpStatus.FORBIDDEN).json({
      message: 'Verification required. A new security token has been dispatched.',
      email: user.email,
      requiresVerification: true,
      ...(config.env !== 'production' ? { devOtp: otp } : {}),
    });
  }

  const tokens = await generateAuthTokens(user);
  res.send({ user: sanitizeUser(user), tokens });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Safety: Always return 200, but only issue OTP if user exists
  if (user) {
    const otp = await issueOtp(user.email, 'reset');
    sendPasswordResetOtpEmail(user.email, otp).catch(() => {});
  }

  res.json({ message: 'If the entity exists in our vault, a recovery sequence has been dispatched.' });
});

export const verifyResetOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const key = `otp:reset:${email.toLowerCase().trim()}`;
  const data = await redis.get(key);

  if (!data) throw new ApiError(httpStatus.BAD_REQUEST, 'Recovery sequence expired.');
  const { otp: storedOtp } = JSON.parse(data);

  if (storedOtp !== otp) throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid recovery token.');

  await redis.del(key);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');

  const resetToken = await generateResetPasswordToken(user._id.toString());
  res.json({ message: 'Recovery authorized.', resetToken });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { resetToken, password } = req.body;
  const tokenDoc = await verifyToken(resetToken, TokenType.RESET_PASSWORD);
  const user = await User.findById(tokenDoc.user);
  
  if (!user) throw new ApiError(httpStatus.UNAUTHORIZED, 'Identity verification failed.');

  user.password = password;
  await user.save();
  
  tokenDoc.blacklisted = true;
  await tokenDoc.save();
  await blacklistUserTokens(user._id.toString());

  res.json({ message: 'Password overwrite successful. Access restored.' });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const tokenDoc = await Token.findOne({ token: refreshToken, type: TokenType.REFRESH });
  if (tokenDoc) {
    tokenDoc.blacklisted = true;
    await tokenDoc.save();
  }
  res.status(httpStatus.NO_CONTENT).send();
});

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const tokenDoc = await verifyToken(refreshToken, TokenType.REFRESH);
  const user = await User.findById(tokenDoc.user);
  if (!user) throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid session.');

  tokenDoc.blacklisted = true;
  await tokenDoc.save();
  const tokens = await generateAuthTokens(user);
  res.send(tokens);
});

export const resendOtpHandler = catchAsync(async (req: Request, res: Response) => {
  const { email, purpose } = req.body;
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return res.json({ message: 'Dispatched.' });

  const type = purpose === 'passwordReset' ? 'reset' : 'verify';
  const otp = await issueOtp(email, type);
  
  if (type === 'verify') sendOtpEmail(email, user.name, otp).catch(() => {});
  else sendPasswordResetOtpEmail(email, otp).catch(() => {});

  res.json({ message: 'New security token dispatched.', ...(config.env !== 'production' ? { devOtp: otp } : {}) });
});
