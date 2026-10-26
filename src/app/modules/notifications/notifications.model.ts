import { Schema, model } from 'mongoose';
import { INotification } from './notifications.interface';
import { NOTIFICATION_ENUM, NOTIFICATION_TYPE } from './notification.constant';


const NotificationSchema = new Schema<INotification>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      title: {
        type: String,
        required: true,
      },
      body: {
        type: String,
        default: '',
      },

    },
 
    type: {
      type: String,
      enum:NOTIFICATION_ENUM,
      default: NOTIFICATION_TYPE.NEW_MESSAGE

    },
    isRead: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);
// 🔹 Indexes
NotificationSchema.index(
  { receiverId: 1, isRead: 1, createdAt: -1 },
  { name: "receiver_unread_createdAt_idx" }
);

NotificationSchema.index(
  { receiverRole: 1, isRead: 1, createdAt: -1 },
  { name: "receiverRole_unread_createdAt_idx" }
);

NotificationSchema.index(
  { senderId: 1, createdAt: -1 },
  { name: "sender_createdAt_idx" }
);
const Notification = model<INotification>('Notification', NotificationSchema);

export default Notification;