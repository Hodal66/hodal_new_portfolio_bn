import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as messageService from '../services/message.service';
import * as contactService from '../services/contactMessage.service';
import * as notificationService from '../services/notification.service';
import * as fileService from '../services/file.service';
import ApiError from '../utils/ApiError';

import { sendContactNotification } from '../services/email.service';

/**
 * Submit contact form
 */
export const submitContact = catchAsync(async (req, res) => {
  const message = await contactService.submitContactMessage(req.body);
  
  // Notify admin and confirm to user asynchronously
  sendContactNotification(req.body).catch(err => {
    console.error('Unified Contact Notification Failed:', err);
  });

  res.status(httpStatus.CREATED).send(message);
});

/**
 * Admin view contact messages
 */
export const getAdminContactMessages = catchAsync(async (req, res) => {
  const result = await contactService.getContactMessages(
    Number(req.query.limit) || 20,
    Number(req.query.skip) || 0,
    req.query.status as string
  );
  res.send(result);
});

/**
 * Admin update contact message status (read/archived)
 */
export const updateContactStatus = catchAsync(async (req, res) => {
  const message = await contactService.updateContactMessageStatus(req.params.id, req.body.status);
  if (!message) throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
  res.send(message);
});

/**
 * User/Admin - Get conversations list (Inbox)
 */
export const getInboxes = catchAsync(async (req, res) => {
  const result = await messageService.getUserConversations((req as any).user._id);
  res.send(result);
});

/**
 * User/Admin - Start a conversation
 */
export const startConversation = catchAsync(async (req, res) => {
  const { recipientId } = req.body;
  const userId = (req as any).user._id;

  const conversation = await messageService.getOrCreateConversation(userId, recipientId);
  res.status(httpStatus.CREATED).send(conversation);
});

/**
 * User/Admin - Send message
 */
export const sendNewMessage = catchAsync(async (req, res) => {
  const { conversationId, content, recipientId, attachments } = req.body;
  const userId = (req as any).user._id;

  let targetConversationId = conversationId;

  // If no conversationId but recipientId provided, find or create
  if (!targetConversationId && recipientId) {
    const conversation = await messageService.getOrCreateConversation(userId, recipientId);
    targetConversationId = conversation._id;
  }

  if (!targetConversationId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Conversation ID or Recipient ID is required');
  }

  const message = await messageService.sendMessage(targetConversationId, userId, content, attachments);
  res.status(httpStatus.CREATED).send(message);
});

/**
 * User/Admin - Mark conversation as read
 */
export const markAsRead = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const userId = (req as any).user._id;

  await messageService.markConversationAsRead(conversationId, userId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * User/Admin - Upload file
 */
export const uploadFile = catchAsync(async (req: any, res: Response) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  const userId = req.user._id;
  const mime = req.file.mimetype;
  let category: 'image' | 'document' | 'video' | 'audio' | 'other' = 'other';
  if (mime.startsWith('image/')) category = 'image';
  else if (mime.startsWith('audio/')) category = 'audio';
  else if (mime.startsWith('video/')) category = 'video';
  else if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) category = 'document';
  
  const file = await fileService.processFileUpload(req.file, userId, category);
  res.status(httpStatus.CREATED).send(file);
});

/**
 * User/Admin - Get conversation history
 */
export const getConversationDetails = catchAsync(async (req, res) => {
  const result = await messageService.getConversationMessages(
    req.params.conversationId,
    Number(req.query.limit) || 50,
    Number(req.query.skip) || 0
  );
  res.send(result);
});

/**
 * User - Fetch notifications
 */
export const getNotifications = catchAsync(async (req, res) => {
  const result = await notificationService.getUnreadNotifications((req as any).user._id);
  res.send(result);
});

/**
 * User - Mark notification as read
 */
export const markNotificationRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAsRead(req.params.id, (req as any).user._id);
  if (!result) throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
  res.send(result);
});
