import fs from 'fs';
import util from 'util';
import config from '../config';
import { s3Helper } from '../helpers/s3Helper';
const unlinkSync = util.promisify(fs.unlink);
export const deleteFile = async (path: string) => {
  try {
    if (fs.existsSync(`../public/${path}`)) {
      await unlinkSync(`../public/${path}`);
    } 
  } catch (err: any) {
    throw new Error(`Error deleting file: ${err.message}`);
  }
};


export const storeFile = async (
  folderName: string,
  file: Express.Multer.File
): Promise<string> => {
  if (config.storage_provider === 's3') {
    const uploaded = await s3Helper.uploadToS3(file, folderName);
    return uploaded.url;
  }
  return `/uploads/${folderName}/${file.filename}`;
};

export const storeFiles = async (
  folderName: string,
  files: { [fieldName: string]: Express.Multer.File[] }
): Promise<{ [fieldName: string]: string[] }> => {
  if (config.storage_provider !== 's3') {
    const result: { [fieldName: string]: string[] } = {};

    Object.entries(files).forEach(([fieldName, fileArray]) => {
      result[fieldName] = fileArray.map(
        (file) => `/uploads/${folderName}/${file.filename}`
      );
    });

    return result;
  }

  const result: { [fieldName: string]: string[] } = {};

  for (const [fieldName, fileArray] of Object.entries(files)) {
    result[fieldName] = await Promise.all(
      fileArray.map(async (file) => {
        const uploaded = await s3Helper.uploadToS3(file, folderName);
        return uploaded.url;
      })
    );
  }

  return result;
};