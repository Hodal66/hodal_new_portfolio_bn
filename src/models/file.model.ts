import mongoose, { Schema, Document } from 'mongoose';

export interface IFile extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  originalName: string;
  url: string;
  publicId: string; // Cloudinary public_id
  size: number;
  format: string;
  category: string; // 'document', 'image', 'video'
  folder: string;
  isDeleted: boolean;
}

const fileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    format: {
      type: String,
    },
    category: {
      type: String,
      enum: ['image', 'document', 'video', 'other'],
      default: 'other',
    },
    folder: {
      type: String,
      default: '/',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const File = mongoose.model<IFile>('File', fileSchema);
export default File;
