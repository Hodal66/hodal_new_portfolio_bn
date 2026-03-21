import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  title: string;
  description?: string;
  participants: mongoose.Types.ObjectId[];
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  meetingLink: string;
  meetingId: string;
  host: mongoose.Types.ObjectId;
  roomId: string;
  isRecordingEnabled: boolean;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    meetingLink: { type: String, required: true },
    meetingId: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, unique: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isRecordingEnabled: { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 20 },
  },
  { timestamps: true }
);

meetingSchema.index({ participants: 1, startTime: 1 });
meetingSchema.index({ roomId: 1 });
meetingSchema.index({ status: 1 });

const Meeting = mongoose.model<IMeeting>('Meeting', meetingSchema);
export default Meeting;
