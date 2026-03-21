import mongoose from 'mongoose';
import Notification from '../models/notification.model';
import { emitNotification } from '../utils/socket';
import logger from '../utils/logger';

/**
 * Send a notification to a specific user
 * @param {string} userId - Recipient user ID
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {string} type - Notification type (e.g., 'message', 'alert')
 * @param {object} metadata - Optional extra data
 */
export const createNotification = async (
  userId: string | mongoose.Types.ObjectId,
  title: string,
  message: string,
  type: 'message' | 'system' | 'alert' | 'update' = 'system',
  metadata?: any
) => {
  try {
    const notification = await Notification.create({
      recipient: userId,
      title,
      message,
      type,
      metadata,
    });

    // Real-time broadcast
    emitNotification(userId.toString(), {
      id: notification._id,
      title,
      message,
      type,
      metadata,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    logger.error('Failed to create notification', { error, userId });
    return null;
  }
};

/**
 * Get unread notifications for a user
 */
export const getUnreadNotifications = async (userId: string) => {
  return Notification.find({ recipient: userId, isRead: false }).sort({ createdAt: -1 });
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (notificationId: string, userId: string) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );
};
