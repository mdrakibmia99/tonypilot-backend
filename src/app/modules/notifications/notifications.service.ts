import { Query, Types } from 'mongoose';
import AppError from '../../error/AppError';
import httpStatus from 'http-status';
import Notification from './notifications.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { emitNotification } from '../../../socketIo';
import { INotification } from './notifications.interface';
import { IJwtPayload } from '../auth/auth.interface';
import { User } from '../user/user.models';
import { USER_ROLE } from '../user/user.constants';



const createNotification = async (userId: string, payload: INotification) => {
  const getReceiverUser = await User.findById(payload.receiverId);
  if (!getReceiverUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const newNotification = await emitNotification({
    senderId: userId as any,
    receiverId: payload.receiverId,
    message: payload.message,
    type: payload.type
  })
  return newNotification;
};

// const getAllNotifications = async (query: Record<string, unknown>) => {
//   // You can implement a query builder like in your `userService` for pagination, filtering, etc.
//   const notifications = await Notification.find(query);
//   return notifications;
// };

const getMyNotifications = async (
  userId: string,
  query: Record<string, unknown>,
) => {


  const notificationQuery = new QueryBuilder(
    Notification.find({ receiverId: userId }).sort({
      createdAt: -1,
    }),
    query,
  ).paginate().fields();
  // const notification = await notificationQuery.modelQuery;
  // const meta = await notificationQuery.countTotal();
  const [notification, meta] = await Promise.all([
    notificationQuery.modelQuery,
    notificationQuery.countTotal()
  ])

  return { notification, meta };
};

const getMyUnReadNotifications = async (userId: string, role: string) => {
  
  const unreadCount = await Notification.countDocuments({
    receiverId: userId,
    isRead: false,
  });
  return { unreadCount };
};


const markAsRead = async (id: string) => {
  const notification = await Notification.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true },
  );

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Notification not found');
  }

  return notification;
};

const markAllAsRead = async (receiverId: string, role: string) => {
  const parameter = (role === USER_ROLE.ADMIN || role === USER_ROLE.SUPER_ADMIN) ? { receiverRole: role, isRead: false } : { receiverId, isRead: false };
  const result = await Notification.updateMany(
    parameter, // Only update unread notifications
    { $set: { isRead: true } },
  );

  if (result.modifiedCount === 0) {
    throw new AppError(httpStatus.NOT_FOUND, 'No unread notifications found');
  }

  return;
};

const deleteNotification = async (notificationId: string, userId: string, role: string) => {

  const parameter = (role === USER_ROLE.ADMIN || role === USER_ROLE.SUPER_ADMIN) ? { _id: notificationId } : { _id: notificationId, receiverId: userId };

  const notification = await Notification.findOneAndDelete(parameter);
  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, 'Notification not found');
  }
  return;
};

export const notificationService = {
  createNotification,
  // getAllNotifications,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getMyUnReadNotifications,
};
