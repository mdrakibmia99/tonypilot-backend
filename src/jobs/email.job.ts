
import { IEmailPayload } from "../app/interface/common.interface";
import { jobQueue } from "../app/queue";
import { sendEmail } from "../app/utils/mailSender";

const send = (payload: IEmailPayload) => {
    jobQueue.add(async () => {
        await sendEmail(
            payload.to,
            payload.subject,
            payload.html
        );
    });
};

export const EmailJob = {
    send,
};