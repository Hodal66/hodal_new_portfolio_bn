import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  title: string;
  message: string;
  isRead: boolean;
  type: string; // 'newUser', 'system', etc.
  createdAt?: Date;
  updatedAt?: Date;
}

const notificationSchema: Schema<INotification> = new Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    type: { type: String, default: 'system' }
  },
  { timestamps: true }
);

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
