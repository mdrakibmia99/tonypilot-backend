import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { MessageService } from './message.service';
import AppError from '../../error/AppError';
import { storeFiles } from '../../utils/fileHelper';

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const senderId = req.user.userId;
  const result = await MessageService.sendMessage(senderId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Message sent successfully',
    data: result,
  });
});

const getMessagesByChatId = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const chatId = req.params.chatId as string;
  const { cursor, limit } = req.query;

  const result = await MessageService.getMessagesByChatId(chatId, userId, {
    cursor: cursor as string | undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Messages fetched successfully',
    data: result,
  });
});

const deleteMessageForEveryone = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const messageId = req.params.messageId as string;
  const result = await MessageService.deleteMessageForEveryone(messageId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message deleted for everyone',
    data: result,
  });
});

const deleteMessageForMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const messageId = req.params.messageId as string;
  const result = await MessageService.deleteMessageForMe(messageId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message deleted for you',
    data: result,
  });
});
const uploadChatDocument = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldName: string]: Express.Multer.File[] } | undefined;
  const chatFiles = files?.uploadChatDocument;

  if (!chatFiles || chatFiles.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Please upload at least one document');
  }

  // 1. Process files using your existing helper
  const filePaths = await storeFiles('chatDocuments', files);

  const storedPaths = filePaths.uploadChatDocument;

  if (!storedPaths || storedPaths.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to store uploaded files');
  }

  // 2. Map files to match your Mongoose Schema / Zod validation structure
  const formattedDocuments = chatFiles.map((file, index) => ({
    url: storedPaths[index],
    fileType: file.mimetype,
    name: file.originalname,
    size: file.size,
  }));

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Chat documents uploaded successfully',
    data: {
      documents: formattedDocuments,
      chatType: 'file',
    },
  });
});
export const MessageController = {
  sendMessage,
  getMessagesByChatId,
  deleteMessageForEveryone,
  deleteMessageForMe,
  uploadChatDocument,
};
