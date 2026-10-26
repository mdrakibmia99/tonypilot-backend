import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { ChatController } from './chat.controller';
import { ChatValidation } from './chat.validation';

const router = Router();

// Retrieve or initiate a direct 1-to-1 conversation
router.post(
  '/single',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(ChatValidation.createSingleChatZodSchema),
  ChatController.createOrGetSingleChat
);

// Create a new Group Chat
router.post(
  '/group',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(ChatValidation.createGroupChatZodSchema),
  ChatController.createGroupChat
);

// Fetch all conversations for the authenticated user (Messenger-style list)
router.get(
  '/',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  ChatController.getMyChats
);

// Fetch details for a specific conversation
router.get(
  '/:chatId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  ChatController.getChatById
);

// Clear full conversation history for the current user ("Delete / Clear Chat")
router.patch(
  '/:chatId/clear',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  ChatController.clearChatHistory
);

// Update group information (name, avatar - Admin only)
router.patch(
  '/:chatId/group',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(ChatValidation.updateGroupChatZodSchema),
  ChatController.updateGroupChat
);

// Add member to group (Admin only)
router.patch(
  '/:chatId/group/add-member',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(ChatValidation.groupMemberZodSchema),
  ChatController.addGroupMember
);

// Remove member from group (Admin or self-leave)
router.patch(
  '/:chatId/group/remove-member',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(ChatValidation.groupMemberZodSchema),
  ChatController.removeGroupMember
);

export const chatRoutes = router;
