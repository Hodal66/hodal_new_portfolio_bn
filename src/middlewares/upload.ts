import multer from 'multer';
import ApiError from '../utils/ApiError';
import httpStatus from 'http-status';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    /^image\/.*/,
    /^audio\/.*/,
    /^video\/.*/,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain'
  ];

  const isAllowed = allowedMimeTypes.some(type => {
    if (type instanceof RegExp) return type.test(file.mimetype);
    return type === file.mimetype;
  });

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new ApiError(httpStatus.BAD_REQUEST, `Invalid file type (${file.mimetype}). Support is provided for images, audio, video, and common documents.`), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit to match frontend
  },
  fileFilter,
});
