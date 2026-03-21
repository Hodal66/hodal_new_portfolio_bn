import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validate request data against a Joi schema
 */
export const validate = (schema: Joi.ObjectSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,    // return all errors, not just the first
      allowUnknown: false,  // reject unknown keys
      stripUnknown: true,   // remove unknown keys from the validated value
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, message));
    }

    // Replace req[target] with the validated (and stripped) value
    req[target] = value;
    next();
  };
};
