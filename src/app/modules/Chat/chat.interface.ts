import { Types } from 'mongoose';

export interface IUserChatVisibility {
  user: Types.ObjectId;
  clearedAt: Date;
}

export interface IChat {
  _id: Types.ObjectId;
  isGroupChat: boolean;
  name?: string;
  groupAvatar?: string;
  groupAdmin?: Types.ObjectId;
  participants: Types.ObjectId[];
  lastMessage?: Types.ObjectId;
  unreadCounts: Map<string, number>;
  userChatVisibility: IUserChatVisibility[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateSingleChatPayload {
  recipientId: string;
}

export interface ICreateGroupChatPayload {
  name: string;
  participants: string[];
  groupAvatar?: string;
}

export interface IUpdateGroupChatPayload {
  name?: string;
  groupAvatar?: string;
}

export interface IGroupMemberPayload {
  memberId: string;
}

export interface IChatParticipantSummary {
  _id: string;
  fullName: string;
  email: string;
  profileImage?: string;
  phone?: string;
  isOnline: boolean;
}

export interface IChatLastMessageSummary {
  _id: string;
  content: string;
  sender: {
    _id: string;
    fullName: string;
    profileImage?: string;
  };
  isDeletedForEveryone: boolean;
  createdAt: Date;
}

export interface IChatListItem {
  _id: string;
  isGroupChat: boolean;
  name?: string;
  groupAvatar?: string;
  groupAdmin?: string;
  participants: IChatParticipantSummary[];
  otherParticipant?: IChatParticipantSummary;
  lastMessage?: IChatLastMessageSummary | null;
  unreadCount: number;
  updatedAt: Date;
  createdAt: Date;
}
