import { INotification } from "../app/modules/notifications/notifications.interface";
import { jobQueue } from "../app/queue";
import { emitNotification } from "../socketIo";

const send = (payload: Partial<INotification>) => {
    jobQueue.add(async () => {
        await emitNotification(payload);
    });
};

export const NotificationJob = {
    send,
};