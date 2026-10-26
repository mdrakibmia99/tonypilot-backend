import { Request } from 'express';
import fs from 'fs';
import multer from 'multer';
import config from '../config';

const fileUpload = (uploadDirectory: string) => {
  console.log('config.storage_provider', config.storage_provider);
  let storage: multer.StorageEngine;

  if (config?.storage_provider === 's3') {
    storage = multer.memoryStorage();
  } else {
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }

    storage = multer.diskStorage({
      destination: (req: Request, file, cb) => {
        if (file.fieldname === 'introVideo' || file.fieldname === 'video') {
          const videoDir = './public/uploads/video';

          if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir, { recursive: true });
          }

          cb(null, videoDir);
        } else {
          cb(null, uploadDirectory);
        }
      },

      filename: (req: Request, file, cb) => {
        const uniqueSuffix =
          Date.now() + '-' + Math.round(Math.random() * 1e9);

        const extension = file.originalname.split('.').pop();

        const fileName = `${file.fieldname}-${uniqueSuffix}.${extension}`;

        cb(null, fileName);
      },
    });
  }

  return multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (req: Request, file, cb) => {
      const allowedMimeTypes = [
        // Images
        'image/png',
        'image/jpg',
        'image/jpeg',
        'image/svg',
        'image/svg+xml',
        'image/webp',

        // Videos
        'video/mp4',
        'video/avi',
        'video/mov',
        'video/mkv',

        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

        // Audio
        'audio/mpeg',
        'audio/wav',
        'audio/x-wav',
        'audio/webm',
        'audio/ogg',
        'audio/mp4',
        'audio/aac',

        // Optional
        'application/octet-stream',
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type!'));
      }
    },
  });
};

export default fileUpload;