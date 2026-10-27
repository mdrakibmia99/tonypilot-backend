import cron from 'node-cron';
import { User } from '../app/modules/user/user.models';
import { USER_ROLE } from '../app/modules/user/user.constants';
import { startDailyAnalyticsJob } from './dailyAnalyticsSnapshot.job';

export const startScheduler = (): void => {
  // 1. Monthly Reset Job
  cron.schedule('0 0 1 * *', async () => {
    try {
      const result = await User.updateMany(
        { role: USER_ROLE.USER },
        {
          $set: { scriptGeneratedCount: 0 },
        },
      );

      console.log(`monthly cron: Updated ${result.modifiedCount} users`);
    } catch (error) {
      console.error('monthly cron error:', error);
    }
  });

  // 2. Daily Analytics Snapshot Job
  startDailyAnalyticsJob();
};
