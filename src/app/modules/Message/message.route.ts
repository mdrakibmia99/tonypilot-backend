import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { MessageController } from './message.controller';
import { MessageValidation } from './message.validation';
import fileUpload from '../../middleware/fileUpload';
const upload = fileUpload('./public/uploads/chatDocuments');
const router = Router();

// Send a new message (text or attachments)
router.post(
  '/',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(MessageValidation.sendMessageZodSchema),
  MessageController.sendMessage
);
router.post('/upload-chat-document',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  upload.fields([
    { name: 'uploadChatDocument', maxCount: 5 },
  ]),
  MessageController.uploadChatDocument
)

// Fetch messages for a chat with Cursor-based Pagination
router.get(
  '/:chatId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  MessageController.getMessagesByChatId
);

// Delete message for everyone (Sender or Group Admin only)
router.patch(
  '/:messageId/everyone',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  MessageController.deleteMessageForEveryone
);

// Delete message for me only
router.patch(
  '/:messageId/me',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  MessageController.deleteMessageForMe
);

export const messageRoutes = router;
