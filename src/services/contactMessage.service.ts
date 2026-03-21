import ContactMessage, { IContactMessage } from '../models/contactMessage.model';
import User from '../models/user.model';
import { createNotification } from './notification.service';
import * as emailService from './email.service';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Submit a new contact message from the website form.
 * Automatically notifies all admin users.
 */
export const submitContactMessage = async (data: Partial<IContactMessage>) => {
  const message = await ContactMessage.create(data);
  
  // Find all admins to notify them
  const admins = await User.find({ roles: 'admin' });
  
  for (const admin of admins) {
    await createNotification(
      admin._id.toString(),
      'New Contact Inquiry',
      `You received a new message from ${data.name} (${data.email}).`,
      'system',
      { contactMessageId: message._id }
    );

    // Send email notification to admin
    if (admin.email) {
      emailService.sendMessageNotificationEmail(
        admin.email,
        data.name || 'Anonymous',
        (data.message || '').substring(0, 100),
        `${config.frontendUrl}/dashboard/contact-messages`
      ).catch((err: any) => logger.error(`Failed to send contact inquiry email to ${admin.email}:`, err));
    }
  }

  return message;
};

/**
 * Get all contact messages (with pagination)
 */
export const getContactMessages = async (limit = 20, skip = 0, status?: string) => {
  const query = status ? { status } : {};
  const messages = await ContactMessage.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await ContactMessage.countDocuments(query);
  
  return { messages, total, limit, skip };
};

/**
 * Update message status (e.g., mark as read)
 */
export const updateContactMessageStatus = async (id: string, status: string) => {
  return ContactMessage.findByIdAndUpdate(id, { status }, { new: true });
};
