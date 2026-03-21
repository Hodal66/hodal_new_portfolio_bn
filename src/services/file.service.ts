import File, { IFile } from '../models/file.model';
import { uploadToCloudinary } from '../utils/cloudinary';
import mongoose from 'mongoose';

/**
 * Handle file upload and store in DB
 */
export const processFileUpload = async (file: any, userId: string, category: 'image' | 'document' | 'video' | 'audio' | 'other' = 'other') => {
  const result: any = await uploadToCloudinary(file.buffer, 'messaging', file.originalname);

  const fileDoc = await File.create({
    user: userId,
    name: file.originalname,
    originalName: file.originalname,
    url: result.secure_url,
    publicId: result.public_id,
    size: result.bytes,
    format: result.format,
    category,
    folder: 'messaging',
  });

  return fileDoc;
};

/**
 * Get file by ID
 */
export const getFileById = async (id: string) => {
  return File.findById(id);
};
