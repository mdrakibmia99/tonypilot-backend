import { isUserOnline as checkUserOnline } from '../../socket';

export const isUserOnline = async (userId: string): Promise<boolean> => {
  return await checkUserOnline(userId.toString());
};