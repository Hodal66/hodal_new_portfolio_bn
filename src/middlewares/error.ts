import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';

export const errorConverter = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    // Handle Mongoose CastError (invalid ObjectId) as 400
    if (error.name === 'CastError') {
      error = new ApiError(httpStatus.BAD_REQUEST, 'Invalid ID format');
    } else {
      const statusCode =
        error.statusCode ||
        (error instanceof mongoose.Error ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR);
      const message = error.message || (httpStatus[statusCode as keyof typeof httpStatus] as string);
      error = new ApiError(statusCode, message, false, err.stack);
    }
  }
  next(error);
};

export const errorHandler = (err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'An unexpected error occurred';
  }

  // Log errors server-side (never expose stack to client in prod)
  if (config.env === 'development') {
    logger.error(`[${statusCode}] ${message}`, { stack: err.stack, url: req.originalUrl });
  } else if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${message} — ${req.method} ${req.originalUrl}`);
  }

  const response: any = {
    code: statusCode,
    message,
  };

  // Only include stack trace in development
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
