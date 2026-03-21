import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import * as callService from '../services/call.service';

export const startCall = catchAsync(async (req, res) => {
  const callerId = (req as any).user._id;
  const { receiverId, type } = req.body;
  const call = await callService.initiateCall(callerId, receiverId, type);
  res.status(httpStatus.CREATED).send(call);
});

export const finishCall = catchAsync(async (req, res) => {
  const { status } = req.body;
  const call = await callService.endCall(req.params.callId, status);
  res.send(call);
});

export const getHistory = catchAsync(async (req, res) => {
  const userId = (req as any).user._id;
  const history = await callService.getCallHistory(userId);
  res.send(history);
});
