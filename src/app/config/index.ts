import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join((process.cwd(), '.env')) });

const smtp = {
  host: process.env.SMTP_HOST,
  nodemailer_host_email: process.env.NODEMAILER_HOST_EMAIL,
  nodemailer_host_pass: process.env.NODEMAILER_HOST_PASS,
}
const stripe = {
  stripe_api_secret: process.env.STRIPE_API_SECRET,
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
};

const aws = {
  s3_bucket_name: process.env.S3_BUCKET_NAME,
  secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
  access_key_id: process.env.AWS_ACCESS_KEY_ID,
  region: process.env.AWS_REGION,
  base_url: process.env.AWS_BASE_URL,
}

const redis = {
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB) || 0,
  default_ttl: Number(process.env.REDIS_DEFAULT_TTL) || 300,
  enabled: process.env.REDIS_ENABLED !== 'false',
  key_prefix: process.env.REDIS_KEY_PREFIX || 'tonypilot:',
};
const zego = {
  app_id: Number(process.env.ZEGO_APP_ID) || 123456789,
  server_secret: process.env.ZEGO_SERVER_SECRET || '12345678901234567890123456789012',
  callback_secret: process.env.ZEGO_CALLBACK_SECRET || 'tonypilot_zego_callback_secret_2026',
};

const twilio = {
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  phone_number: process.env.TWILIO_PHONE_NUMBER,
};

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 5000,
  ip: process.env.IP,
  admin_email: process.env.ADMIN_EMAIL,
  admin_password: process.env.ADMIN_PASSWORD,
  admin_phone: process.env.ADMIN_PHONE,
  database_url: process.env.DATABASE_URL,
  server_url: process.env.SERVER_URL,
  client_Url: process.env.CLIENT_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,

  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,

  create_user_secret: process.env.CREATE_USER_SECRET,
  create_user_expire_time: process.env.CREATE_USER_EXPIRE_TIME,

  forget_jwt_secret: process.env.FORGET_JWT_SECRET,
  forget_expire_time: process.env.FORGET_EXPIRE_TIME,

  otp_jwt_secret: process.env.OTP_JWT_SECRET,
  otp_token_expire_time: process.env.OTP_TOKEN_EXPIRE_TIME,


  // otp_expire_time: process.env.OTP_EXPIRE_TIME,
  socket_port: Number(process.env.SOCKET_PORT) || 5001,
  CLIENT_CORS_ORIGIN: process.env.CLIENT_CORS_ORIGIN,
  // google_map_api_key: process.env.GOOGLE_MAP_API_KEY,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  storage_provider: process.env.STORAGE_PROVIDER,
  smtp,
  stripe,
  aws,
  redis,
  twilio,
  zego
};
