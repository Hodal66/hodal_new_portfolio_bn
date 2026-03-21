import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';
import logger from './logger';

cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

/**
 * Upload a file to Cloudinary
 */
export const uploadToCloudinary = async (fileBuffer: Buffer, folder: string, originalName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: path.parse(originalName).name + '-' + Date.now(),
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};
