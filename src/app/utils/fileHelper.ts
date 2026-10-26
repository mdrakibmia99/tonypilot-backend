import fs from 'fs';
import util from 'util';
import config from '../config';
import { s3Helper } from '../helpers/s3Helper';
const unlinkSync = util.promisify(fs.unlink);
export const deleteFile = async (path: string) => {
  try {
    if (fs.existsSync(`../public/${path}`)) {
      await unlinkSync(`../public/${path}`);
    } else {
      console.log('not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    throw new Error(`Error deleting file: ${err.message}`);
  }
};

// export const storeFile = (folderName: string, filename: string) => {
//   return `/uploads/${folderName}/${filename}`;
// };

// // this is use for muiltiple fields file upload
// export const storeFiles = (
//   folderName: string,
//   files: { [fieldName: string]: Express.Multer.File[] }
// ): { [fieldName: string]: string[] } => {
//   if (!folderName || !files) {
//     throw new Error('Both folderName and files are required.');
//   }

//   const sanitizedFolder = folderName.replace(/\/+$/, ''); // Remove trailing slashes
//   const result: { [fieldName: string]: string[] } = {};

//   // Use Object.entries to iterate over the files object
//   Object.entries(files).forEach(([fieldName, fileArray]) => {
//     // Map each file in the field to its generated path
//     result[fieldName] = fileArray.map((file) => {
//       const sanitizedFilename = file.filename.replace(/^\/+/, ''); // Remove leading slashes
//       return `/uploads/${sanitizedFolder}/${sanitizedFilename}`;
//     });
//   });

//   return result;
// };

export const storeFile = async (
  folderName: string,
  file: Express.Multer.File
): Promise<string> => {
  if (config.storage_provider === 's3') {
    const uploaded = await s3Helper.uploadToS3(file, folderName);
    return uploaded.url;
  }
console.log('store file ->>> ', folderName, file)
  return `/uploads/${folderName}/${file.filename}`;
};

export const storeFiles = async (
  folderName: string,
  files: { [fieldName: string]: Express.Multer.File[] }
): Promise<{ [fieldName: string]: string[] }> => {
  if (config.storage_provider !== 's3') {
    const result: { [fieldName: string]: string[] } = {};

    Object.entries(files).forEach(([fieldName, fileArray]) => {
      console.log('storeFiles ->>> ', folderName, fileArray)
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