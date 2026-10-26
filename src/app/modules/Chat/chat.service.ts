import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import { User } from '../user/user.models';
import { Chat } from './chat.model';
import {
  ICreateGroupChatPayload,
  ICreateSingleChatPayload,
  IUpdateGroupChatPayload,
  IChatListItem,
  IChatParticipantSummary,
  IChatLastMessageSummary,
} from './chat.interface';
import { RedisService } from '../../redis';
import { isUserOnline } from '../../../socket';

const CHAT_LIST_CACHE_TTL = 180; // 3 minutes

const getChatListCacheKey = (userId: string) => `chat:list:${userId}`;

/**
 * Creates a new 1-on-1 chat or returns existing active chat.
 */
const createOrGetSingleChat = async (userId: string, payload: ICreateSingleChatPayload) => {
  const { recipientId } = payload;

  if (userId === recipientId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot initiate a chat with yourself');
  }

  const recipientExists = await User.findById(recipientId).select('_id').lean();
  if (!recipientExists) {
    throw new AppError(httpStatus.NOT_FOUND, 'Recipient user not found');
  }

  const userObjectId = new Types.ObjectId(userId);
  const recipientObjectId = new Types.ObjectId(recipientId);

  // Check if a direct 1-to-1 chat already exists between these two users
  const existingChat = await Chat.findOne({
    isGroupChat: false,
    participants: { $all: [userObjectId, recipientObjectId], $size: 2 },
  })
    .populate('participants', 'fullName email profileImage phone')
    .populate('lastMessage')
    .lean();

  if (existingChat) {
    return existingChat;
  }

  // Create new single conversation
  const unreadMap = new Map<string, number>();
  unreadMap.set(userId, 0);
  unreadMap.set(recipientId, 0);

  const newChat = await Chat.create({
    isGroupChat: false,
    participants: [userObjectId, recipientObjectId],
    unreadCounts: unreadMap,
    userChatVisibility: [],
  });

  const populatedChat = await Chat.findById(newChat._id)
    .populate('participants', 'fullName email profileImage phone')
    .lean();

  // Invalidate cached chat lists for both participants
  await Promise.all([
    RedisService.del(getChatListCacheKey(userId)),
    RedisService.del(getChatListCacheKey(recipientId)),
  ]);

  return populatedChat;
};

/**
 * Creates a new Group Chat with specified members and admin.
 */
const createGroupChat = async (adminId: string, payload: ICreateGroupChatPayload) => {
  const { name, participants, groupAvatar } = payload;

  // Combine admin and participants, eliminating duplicates
  const uniqueParticipantIds = Array.from(new Set([adminId, ...participants]));

  if (uniqueParticipantIds.length < 3) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'A group chat requires at least 3 participants (including the admin)'
    );
  }

  // Verify all participants exist in database
  const verifiedUsersCount = await User.countDocuments({
    _id: { $in: uniqueParticipantIds },
  });

  if (verifiedUsersCount !== uniqueParticipantIds.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'One or more participant IDs are invalid');
  }

  const participantObjectIds = uniqueParticipantIds.map((id) => new Types.ObjectId(id));
  const adminObjectId = new Types.ObjectId(adminId);

  const unreadMap = new Map<string, number>();
  uniqueParticipantIds.forEach((id) => unreadMap.set(id, 0));

  const newGroupChat = await Chat.create({
    isGroupChat: true,
    name,
    groupAvatar: groupAvatar || '',
    groupAdmin: adminObjectId,
    participants: participantObjectIds,
    unreadCounts: unreadMap,
    userChatVisibility: [],
  });

  const populatedGroup = await Chat.findById(newGroupChat._id)
    .populate('participants', 'fullName email profileImage phone')
    .populate('groupAdmin', 'fullName email profileImage')
    .lean();

  // Invalidate chat list caches for all group members
  await Promise.all(
    uniqueParticipantIds.map((memberId) => RedisService.del(getChatListCacheKey(memberId)))
  );

  return populatedGroup;
};

/**
 * Messenger-style Chat List:
 * - Populates other user or group info
 * - Shows lastMessage details
 * - Checks Redis online presence in real-time
 * - Hides chats cleared by user unless new messages arrived after clearedAt
 */
const getMyChats = async (userId: string): Promise<IChatListItem[]> => {
  const cacheKey = getChatListCacheKey(userId);

  // 1. Try serving from Redis cache
  const cachedList = await RedisService.get<IChatListItem[]>(cacheKey);
  if (cachedList) {
    // Dynamic real-time presence check on cached participants
    const presenceUpdated = await Promise.all(
      cachedList.map(async (chat) => {
        if (!chat.isGroupChat && chat.otherParticipant) {
          const online = await isUserOnline(chat.otherParticipant._id);
          return {
            ...chat,
            otherParticipant: {
              ...chat.otherParticipant,
              isOnline: online,
            },
          };
        }
        return chat;
      })
    );
    return presenceUpdated;
  }

  const userObjectId = new Types.ObjectId(userId);

  // 2. Fetch all chats where user is participant, sorted by recent activity
  const chats = await Chat.find({
    participants: userObjectId,
  })
    .populate({
      path: 'participants',
      select: 'fullName email profileImage phone',
    })
    .populate({
      path: 'lastMessage',
      select: 'content sender createdAt isDeletedForEveryone',
      populate: {
        path: 'sender',
        select: 'fullName profileImage',
      },
    })
    .sort({ updatedAt: -1 })
    .lean();

  // 3. Process each chat with visibility filter, unread counts, and online presence
  const processedChats: (IChatListItem | null)[] = await Promise.all(
    chats.map(async (chat) => {
      // Check user clear/deletion timestamp
      const visibilityEntry = chat.userChatVisibility?.find(
        (v) => v.user.toString() === userId
      );

      const clearedAt = visibilityEntry ? new Date(visibilityEntry.clearedAt) : null;
      const lastMessage = chat.lastMessage as any;

      // If user cleared the chat, hide it unless a message arrived AFTER clearedAt
      if (clearedAt) {
        if (!lastMessage) return null;
        const lastMessageCreatedAt = new Date(lastMessage.createdAt);
        if (lastMessageCreatedAt <= clearedAt) {
          return null; // Suppress cleared conversation from list
        }
      }

      // Format participants
      const participantsSummary: IChatParticipantSummary[] = await Promise.all(
        (chat.participants as any[]).map(async (p) => {
          const online = await isUserOnline(p._id.toString());
          return {
            _id: p._id.toString(),
            fullName: p.fullName || 'User',
            email: p.email || '',
            profileImage: p.profileImage,
            phone: p.phone,
            isOnline: online,
          };
        })
      );

      // Determine the counterpart for direct 1-to-1 messaging
      const otherParticipant = !chat.isGroupChat
        ? participantsSummary.find((p) => p._id !== userId)
        : undefined;

      // Unread count computation
      const unreadMap = chat.unreadCounts as any;
      let unreadCount = 0;
      if (unreadMap) {
        unreadCount =
          typeof unreadMap.get === 'function'
            ? unreadMap.get(userId) || 0
            : unreadMap[userId] || 0;
      }

      // Format last message preview (handling deleted-for-everyone masking)
      let formattedLastMessage: IChatLastMessageSummary | null = null;
      if (lastMessage) {
        formattedLastMessage = {
          _id: lastMessage._id.toString(),
          content: lastMessage.isDeletedForEveryone
            ? 'This message was deleted'
            : lastMessage.content || '',
          sender: {
            _id: lastMessage.sender?._id?.toString() || '',
            fullName: lastMessage.sender?.fullName || 'User',
            profileImage: lastMessage.sender?.profileImage,
          },
          isDeletedForEveryone: Boolean(lastMessage.isDeletedForEveryone),
          createdAt: lastMessage.createdAt,
        };
      }

      const item: IChatListItem = {
        _id: chat._id.toString(),
        isGroupChat: chat.isGroupChat,
        name: chat.name,
        groupAvatar: chat.groupAvatar,
        groupAdmin: chat.groupAdmin?.toString(),
        participants: participantsSummary,
        otherParticipant,
        lastMessage: formattedLastMessage,
        unreadCount,
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
      };

      return item;
    })
  );

  // Filter out cleared/null items
  const validChats = processedChats.filter((c): c is IChatListItem => c !== null);

  // 4. Cache in Redis
  await RedisService.set(cacheKey, validChats, CHAT_LIST_CACHE_TTL);

  return validChats;
};

/**
 * Retrieves a single Chat by ID with authorization verification.
 */
const getChatById = async (chatId: string, userId: string) => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat ID format');
  }

  const chat = await Chat.findById(chatId)
    .populate('participants', 'fullName email profileImage phone')
    .populate('groupAdmin', 'fullName email profileImage')
    .populate('lastMessage')
    .lean();

  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  const isParticipant = chat.participants.some((p: any) => p._id.toString() === userId);
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not a participant in this conversation');
  }

  return chat;
};

/**
 * Clears conversation history for the current user.
 * Sets `clearedAt: new Date()` in userChatVisibility and resets unread count.
 * Previous messages become hidden to this user, but other participants retain full history.
 */
const clearChatHistory = async (chatId: string, userId: string) => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat ID');
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  const isParticipant = chat.participants.some((p) => p.toString() === userId);
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not a member of this chat');
  }

  const now = new Date();
  const existingVisibilityIndex = chat.userChatVisibility.findIndex(
    (v) => v.user.toString() === userId
  );

  if (existingVisibilityIndex >= 0) {
    chat.userChatVisibility[existingVisibilityIndex].clearedAt = now;
  } else {
    chat.userChatVisibility.push({
      user: new Types.ObjectId(userId),
      clearedAt: now,
    });
  }

  // Reset unread count for this user
  if (chat.unreadCounts) {
    chat.unreadCounts.set(userId, 0);
  }

  await chat.save();

  // Invalidate Redis caches
  await Promise.all([
    RedisService.del(getChatListCacheKey(userId)),
    RedisService.delByPattern(`chat:${chatId}:messages:*`),
  ]);

  return { clearedAt: now };
};

/**
 * Updates Group Chat details (Name, Avatar). Only groupAdmin can perform this.
 */
const updateGroupChat = async (
  chatId: string,
  userId: string,
  payload: IUpdateGroupChatPayload
) => {
  if (!Types.ObjectId.isValid(chatId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat ID');
  }

  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Group chat not found');
  }

  if (chat.groupAdmin?.toString() !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only the group admin can update group details');
  }

  if (payload.name) chat.name = payload.name;
  if (payload.groupAvatar !== undefined) chat.groupAvatar = payload.groupAvatar;

  await chat.save();

  const updatedChat = await Chat.findById(chatId)
    .populate('participants', 'fullName email profileImage phone')
    .populate('groupAdmin', 'fullName email profileImage')
    .lean();

  // Invalidate chat list caches for all members
  await Promise.all(
    chat.participants.map((memberId) =>
      RedisService.del(getChatListCacheKey(memberId.toString()))
    )
  );

  return updatedChat;
};

/**
 * Adds a new member to an existing Group Chat.
 */
const addGroupMember = async (chatId: string, adminId: string, memberId: string) => {
  if (!Types.ObjectId.isValid(chatId) || !Types.ObjectId.isValid(memberId)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat or Member ID');
  }

  const [chat, userToAdd] = await Promise.all([
    Chat.findById(chatId),
    User.findById(memberId).select('_id fullName').lean(),
  ]);

  if (!chat || !chat.isGroupChat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Group chat not found');
  }

  if (chat.groupAdmin?.toString() !== adminId) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only the group admin can add members');
  }

  if (!userToAdd) {
    throw new AppError(httpStatus.NOT_FOUND, 'User to add not found');
  }

  const alreadyMember = chat.participants.some((p) => p.toString() === memberId);
  if (alreadyMember) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User is already a member of this group');
  }

  chat.participants.push(new Types.ObjectId(memberId));
  if (chat.unreadCounts) {
    chat.unreadCounts.set(memberId, 0);
  }

  await chat.save();

  const updatedGroup = await Chat.findById(chatId)
    .populate('participants', 'fullName email profileImage phone')
    .populate('groupAdmin', 'fullName email profileImage')
    .lean();

  // Invalidate all member chat caches
  await Promise.all(
    chat.participants.map((m) => RedisService.del(getChatListCacheKey(m.toString())))
  );

  return updatedGroup;
};

/**
 * Removes a member from a Group Chat.
 * Can be executed by groupAdmin, or a member leaving voluntarily.
 */
const removeGroupMember = async (
  chatId: string,
  requestingUserId: string,
  memberIdToRemove: string
) => {
  if (!Types.ObjectId.isValid(chatId) || !Types.ObjectId.isValid(memberIdToRemove)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid Chat or Member ID');
  }

  const chat = await Chat.findById(chatId);
  if (!chat || !chat.isGroupChat) {
    throw new AppError(httpStatus.NOT_FOUND, 'Group chat not found');
  }

  const isAdmin = chat.groupAdmin?.toString() === requestingUserId;
  const isSelfLeave = requestingUserId === memberIdToRemove;

  if (!isAdmin && !isSelfLeave) {
    throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to remove this member');
  }

  const isMember = chat.participants.some((p) => p.toString() === memberIdToRemove);
  if (!isMember) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User is not a member of this group');
  }

  // If the admin is leaving, transfer admin rights or handle leadership
  if (chat.groupAdmin?.toString() === memberIdToRemove) {
    const remainingParticipants = chat.participants.filter(
      (p) => p.toString() !== memberIdToRemove
    );
    if (remainingParticipants.length > 0) {
      chat.groupAdmin = remainingParticipants[0]; // Assign to next member
    } else {
      chat.groupAdmin = undefined;
    }
  }

  chat.participants = chat.participants.filter((p) => p.toString() !== memberIdToRemove);
  if (chat.unreadCounts) {
    chat.unreadCounts.delete(memberIdToRemove);
  }

  await chat.save();

  // Invalidate caches
  await Promise.all([
    RedisService.del(getChatListCacheKey(memberIdToRemove)),
    ...chat.participants.map((m) => RedisService.del(getChatListCacheKey(m.toString()))),
  ]);

  return { success: true, removedMemberId: memberIdToRemove };
};

export const ChatService = {
  createOrGetSingleChat,
  createGroupChat,
  getMyChats,
  getChatById,
  clearChatHistory,
  updateGroupChat,
  addGroupMember,
  removeGroupMember,
};
