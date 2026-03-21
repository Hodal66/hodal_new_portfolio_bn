import mongoose, { Schema, Document } from 'mongoose';

export interface ICallLog extends Document {
  caller: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  duration: number; // in seconds
  startTime: Date;
  endTime?: Date;
  status: 'ongoing' | 'completed' | 'missed' | 'rejected';
  type: 'voice' | 'video';
}

const callLogSchema = new Schema(
  {
    caller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    duration: { type: Number, default: 0 },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ['ongoing', 'completed', 'missed', 'rejected'],
      default: 'ongoing',
    },
    type: { type: String, enum: ['voice', 'video'], default: 'voice' },
  },
  { timestamps: true }
);

callLogSchema.index({ caller: 1, receiver: 1, startTime: -1 });

const CallLog = mongoose.model<ICallLog>('CallLog', callLogSchema);
export default CallLog;
