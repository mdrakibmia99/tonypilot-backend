import z from "zod";
import { NOTIFICATION_ENUM } from "./notification.constant";

export const notificationSchema = z.object({
    body: z.object({
        receiverId: z.string({ message: "Receiver ID is required" }),
        message: z.object({
            title: z.string().min(1, "Title is required"),
            body: z.string().optional(),
        }),
        type: z.enum(NOTIFICATION_ENUM).optional(),
    })


});

export const notificationValidation = {
    notificationSchema,
};