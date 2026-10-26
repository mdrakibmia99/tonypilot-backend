import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ChatService } from './chat.service';

const createOrGetSingleChat = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await ChatService.createOrGetSingleChat(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Conversation retrieved successfully',
    data: result,
  });
});

const createGroupChat = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const result = await ChatService.createGroupChat(adminId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Group chat created successfully',
    data: result,
  });
});

const getMyChats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const result = await ChatService.getMyChats(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Conversations retrieved successfully',
    data: result,
  });
});

const getChatById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const chatId = req.params.chatId as string;
  const result = await ChatService.getChatById(chatId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat details fetched successfully',
    data: result,
  });
});

const clearChatHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const chatId = req.params.chatId as string;
  const result = await ChatService.clearChatHistory(chatId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat history cleared successfully',
    data: result,
  });
});

const updateGroupChat = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const chatId = req.params.chatId as string;
  const result = await ChatService.updateGroupChat(chatId, userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group chat updated successfully',
    data: result,
  });
});

const addGroupMember = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const chatId = req.params.chatId as string;
  const { memberId } = req.body;
  const result = await ChatService.addGroupMember(chatId, adminId, memberId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Member added to group successfully',
    data: result,
  });
});

const removeGroupMember = catchAsync(async (req: Request, res: Response) => {
  const requestingUserId = req.user.userId;
  const chatId = req.params.chatId as string;
  const { memberId } = req.body;
  const result = await ChatService.removeGroupMember(chatId, requestingUserId, memberId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Group member removed successfully',
    data: result,
  });
});

export const ChatController = {
  createOrGetSingleChat,
  createGroupChat,
  getMyChats,
  getChatById,
  clearChatHistory,
  updateGroupChat,
  addGroupMember,
  removeGroupMember,
};
