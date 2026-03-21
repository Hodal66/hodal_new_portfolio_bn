import mongoose, { Schema, Document } from 'mongoose';

export interface IMeetingParticipant extends Document {
  meetingId: string;
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  hasRaisedHand: boolean;
}

const meetingParticipantSchema = new Schema(
  {
    meetingId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isMuted: { type: Boolean, default: false },
    isCameraOff: { type: Boolean, default: false },
    isScreenSharing: { type: Boolean, default: false },
    hasRaisedHand: { type: Boolean, default: false },
  },
  { timestamps: true }
);

meetingParticipantSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

const MeetingParticipant = mongoose.model<IMeetingParticipant>('MeetingParticipant', meetingParticipantSchema);
export default MeetingParticipant;
