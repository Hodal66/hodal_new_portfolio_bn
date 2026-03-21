import mongoose, { Schema, Document } from 'mongoose';

export interface IMeetingMessage extends Document {
  meetingId: string;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'file' | 'system';
  fileUrl?: string;
  fileName?: string;
  createdAt: Date;
}

const meetingMessageSchema = new Schema(
  {
    meetingId: { type: String, required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'file', 'system'],
      default: 'text',
    },
    fileUrl: { type: String },
    fileName: { type: String },
  },
  { timestamps: true }
);

meetingMessageSchema.index({ meetingId: 1, createdAt: -1 });

const MeetingMessage = mongoose.model<IMeetingMessage>('MeetingMessage', meetingMessageSchema);
export default MeetingMessage;
