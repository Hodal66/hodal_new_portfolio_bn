import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as meetingService from '../services/meeting.service';
import ApiError from '../utils/ApiError';

/**
 * Schedule a meeting
 */
export const scheduleMeeting = catchAsync(async (req, res) => {
  const hostId = (req as any).user._id;
  const meeting = await meetingService.scheduleMeeting(req.body, hostId);
  res.status(httpStatus.CREATED).send(meeting);
});

/**
 * Get meetings for current user
 */
export const getMyMeetings = catchAsync(async (req, res) => {
  const userId = (req as any).user._id;
  const meetings = await meetingService.getUserMeetings(userId);
  res.send(meetings);
});

/**
 * Get a single meeting by its meetingId (UUID)
 */
export const getMeeting = catchAsync(async (req, res) => {
  const meeting = await meetingService.getMeetingByMeetingId(req.params.meetingId);
  if (!meeting) throw new ApiError(httpStatus.NOT_FOUND, 'Meeting not found');
  res.send(meeting);
});

/**
 * Update meeting status
 */
export const updateStatus = catchAsync(async (req, res) => {
  const meeting = await meetingService.updateMeetingStatus(req.params.meetingId, req.body.status);
  if (!meeting) throw new ApiError(httpStatus.NOT_FOUND, 'Meeting not found');
  res.send(meeting);
});

/**
 * Join a meeting
 */
export const joinMeeting = catchAsync(async (req, res) => {
  const userId = (req as any).user._id.toString();
  const { meetingId } = req.params;

  // Authorization check
  const authorized = await meetingService.isUserAuthorizedForMeeting(meetingId, userId);
  if (!authorized) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to join this meeting');
  }

  const participant = await meetingService.joinMeeting(meetingId, userId);
  res.send(participant);
});

/**
 * Leave a meeting
 */
export const leaveMeeting = catchAsync(async (req, res) => {
  const userId = (req as any).user._id.toString();
  const { meetingId } = req.params;
  const participant = await meetingService.leaveMeeting(meetingId, userId);
  res.send(participant);
});

/**
 * Get active participants
 */
export const getParticipants = catchAsync(async (req, res) => {
  const participants = await meetingService.getActiveParticipants(req.params.meetingId);
  res.send(participants);
});

/**
 * Get meeting chat messages
 */
export const getMeetingMessages = catchAsync(async (req, res) => {
  const { meetingId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  const skip = parseInt(req.query.skip as string) || 0;
  const messages = await meetingService.getMeetingMessages(meetingId, limit, skip);
  res.send(messages);
});

/**
 * Send chat message in meeting
 */
export const sendMeetingMessage = catchAsync(async (req, res) => {
  const userId = (req as any).user._id.toString();
  const { meetingId } = req.params;
  const { content, type, fileUrl, fileName } = req.body;
  const message = await meetingService.saveMeetingMessage(
    meetingId, userId, content, type, fileUrl, fileName
  );
  res.status(httpStatus.CREATED).send(message);
});

/**
 * Get active meetings (admin)
 */
export const getActiveMeetings = catchAsync(async (req, res) => {
  const meetings = await meetingService.getActiveMeetings();
  res.send(meetings);
});

/**
 * Get meeting history
 */
export const getMeetingHistory = catchAsync(async (req, res) => {
  const userId = (req as any).user._id.toString();
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = parseInt(req.query.skip as string) || 0;
  const meetings = await meetingService.getMeetingHistory(userId, limit, skip);
  res.send(meetings);
});

/**
 * End a meeting
 */
export const endMeeting = catchAsync(async (req, res) => {
  const { meetingId } = req.params;
  const meeting = await meetingService.endMeeting(meetingId);
  if (!meeting) throw new ApiError(httpStatus.NOT_FOUND, 'Meeting not found');
  res.send(meeting);
});
