import CallLog, { ICallLog } from '../models/callLog.model';

/**
 * Log a new call attempt
 */
export const initiateCall = async (callerId: string, receiverId: string, type: 'voice' | 'video' = 'voice') => {
  return CallLog.create({
    caller: callerId,
    receiver: receiverId,
    type,
    status: 'ongoing',
  });
};

/**
 * End a call and update duration
 */
export const endCall = async (callId: string, status: 'completed' | 'missed' | 'rejected') => {
  const call = await CallLog.findById(callId);
  if (!call) return null;

  call.status = status;
  call.endTime = new Date();
  call.duration = Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);
  
  return call.save();
};

/**
 * Get call history for a user
 */
export const getCallHistory = async (userId: string) => {
  return CallLog.find({
    $or: [{ caller: userId }, { receiver: userId }],
  })
    .sort({ startTime: -1 })
    .populate('caller', 'name avatar phoneNumber')
    .populate('receiver', 'name avatar phoneNumber');
};
