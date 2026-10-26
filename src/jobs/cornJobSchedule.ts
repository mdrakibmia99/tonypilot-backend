import cron from "node-cron";
import { User } from "../app/modules/user/user.models";
import { USER_ROLE } from "../app/modules/user/user.constants";

import { emitNotification } from "../socketIo";
import { NOTIFICATION_TYPE } from "../app/modules/notifications/notification.constant";




// Runs every 10 minutes
export const startScheduler = (): void => {
    // cron.schedule('*/5 * * * * *', async () => {
    cron.schedule("0 0 1 * *", async () => {
        try {
            const result = await User.updateMany(
                { role: USER_ROLE.USER },
                {
                    $set: { scriptGeneratedCount: 0 },
                }
            );

            console.log(`monthly cron: Updated ${result.modifiedCount} users`);
        } catch (error) {
            console.error("monthly cron error:", error);
        }
    });



};
