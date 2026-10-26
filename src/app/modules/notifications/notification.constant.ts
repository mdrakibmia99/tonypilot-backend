export const NOTIFICATION_TYPE = {
  LIKE: 'like',
  COMMENT: 'comment',
  AUDITION_REMINDER: 'audition_reminder',
  NEW_MESSAGE: 'new_message',
} as const;

export type NOTIFICATION_INTERFACE = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

export const NOTIFICATION_ENUM = Object.values(NOTIFICATION_TYPE);

