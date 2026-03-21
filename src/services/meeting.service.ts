import Meeting, { IMeeting } from '../models/meeting.model';
import MeetingMessage from '../models/meetingMessage.model';
import MeetingParticipant from '../models/meetingParticipant.model';
import User from '../models/user.model';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import * as emailService from './email.service';
import { createNotification } from './notification.service';
import logger from '../utils/logger';

/**
 * Schedule a new meeting
 */
export const scheduleMeeting = async (meetingData: any, hostId: string) => {
  const meetingId = uuidv4();
  const roomId = `room_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const meetingLink = `${config.frontendUrl}/dashboard/meeting/${meetingId}`;

  const meeting = await Meeting.create({
    ...meetingData,
    meetingId,
    roomId,
    meetingLink,
    host: hostId,
  });

  // Notify participants
  const sender = await User.findById(hostId);
  for (const participantId of meeting.participants) {
    const participant = await User.findById(participantId);
    if (participant) {
      // Create notification
      await createNotification(
        participantId.toString(),
        'New Meeting Scheduled',
        `You have been invited to a meeting: ${meeting.title}`,
        'alert',
        { meetingId: meeting._id, externalId: meetingId, roomId }
      );

      // Send email
      if (participant.email) {
        const joinLink = meetingLink;
        const startTimeStr = new Date(meeting.startTime).toLocaleString();
        const subject = `Meeting Invitation: ${meeting.title}`;
        const text = `Hi,\n\nYou are invited to a meeting: ${meeting.title}\nTime: ${startTimeStr}\nJoin link: ${joinLink}`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb;">
            <h2 style="color:#3b82f6;text-align:center;">Meeting Invitation</h2>
            <p><strong>${sender?.name || 'Admin'}</strong> has invited you to a video meeting.</p>
            <div style="background:#fff;padding:20px;border-radius:12px;margin:24px 0;">
              <h3 style="margin:0 0 10px 0;">${meeting.title}</h3>
              <p style="margin:0;color:#6b7280;font-size:14px;">${meeting.description || 'No description'}</p>
              <hr style="margin:16px 0;border:none;border-top:1px solid #f3f4f6;" />
              <p style="margin:0;"><strong>Time:</strong> ${startTimeStr}</p>
            </div>
            <div style="text-align:center;">
              <a href="${joinLink}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;box-shadow:0 4px 12px rgba(59,130,246,0.3);">Join Meeting</a>
            </div>
          </div>
        `;
        emailService.sendEmail(participant.email, subject, text, html).catch(err => logger.error('Email failed:', err));
      }
    }
  }

  return meeting;
};

/**
 * Get user's meetings
 */
export const getUserMeetings = async (userId: string) => {
  return Meeting.find({
    $or: [{ host: userId }, { participants: userId }],
  }).sort({ startTime: -1 }).populate('host', 'name email').populate('participants', 'name email');
};

/**
 * Get meeting by its meetingId (UUID)
 */
export const getMeetingByMeetingId = async (meetingId: string) => {
  return Meeting.findOne({ meetingId })
    .populate('host', 'name email')
    .populate('participants', 'name email');
};

/**
 * Update meeting status
 */
export const updateMeetingStatus = async (meetingId: string, status: string) => {
  return Meeting.findByIdAndUpdate(meetingId, { status }, { new: true });
};

/**
 * Start a meeting (set status to active)
 */
export const startMeeting = async (meetingId: string, hostId: string) => {
  const meeting = await Meeting.findOne({ meetingId, host: hostId });
  if (!meeting) return null;
  meeting.status = 'active';
  await meeting.save();
  return meeting;
};

/**
 * End a meeting (set status to completed)
 */
export const endMeeting = async (meetingId: string) => {
  const meeting = await Meeting.findOne({ meetingId });
  if (!meeting) return null;
  meeting.status = 'completed';
  await meeting.save();

  // Mark all active participants as left
  await MeetingParticipant.updateMany(
    { meetingId, isActive: true },
    { isActive: false, leftAt: new Date() }
  );

  return meeting;
};

/**
 * Join meeting - create or update participant record
 */
export const joinMeeting = async (meetingId: string, userId: string) => {
  const existing = await MeetingParticipant.findOne({ meetingId, userId });
  if (existing) {
    existing.isActive = true;
    existing.joinedAt = new Date();
    existing.leftAt = undefined;
    await existing.save();
    return existing;
  }

  return MeetingParticipant.create({
    meetingId,
    userId,
    joinedAt: new Date(),
    isActive: true,
  });
};

/**
 * Leave meeting
 */
export const leaveMeeting = async (meetingId: string, userId: string) => {
  return MeetingParticipant.findOneAndUpdate(
    { meetingId, userId },
    { isActive: false, leftAt: new Date(), hasRaisedHand: false },
    { new: true }
  );
};

/**
 * Get active participants in a meeting
 */
export const getActiveParticipants = async (meetingId: string) => {
  return MeetingParticipant.find({ meetingId, isActive: true })
    .populate('userId', 'name email');
};

/**
 * Update participant state (mute, camera, screen share, raise hand)
 */
export const updateParticipantState = async (
  meetingId: string,
  userId: string,
  update: Partial<{ isMuted: boolean; isCameraOff: boolean; isScreenSharing: boolean; hasRaisedHand: boolean }>
) => {
  return MeetingParticipant.findOneAndUpdate(
    { meetingId, userId },
    update,
    { new: true }
  );
};

/**
 * Save meeting chat message
 */
export const saveMeetingMessage = async (
  meetingId: string,
  senderId: string,
  content: string,
  type: 'text' | 'file' | 'system' = 'text',
  fileUrl?: string,
  fileName?: string
) => {
  const message = await MeetingMessage.create({
    meetingId,
    sender: senderId,
    content,
    type,
    fileUrl,
    fileName,
  });
  return message.populate('sender', 'name email');
};

/**
 * Get meeting chat messages
 */
export const getMeetingMessages = async (meetingId: string, limit = 100, skip = 0) => {
  return MeetingMessage.find({ meetingId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'name email');
};

/**
 * Check if a user is authorized to join a meeting
 */
export const isUserAuthorizedForMeeting = async (meetingId: string, userId: string): Promise<boolean> => {
  const meeting = await Meeting.findOne({ meetingId });
  if (!meeting) return false;
  
  const hostMatch = meeting.host.toString() === userId;
  const participantMatch = meeting.participants.some(
    (p: any) => p.toString() === userId
  );
  
  return hostMatch || participantMatch;
};

/**
 * Get meeting history with participant count
 */
export const getMeetingHistory = async (userId: string, limit = 20, skip = 0) => {
  return Meeting.find({
    $or: [{ host: userId }, { participants: userId }],
    status: { $in: ['completed', 'cancelled'] },
  })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .populate('host', 'name email')
    .populate('participants', 'name email');
};

/**
 * Get all active meetings (admin)
 */
export const getActiveMeetings = async () => {
  return Meeting.find({ status: 'active' })
    .populate('host', 'name email')
    .populate('participants', 'name email');
};
