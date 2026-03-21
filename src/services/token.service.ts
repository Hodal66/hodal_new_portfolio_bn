import jwt from 'jsonwebtoken';
import moment, { Moment } from 'moment';
import httpStatus from 'http-status';
import { config } from '../config';
import { IUser } from '../models/user.model';
import Token, { TokenType } from '../models/token.model';
import ApiError from '../utils/ApiError';

/**
 * Generate a JWT token
 */
export const generateToken = (userId: string, expires: Moment, type: string, secret = config.jwt.secret as string): string => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token to the database
 */
export const saveToken = async (
  token: string,
  userId: string,
  expires: Moment,
  type: TokenType,
  blacklisted = false
) => {
  const tokenDoc = await Token.create({
    token,
    user: userId,
    expires: expires.toDate(),
    type,
    blacklisted,
  });
  return tokenDoc;
};

/**
 * Verify a token and return the token document
 */
export const verifyToken = async (token: string, type: TokenType) => {
  let payload: any;
  try {
    payload = jwt.verify(token, config.jwt.secret as string);
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token invalid or expired');
  }
  const tokenDoc = await Token.findOne({
    token,
    type,
    user: payload.sub,
    blacklisted: false,
  });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Token not found or already used');
  }
  return tokenDoc;
};

/**
 * Generate auth tokens (access + refresh) and persist refresh token
 */
export const generateAuthTokens = async (user: IUser) => {
  const userId = (user as any)._id.toString();

  const accessTokenExpires = moment().add(
    Number(config.jwt.accessExpirationMinutes),
    'minutes'
  );
  const accessToken = generateToken(userId, accessTokenExpires, TokenType.ACCESS);

  const refreshTokenExpires = moment().add(
    Number(config.jwt.refreshExpirationDays),
    'days'
  );
  const refreshToken = generateToken(userId, refreshTokenExpires, TokenType.REFRESH);

  // Persist refresh token in DB
  await saveToken(refreshToken, userId, refreshTokenExpires, TokenType.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
  };
};

/**
 * Generate a password reset token (raw + hashed stored)
 */
export const generateResetPasswordToken = async (userId: string): Promise<string> => {
  const expires = moment().add(30, 'minutes'); // 30-minute window
  const token = generateToken(userId, expires, TokenType.RESET_PASSWORD);
  await saveToken(token, userId, expires, TokenType.RESET_PASSWORD);
  return token;
};

/**
 * Blacklist all refresh tokens for a user (logout)
 */
export const blacklistUserTokens = async (userId: string): Promise<void> => {
  await Token.updateMany(
    { user: userId, type: TokenType.REFRESH, blacklisted: false },
    { blacklisted: true }
  );
};
