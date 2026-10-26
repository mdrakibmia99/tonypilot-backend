import AppError from "../../error/AppError";
import { User } from "../user/user.models";
import httpStatus from "http-status";
import { ICreateAdmin } from "./admin.interface";
import { USER_ROLE } from "../user/user.constants";
import { adminPasswordSendByEmail } from "../../utils/emailNotification";
import { generateRandomPassword } from "../../utils/adminPasswordGenerator";
import QueryBuilder from "../../builder/QueryBuilder";
import { IJwtPayload } from "../auth/auth.interface";

const blockedUser = async (userData: IJwtPayload, targetId: string) => {
  const singleUser = await User.findById(targetId);
  if (!singleUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }


  if (singleUser.role === USER_ROLE.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'You cannot delete another super admin or yourself.',
    );
  }

  let status = !singleUser.isBlocked;
  const user = await User.findByIdAndUpdate(
    targetId,
    { isBlocked: status },
    { new: true },
  );

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User blocking failed! Please try again.');
  }

  return { status, user };
};
const deleteUser = async (userData: IJwtPayload, targetId: string) => {
  const user = await User.findById(targetId);
  if (!user) throw new Error('User not found');
  if (user.role === USER_ROLE.ADMIN || user.role === USER_ROLE.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'You cannot delete another admin or yourself.',
    );
  }
  if (userData.role !== USER_ROLE.ADMIN && userData.role !== USER_ROLE.SUPER_ADMIN) {
    const updatedUser = await User.findByIdAndUpdate(
      targetId,
      { isDeleted: true },
      { new: true },
    );
    return updatedUser;
  }
  return await User.findByIdAndDelete(targetId);


};







export const adminService = {
  blockedUser,
  deleteUser
};