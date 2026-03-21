import mongoose from 'mongoose';
import Conversation, { IConversation } from '../models/conversation.model';
import Message, { IMessage } from '../models/message.model';
import User from '../models/user.model';
import { emitMessage, emitNotification, getIO } from '../utils/socket';
import { createNotification } from './notification.service';
import * as emailService from './email.service';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Get or create a conversation between a user and the admin(s)
 */
export const getOrCreateConversation = async (userId: string, adminId?: string) => {
  // If no adminId provided, find the primary admin or first admin
  let targetAdminId = adminId;
  if (!targetAdminId) {
    const admin = await User.findOne({ roles: 'admin' });
    if (!admin) throw new Error('No admin user found in system!');
    targetAdminId = admin._id.toString();
  }

  if (userId.toString() === targetAdminId) {
    throw new Error('You cannot start a conversation with yourself');
  }

  // Find existing conversation between the two participants
  let conversation = await Conversation.findOne({
    participants: { $all: [userId, targetAdminId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userId, targetAdminId],
    });
  }

  return conversation.populate('participants', 'name email avatar roles');
};

/**
 * Send a message within a conversation
 */
export const sendMessage = async (
  conversationId: string | mongoose.Types.ObjectId,
  senderId: string | mongoose.Types.ObjectId,
  content: string,
  attachmentIds?: (string | mongoose.Types.ObjectId)[]
) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    content,
    status: 'sent',
    attachments: attachmentIds || [],
  });

  // Update conversation lastMessage and timestamp
  conversation.lastMessage = message._id as mongoose.Types.ObjectId;
  await conversation.save();

  // Populate sender for real-time events & emails
  const populatedMessage = await message.populate([
    { path: 'sender', select: 'name email avatar roles' },
    { path: 'attachments' },
  ]);

  // Notify other participants (not the sender)
  const recipientIds = conversation.participants.filter(p => p.toString() !== senderId.toString());
  const sender = await User.findById(senderId);

  for (const recipientId of recipientIds) {
    const recipientIdStr = recipientId.toString();
    const recipient = await User.findById(recipientId);
    
    // Emit real-time message event
    emitMessage(recipientIdStr, {
      ...populatedMessage.toJSON(),
      conversationId: conversationId.toString(),
    });

    // Create persistent notification
    await createNotification(
      recipientIdStr,
      'New Message',
      `${sender?.name || 'Someone'} sent you a message.`,
      'message',
      { conversationId, messageId: message._id }
    );

    // Send email notification
    if (recipient?.email) {
      const convUrl = `${config.frontendUrl}/dashboard/messages`; // Link to messages page
      emailService.sendMessageNotificationEmail(
        recipient.email,
        sender?.name || 'User',
        content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        convUrl
      ).catch(err => logger.error(`Failed to send message email to ${recipient.email}:`, err));
    }
  }

  return populatedMessage;
};

/**
 * Mark all messages in a conversation as read for a specific user
 */
export const markConversationAsRead = async (conversationId: string, userId: string) => {
  // Update all unread messages in this conversation where the sender is NOT the current user
  const result = await Message.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      isRead: false,
    },
    {
      $set: { isRead: true, status: 'read' },
    }
  );

  // Notify other participants that messages were read
  const conversation = await Conversation.findById(conversationId);
  if (conversation) {
    const others = conversation.participants.filter(p => p.toString() !== userId.toString());
    const io = getIO();
    others.forEach(otherId => {
      io.to(otherId.toString()).emit('messages-read', {
        conversationId,
        readBy: userId,
      });
    });
  }

  return result;
};

/**
 * Update message status (delivered, etc.)
 */
export const updateMessageStatus = async (messageId: string, status: 'delivered' | 'read') => {
  const message = await Message.findByIdAndUpdate(
    messageId,
    { status, isRead: status === 'read' },
    { new: true }
  ).populate('sender', 'name email avatar roles');

  if (!message) return null;

  // Notify sender of status update
  emitMessage(message.sender.toString(), {
    type: 'status_update',
    messageId,
    status,
  });

  return message;
};

/**
 * Get messages in a conversation
 */
export const getConversationMessages = async (conversationId: string, limit = 50, skip = 0) => {
  const messages = await Message.find({ conversation: conversationId })
    .populate('attachments')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const total = await Message.countDocuments({ conversation: conversationId });
  
  return { messages, total, limit, skip };
};

/**
 * Get all conversations for a user (Inbox view)
 */
export const getUserConversations = async (userId: string) => {
  return Conversation.find({ participants: userId })
    .populate('participants', 'name email avatar roles')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'name email avatar roles' }
    })
    .sort({ updatedAt: -1 });
};
