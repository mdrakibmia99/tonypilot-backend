import { Schema } from "mongoose";
import { NOTIFICATION_INTERFACE, NOTIFICATION_TYPE } from "./notification.constant";


export interface INotification {
  senderId: Schema.Types.ObjectId;      // Reference to User
  receiverId: Schema.Types.ObjectId;    // Reference to User
  message: {
    title: string;
    body?: string;
  };                                     // Notification message
  type: NOTIFICATION_INTERFACE // Type-safe
  isRead: boolean;                       // Whether the notification is read
  createdAt?: Date;                      // Optional, for sorting / tracking
  updatedAt?: Date;                      // Optional
}


// export const NotificationEnum = [
//   'interested',
//   'notInterested',
//   'SendFollow',
//   'AcceptFollow',
//   'DeclineFollow',
//   'Accepted',
//   'Rejected',
//   'added',
//   'created',
//   'login',
//   'password changed',
//   'deleted',
//   'updated'
// ] as const;

// export enum NotificationType {
//   "NEW_MESSAGE" = "NEW_MESSAGE",
// }
// export type NotificationTypeValue = `${NotificationType}`;