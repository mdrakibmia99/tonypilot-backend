import {
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';
import path from 'path';

import config from '../config';

const s3Client =
  config.storage_provider === 's3'
    ? new S3Client({
        region: config.aws.region,
        maxAttempts: 3,
        credentials: {
          accessKeyId: config.aws.access_key_id as string,
          secretAccessKey: config.aws.secret_access_key as string,
        },
      })
    : null;

const getS3Client = (): S3Client => {
  if (!s3Client) {
    throw new Error('S3 storage provider is not configured.');
  }

  return s3Client;
};

const sanitizeFolder = (folder: string): string => {
  return folder.replace(/[^a-zA-Z0-9/_-]/g, '');
};

const generateFileName = (
  originalName: string,
  folder: string
): string => {
  const ext = path.extname(originalName);
  return `${sanitizeFolder(folder)}/${crypto.randomUUID()}${ext}`;
};

export interface IS3UploadResponse {
  key: string;
  url: string;
}

export const uploadToS3 = async (
  file: Express.Multer.File,
  folder = 'uploads'
): Promise<IS3UploadResponse> => {
  if (!file) {
    throw new Error('File is required.');
  }

  if (!file.buffer) {
    throw new Error('File buffer is missing.');
  }

  const key = generateFileName(file.originalname, folder);

  const upload = new Upload({
    client: getS3Client(),
    params: {
      Bucket: config.aws.s3_bucket_name as string,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'max-age=31536000',
    },
  });

  await upload.done();

  const baseUrl =
    config.aws.base_url ||
    `https://${config.aws.s3_bucket_name}.s3.${config.aws.region}.amazonaws.com`;

  return {
    key,
    url: `${baseUrl}/${key}`,
  };
};

export const uploadMultipleToS3 = async (
  files: Express.Multer.File[],
  folder = 'uploads'
): Promise<IS3UploadResponse[]> => {
  return Promise.all(files.map((file) => uploadToS3(file, folder)));
};

export const deleteFromS3 = async (
  fileUrlOrKey: string
): Promise<void> => {
  try {
    let key = fileUrlOrKey;

    if (fileUrlOrKey.startsWith('http')) {
      const url = new URL(fileUrlOrKey);
      key = decodeURIComponent(url.pathname.substring(1));
    }

    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: config.aws.s3_bucket_name as string,
        Key: key,
      })
    );
  } catch (error) {
    console.error('S3 Delete Error:', error);
  }
};

export const s3Helper = {
  uploadToS3,
  uploadMultipleToS3,
  deleteFromS3,
};