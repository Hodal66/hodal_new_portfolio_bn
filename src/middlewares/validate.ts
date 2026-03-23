import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

/**
 * Universal Zod Validation Middleware.
 */
export const validate = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed: any = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Update with validated data
    req.body = parsed.body || req.body;
    req.query = parsed.query || req.query;
    req.params = parsed.params || req.params;

    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessage = error.issues.map((issue) => issue.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, `Protocol Violation: ${errorMessage}`));
    }
    return next(error);
  }
};
