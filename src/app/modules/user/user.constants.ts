export const USER_ROLE = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  USER: 'user',  
  OPTIONAL: 'optional', 
} as const;


export type USER_ROLE_INTERFACE = typeof USER_ROLE[keyof typeof USER_ROLE];
export const USER_ROLE_ENUM = Object.values(USER_ROLE);

export const gender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  NO: "N/A"
} as const;

export type GENDER_INTERFACE = typeof gender[keyof typeof gender];
export const GENDER_ENUM = Object.values(gender);




