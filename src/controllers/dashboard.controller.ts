import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import Notification from '../models/notification.model';
import ActivityLog from '../models/activity.model';
import User from '../models/user.model';
import Project from '../models/project.model';
import Subscription from '../models/subscription.model';

export const getStats = catchAsync(async (_req: Request, res: Response) => {
  const [totalUsers, newUsersToday, totalProjects, totalNotifications, activeSubscriptions] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      Project.countDocuments(),
      Notification.countDocuments({ isRead: false }),
      Subscription.countDocuments({ status: 'active' }),
    ]);

  res.send({
    totalUsers,
    newUsersToday,
    totalProjects,
    totalNotifications,
    activeSubscriptions,
  });
});

export const getNotifications = catchAsync(async (_req: Request, res: Response) => {
  const limit = 50;
  const notifications = await Notification.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const unreadCount = await Notification.countDocuments({ isRead: false });
  res.send({ notifications, unreadCount });
});

export const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.status(httpStatus.NO_CONTENT).send();
});

export const markAllNotificationsRead = catchAsync(async (_req: Request, res: Response) => {
  await Notification.updateMany({ isRead: false }, { isRead: true });
  res.status(httpStatus.NO_CONTENT).send();
});

export const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const logs = await ActivityLog.find()
    .populate('user', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.send(logs);
});
