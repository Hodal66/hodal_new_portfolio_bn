import { Request, Response, NextFunction } from 'express';
import ActivityLog from '../models/activity.model';
import logger from '../utils/logger';

/**
 * Activity logging middleware — call AFTER auth middleware
 * Logs authenticated user actions to the ActivityLog collection
 */
export const logActivity = (action: string, module: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    next(); // Process request first

    // After response, log the activity asynchronously
    if (req.user) {
      ActivityLog.create({
        user: req.user._id,
        action,
        module,
        details: JSON.stringify({ params: req.params, query: req.query }),
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      }).catch((err: Error) => logger.error('Activity log write failed', { error: err.message }));
    }
  };
};
