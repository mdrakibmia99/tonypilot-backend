# 🚀 PRODUCTION-READY AUTHENTICATION & AUTHORIZATION BACKEND TEMPLATE
## Node.js + Express + TypeScript + MongoDB (Mongoose) + Zod + JWT Architecture

> **Purpose:** This file contains the complete blueprint and master prompt to generate an exact **100/100 clone** of the production architecture used in this project. It is specifically designed as a reusable starter template for any new project requiring robust **Authentication & Role-Based Authorization** with `user`, `admin`, and `super_admin` roles.

---

## 📑 TABLE OF CONTENTS
1. [Architecture & Design Principles](#1-architecture--design-principles)
2. [Exact Directory & File Tree](#2-exact-directory--file-tree)
3. [The Phased Implementation Blueprint](#3-the-phased-implementation-blueprint)
   - [Phase 1: Project Tooling & Environment Configuration](#phase-1-project-tooling--environment-configuration)
   - [Phase 2: Error Handling, Interfaces & QueryBuilder](#phase-2-error-handling-interfaces--querybuilder)
   - [Phase 3: Core Utilities & Security Middlewares](#phase-3-core-utilities--security-middlewares)
   - [Phase 4: OTP Verification Module](#phase-4-otp-verification-module)
   - [Phase 5: User Module & Role-Based Schema](#phase-5-user-module--role-based-schema)
   - [Phase 6: Authentication & OAuth Module](#phase-6-authentication--oauth-module)
   - [Phase 7: Admin & Super Admin Management Module](#phase-7-admin--super-admin-management-module)
   - [Phase 8: Routing, App Setup & Graceful Server Bootstrap](#phase-8-routing-app-setup--graceful-server-bootstrap)
4. [Master AI Prompt (Copy & Paste for New Projects)](#4-master-ai-prompt-copy--paste-for-new-projects)
5. [Complete API Endpoints & Verification Guide](#5-complete-api-endpoints--verification-guide)

---

## 1. ARCHITECTURE & DESIGN PRINCIPLES

This template follows an enterprise-grade **Modular Layered Architecture**:
```
Request ➡️ Router ➡️ Middlewares (Auth / ValidateRequest / Multer / ParseData)
        ➡️ Controller (catchAsync / sendResponse)
        ➡️ Service (Business Logic / Hashing / Tokenization / DB Operations)
        ➡️ Model (Mongoose Schema / Hooks / Statics / Lean Queries)
```

### Key Technical Pillars:
1. **Roles Hierarchy:**
   - `super_admin`: Full system control (manage admins, change user roles, system metrics).
   - `admin`: Moderate users, view logs, block/unblock users, manage application data.
   - `user`: Standard customer/client with complete profile, authentication, password management.
2. **Two-Factor OTP Registration:**
   - Step 1: `/user/create` validates data, checks duplicates, generates 6-digit OTP with TTL expiration, sends HTML email, returns temporary JWT token.
   - Step 2: `/user/create-user-verify-otp` verifies OTP + token, creates user document with hashed password, returns user data + Access & Refresh JWTs.
3. **Forgot & Reset Password Lifecycle:**
   - Step 1: Email OTP dispatch (`/auth/forgot-password-otpByEmail`) -> returns `forgetToken`.
   - Step 2: OTP Verification (`/auth/forgot-password-otp-match`) -> returns `forgetOtpMatchToken`.
   - Step 3: Password Reset (`/auth/forgot-password-reset`) -> verifies token, updates password, sets `passwordChangedAt` timestamp, revokes stale sessions.
4. **Token Security & Lifecycle:**
   - Dual-token architecture: Short-lived Access Token in response body/header, Long-lived Refresh Token in HTTP-only secure cookie.
   - Immediate session revocation if `passwordChangedAt` is greater than the token's issued-at (`iat`) timestamp.
5. **Zero Data Leakage:**
   - Mongoose `toJSON` transforms remove `password` and convert dates cleanly.
   - Soft delete filter (`isDeleted: { $ne: true }`) applied automatically to all find queries and aggregates.
6. **Robust Error Handling:**
   - Centralized handler converts Zod errors, Mongoose ValidationErrors, Mongo 11000 duplicate key errors, Multer errors, and custom `AppError` instances into a predictable JSON structure: `{ success: false, message, errorSources, stack }`.

---

## 2. EXACT DIRECTORY & FILE TREE

```
project-root/
├── public/
│   └── uploads/
│       └── profile/
├── src/
│   ├── app/
│   │   ├── builder/
│   │   │   └── QueryBuilder.ts
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   ├── multer.config.ts
│   │   │   └── transporter.ts
│   │   ├── db/
│   │   │   ├── adminStore.ts
│   │   │   └── createDefaultAdmin.ts
│   │   ├── error/
│   │   │   ├── AppError.ts
│   │   │   ├── CastError.ts
│   │   │   ├── DuplicateError.ts
│   │   │   ├── MulterError.ts
│   │   │   ├── ValidationError.ts
│   │   │   └── ZodError.ts
│   │   ├── interface/
│   │   │   ├── common.interface.ts
│   │   │   ├── error.ts
│   │   │   ├── index.d.ts
│   │   │   └── query.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── fileUpload.ts
│   │   │   ├── globalErrorhandler.ts
│   │   │   ├── notfound.ts
│   │   │   ├── parseData.ts
│   │   │   └── validateRequest.ts
│   │   ├── modules/
│   │   │   ├── Admin/
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── admin.interface.ts
│   │   │   │   ├── admin.route.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   └── admin.validation.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.constant.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.interface.ts
│   │   │   │   ├── auth.route.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.utils.ts
│   │   │   │   └── auth.validation.ts
│   │   │   ├── otp/
│   │   │   │   ├── otp.constants.ts
│   │   │   │   ├── otp.controller.ts
│   │   │   │   ├── otp.interface.ts
│   │   │   │   ├── otp.model.ts
│   │   │   │   ├── otp.routes.ts
│   │   │   │   ├── otp.service.ts
│   │   │   │   ├── otp.utils.ts
│   │   │   │   └── otp.validation.ts
│   │   │   └── user/
│   │   │       ├── user.constants.ts
│   │   │       ├── user.controller.ts
│   │   │       ├── user.interface.ts
│   │   │       ├── user.models.ts
│   │   │       ├── user.route.ts
│   │   │       ├── user.service.ts
│   │   │       ├── user.utils.ts
│   │   │       └── user.validation.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── catchAsync.ts
│   │       ├── emailNotification.ts
│   │       ├── fileHelper.ts
│   │       ├── logger.ts
│   │       ├── mailSender.ts
│   │       ├── otpGenerator.ts
│   │       ├── rateLimiter.ts
│   │       ├── sendResponse.ts
│   │       ├── serverHomePage.ts
│   │       └── tokenManage.ts
│   ├── app.ts
│   └── server.ts
├── .env.example
├── .gitignore
├── .prettierrc.json
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. THE PHASED IMPLEMENTATION BLUEPRINT

### PHASE 1: Project Tooling & Environment Configuration

#### 1.1 `package.json`
```json
{
  "name": "enterprise-auth-backend",
  "version": "1.0.0",
  "main": "src/server.ts",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "prettier": "prettier --ignore-path .gitignore --write \"./src/**/*.+(js|ts|json)\"",
    "prettier:fix": "prettier --write .",
    "start:prod": "node ./dist/server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "colors": "^1.4.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-mongo-sanitize": "^2.2.0",
    "express-rate-limit": "^7.5.0",
    "google-auth-library": "^9.15.0",
    "helmet": "^8.0.0",
    "http-status": "^2.1.0",
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.1.0",
    "mongoose": "^8.9.5",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.10.0",
    "winston": "^3.17.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.8",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.10",
    "@types/nodemailer": "^6.4.17",
    "@typescript-eslint/eslint-plugin": "^8.21.0",
    "@typescript-eslint/parser": "^8.21.0",
    "eslint": "^9.18.0",
    "prettier": "^3.4.2",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.7.3"
  }
}
```

#### 1.2 `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 1.3 `.env.example`
```env
NODE_ENV=development
PORT=5000
IP=http://localhost
PROJECT_NAME="ENTERPRISE AUTH TEMPLATE"

# SUPER ADMIN CREDENTIALS
SUPER_ADMIN_NAME="Super Administrator"
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=SuperAdmin@2026#Secure
SUPER_ADMIN_PHONE="+10000000000"

# ADMIN CREDENTIALS
ADMIN_NAME="Default Admin"
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@2026#Secure
ADMIN_PHONE="+10000000001"

# DATABASE
DATABASE_URL=mongodb://localhost:27017/enterprise_auth_db

# BCRYPT
BCRYPT_SALT_ROUNDS=12

# JWT SECRETS & EXPIRATION
JWT_ACCESS_SECRET=your_super_strong_jwt_access_secret_key_32chars
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_super_strong_jwt_refresh_secret_key_32chars
JWT_REFRESH_EXPIRES_IN=30d

CREATE_USER_SECRET=your_create_user_otp_verification_secret_key
CREATE_USER_EXPIRE_TIME=10m

FORGET_JWT_SECRET=your_forget_password_token_secret_key
FORGET_EXPIRE_TIME=10m

OTP_JWT_SECRET=your_otp_matched_reset_password_secret_key
OTP_TOKEN_EXPIRE_TIME=10m

# NODEMAILER (SMTP)
SMTP_HOST=smtp.gmail.com
NODEMAILER_HOST_EMAIL=youremail@gmail.com
NODEMAILER_HOST_PASS=your_app_specific_password

# OAUTH
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
APPLE_CLIENT_ID=your.apple.service.id

# CORS
CLIENT_CORS_ORIGIN=http://localhost:3000,http://localhost:5173
SERVER_URL=http://localhost:5000
```

#### 1.4 `src/app/config/index.ts`
```typescript
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const smtp = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  nodemailer_host_email: process.env.NODEMAILER_HOST_EMAIL || '',
  nodemailer_host_pass: process.env.NODEMAILER_HOST_PASS || '',
};

export default {
  NODE_ENV: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  ip: process.env.IP || 'http://localhost',
  project_name: process.env.PROJECT_NAME || 'AUTH BACKEND',

  super_admin_name: process.env.SUPER_ADMIN_NAME || 'Super Administrator',
  super_admin_email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com',
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2026#Secure',
  super_admin_phone: process.env.SUPER_ADMIN_PHONE || '+10000000000',

  admin_name: process.env.ADMIN_NAME || 'Default Admin',
  admin_email: process.env.ADMIN_EMAIL || 'admin@example.com',
  admin_password: process.env.ADMIN_PASSWORD || 'Admin@2026#Secure',
  admin_phone: process.env.ADMIN_PHONE || '+10000000001',

  database_url: process.env.DATABASE_URL || 'mongodb://localhost:27017/auth_template',
  server_url: process.env.SERVER_URL || 'http://localhost:5000',
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,

  jwt_access_secret: process.env.JWT_ACCESS_SECRET || 'default_access_secret_key',
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key',
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  create_user_secret: process.env.CREATE_USER_SECRET || 'default_create_user_secret',
  create_user_expire_time: process.env.CREATE_USER_EXPIRE_TIME || '10m',

  forget_jwt_secret: process.env.FORGET_JWT_SECRET || 'default_forget_secret',
  forget_expire_time: process.env.FORGET_EXPIRE_TIME || '10m',

  otp_jwt_secret: process.env.OTP_JWT_SECRET || 'default_otp_secret',
  otp_token_expire_time: process.env.OTP_TOKEN_EXPIRE_TIME || '10m',

  CLIENT_CORS_ORIGIN: process.env.CLIENT_CORS_ORIGIN || '*',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',

  smtp,
};
```

#### 1.5 `src/app/config/transporter.ts`
```typescript
import nodemailer from 'nodemailer';
import config from './index';

const isProduction = config.NODE_ENV === 'production';

export const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: isProduction ? 465 : 587,
  secure: isProduction,
  auth: {
    user: config.smtp.nodemailer_host_email,
    pass: config.smtp.nodemailer_host_pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});
```

---

### PHASE 2: Error Handling, Interfaces & QueryBuilder

#### 2.1 `src/app/error/AppError.ts`
```typescript
class AppError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message: string, stack = '') {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
```

#### 2.2 `src/app/interface/error.ts`
```typescript
export type TErrorSources = {
  path: string | number | null;
  message: string;
}[];

export type TGenericErrorResponse = {
  statusCode: number;
  message: string;
  errorSources: TErrorSources;
};
```

#### 2.3 `src/app/interface/index.d.ts`
```typescript
import { JwtPayload } from 'jsonwebtoken';
import { IJwtPayload } from '../modules/auth/auth.interface';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload | IJwtPayload;
      rawBody?: Buffer;
    }
  }
}
```

#### 2.4 Error Handlers (`ZodError.ts`, `ValidationError.ts`, `CastError.ts`, `DuplicateError.ts`, `MulterError.ts`)
- `ZodError.ts`: Maps Zod issues to uniform `TGenericErrorResponse` with status 400.
- `ValidationError.ts`: Formats Mongoose schema validation errors.
- `CastError.ts`: Formats invalid MongoDB `ObjectId` casting errors.
- `DuplicateError.ts`: Handles Mongo error code 11000 and extracts duplicate field values.
- `MulterError.ts`: Handles `LIMIT_FILE_SIZE` and `LIMIT_UNEXPECTED_FILE`.

#### 2.5 `src/app/builder/QueryBuilder.ts`
Provides chainable `.search(['fullName', 'email'])`, `.filter()`, `.sort()`, `.paginate()`, `.fields()`, and `.countTotal()`.

---

### PHASE 3: Core Utilities & Security Middlewares

#### 3.1 `src/app/utils/catchAsync.ts` & `sendResponse.ts`
- `catchAsync`: Wraps asynchronous Express handlers to automatically route uncaught promises to `next(err)`.
- `sendResponse<T>`: Standardizes API responses with `{ success, statusCode, message, meta, data }`.

#### 3.2 `src/app/utils/tokenManage.ts`
```typescript
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import AppError from '../error/AppError';
import httpStatus from 'http-status';
import { IJwtPayload } from '../modules/auth/auth.interface';

export const createToken = ({
  payload,
  access_secret,
  expity_time,
}: {
  payload: JwtPayload | Record<string, unknown>;
  access_secret: Secret;
  expity_time: string | number;
}): string => {
  return jwt.sign(payload, access_secret, {
    expiresIn: expity_time,
  } as jwt.SignOptions);
};

export const verifyToken = ({
  token,
  access_secret,
}: {
  token: string;
  access_secret: string;
}): JwtPayload | IJwtPayload => {
  try {
    return jwt.verify(token, access_secret) as JwtPayload;
  } catch (err) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
  }
};
```

#### 3.3 `src/app/utils/mailSender.ts` & `emailNotification.ts`
- `mailSender.ts`: Sends email using `transporter`.
- `emailNotification.ts`: Provides styled HTML templates for:
  - Account registration email verification OTP.
  - Forgot password reset OTP.
  - Welcome & admin credential dispatch emails.

#### 3.4 `src/app/middleware/auth.ts`
```typescript
import httpStatus from 'http-status';
import AppError from '../error/AppError';
import catchAsync from '../utils/catchAsync';
import { verifyToken } from '../utils/tokenManage';
import config from '../config';
import { User } from '../modules/user/user.models';
import { USER_ROLE } from '../modules/user/user.constants';
import { IJwtPayload } from '../modules/auth/auth.interface';

const auth = (...allowedRoles: string[]) => {
  return catchAsync(async (req, res, next) => {
    const token =
      req.headers?.authorization?.split(' ')[1] || (req.headers?.token as string);

    if (!token) {
      if (allowedRoles.length && allowedRoles.includes(USER_ROLE.OPTIONAL)) {
        return next();
      }
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    const decoded = verifyToken({
      token,
      access_secret: config.jwt_access_secret,
    }) as IJwtPayload;

    if (!decoded || !decoded.userId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token!');
    }

    const user = await User.IsUserExistById(decoded.userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.role !== decoded.role) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Role mismatch. Unauthorized!');
    }

    if (user.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'Your account has been deleted.');
    }

    if (user.isBlocked) {
      throw new AppError(httpStatus.FORBIDDEN, 'Your account is blocked.');
    }

    // Revoke token if password was changed after token generation
    if (user.passwordChangedAt && decoded.iat) {
      const pwdChangedSeconds = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < pwdChangedSeconds) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'Password was recently changed. Please login again.'
        );
      }
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      throw new AppError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action.');
    }

    req.user = decoded;
    next();
  });
};

export default auth;
```

#### 3.5 `src/app/middleware/validateRequest.ts`
Parses and validates `req.body`, `req.query`, `req.params`, `req.cookies`, and `req.file` against any given Zod Schema.

#### 3.6 `src/app/middleware/fileUpload.ts` & `parseData.ts`
- `fileUpload(destFolder)`: Configures diskStorage for avatar and file uploads with sanitization and MIME filters.
- `parseData()`: Safely deserializes `req.body.data` JSON strings sent alongside `multipart/form-data` uploads.

#### 3.7 `src/app/middleware/globalErrorhandler.ts` & `notfound.ts`
- Converts all error variants into uniform JSON and suppresses stack traces in production.
- `notfound.ts`: Returns HTTP 404 for unrecognized routes.

---

### PHASE 4: OTP Verification Module

#### 4.1 Schema (`otp.model.ts`)
- Fields: `sentTo`, `receiverType: ['email', 'phone']`, `purpose: ['email-verification', 'forget-password']`, `otp`, `expiredAt`, `status: ['pending', 'verified', 'expired']`.
- **TTL Index:** `otpSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 })` ensures database self-cleaning.

#### 4.2 Services & Flow
- `checkOtpByEmail`: Returns existing active OTP or checks if expired.
- `createOtp`: Saves new OTP record with 2-minute default expiration.
- `otpMatch`: Verifies OTP matching the email, purpose, and unexpired validity.
- Route `/api/v1/otp/resend-email-otp`: Resends email verification OTP with rate limiting.

---

### PHASE 5: User Module & Role-Based Schema

#### 5.1 Constants & Interface
```typescript
// user.constants.ts
export const USER_ROLE = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
  OPTIONAL: 'optional',
} as const;

export type USER_ROLE_INTERFACE = typeof USER_ROLE[keyof typeof USER_ROLE];
export const USER_ROLE_ENUM = Object.values(USER_ROLE);
```

#### 5.2 Mongoose Model (`user.models.ts`)
- Strictly typed with `TUser` and `UserModel`.
- `pre('save')`: Hashes password with `bcrypt.hash(password, saltRounds)` only when modified, sets `passwordChangedAt = new Date()`.
- `post('save')`: Sets `doc.password = ''`.
- `userSchema.methods.toJSON`: Deletes `password` from the JSON output.
- `pre(/^find/)` & `pre('aggregate')`: Injects `{ isDeleted: { $ne: true } }` unless `{ ignoreDeleted: true }` is set in query options.
- Statics:
  - `User.isUserExist(email)`
  - `User.isUserActive(email)`
  - `User.IsUserExistById(id)`
  - `User.isPasswordMatched(plain, hashed)`

#### 5.3 User Endpoints (`user.route.ts`)
- `POST /api/v1/user/create`: Validates body, generates registration token & sends OTP.
- `POST /api/v1/user/create-user-verify-otp`: Confirms OTP + token, creates user, returns tokens.
- `GET /api/v1/user/my-profile`: Protected (`USER`, `ADMIN`, `SUPER_ADMIN`).
- `POST /api/v1/user/complete-my-profile`: Multipart upload (`image`), validates and updates profile, sets `hasCompletedProfile = true`.
- `PATCH /api/v1/user/update-my-profile`: Profile update.
- `DELETE /api/v1/user/delete-my-account`: Soft delete (`isDeleted = true`) with password verification.
- `POST /api/v1/user/set-or-remove-fcm-token`: Updates device push token.

---

### PHASE 6: Authentication & OAuth Module

#### 6.1 Token Generation Utility (`auth.utils.ts`)
```typescript
export const generateTokens = (jwtPayload: IJwtPayload) => {
  const accessToken = createToken({
    payload: jwtPayload,
    access_secret: config.jwt_access_secret,
    expity_time: config.jwt_access_expires_in,
  });

  const refreshToken = createToken({
    payload: jwtPayload,
    access_secret: config.jwt_refresh_secret,
    expity_time: config.jwt_refresh_expires_in,
  });

  return { accessToken, refreshToken };
};
```

#### 6.2 Auth Endpoints (`auth.route.ts`)
- `POST /api/v1/auth/login`: Credential login with email + password, returns Access Token + sets `refreshToken` in HttpOnly cookie.
- `POST /api/v1/auth/google-login`: Verifies Google ID token via `OAuth2Client.verifyIdToken`.
- `POST /api/v1/auth/apple-login`: Verifies Apple public keys via `jwks-rsa`.
- `POST /api/v1/auth/refresh-token`: Reissues fresh access token from cookie/header.
- `POST /api/v1/auth/forgot-password-otpByEmail`: Sends OTP, returns `forgetToken`.
- `PATCH /api/v1/auth/forgot-password-otp-match`: Verifies OTP with `forgetToken`, returns `forgetOtpMatchToken`.
- `PATCH /api/v1/auth/forgot-password-reset`: Accepts new password and `forgetOtpMatchToken`, updates password.
- `PATCH /api/v1/auth/change-password`: Authenticated (`USER`, `ADMIN`, `SUPER_ADMIN`), validates old password, sets new password.

---

### PHASE 7: Admin & Super Admin Management Module

#### 7.1 Auto-Seeding (`src/app/db/createDefaultAdmin.ts`)
```typescript
import config from '../config';
import { USER_ROLE } from '../modules/user/user.constants';
import { User } from '../modules/user/user.models';
import { setAdminData } from './adminStore';

const createDefaultAdmin = async () => {
  // 1. Check and Seed Super Admin
  const superAdminExists = await User.findOne({ role: USER_ROLE.SUPER_ADMIN }).setOptions({ ignoreDeleted: true });
  if (!superAdminExists) {
    const superAdmin = await User.create({
      fullName: config.super_admin_name,
      email: config.super_admin_email,
      password: config.super_admin_password,
      role: USER_ROLE.SUPER_ADMIN,
      isVerifiedByAdmin: true,
      hasCompletedProfile: true,
    });
    setAdminData(superAdmin);
    console.log('✅ Default Super Admin created:', config.super_admin_email);
  }

  // 2. Check and Seed Admin
  const adminExists = await User.findOne({ role: USER_ROLE.ADMIN }).setOptions({ ignoreDeleted: true });
  if (!adminExists) {
    await User.create({
      fullName: config.admin_name,
      email: config.admin_email,
      password: config.admin_password,
      role: USER_ROLE.ADMIN,
      isVerifiedByAdmin: true,
      hasCompletedProfile: true,
    });
    console.log('✅ Default Admin created:', config.admin_email);
  }
};

export default createDefaultAdmin;
```

#### 7.2 Admin Routes (`admin.route.ts`)
- `GET /api/v1/admin/users`: Lists all users with pagination, search, and filters (`auth(ADMIN, SUPER_ADMIN)`).
- `PATCH /api/v1/admin/users/:id/block`: Toggles user `isBlocked` flag (`auth(ADMIN, SUPER_ADMIN)`).
- `DELETE /api/v1/admin/users/:id`: Soft deletes a user (`isDeleted = true`) with protection against deleting other administrators.
- `PATCH /api/v1/admin/users/:id/change-role`: Changes user role (`SUPER_ADMIN` only).

---

### PHASE 8: Routing, App Setup & Graceful Server Bootstrap

#### 8.1 Central Route Aggregator (`src/app/routes/index.ts`)
```typescript
import { Router } from 'express';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.route';
import { otpRoutes } from '../modules/otp/otp.routes';
import { adminRoutes } from '../modules/Admin/admin.route';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/users', route: userRoutes },
  { path: '/otp', route: otpRoutes },
  { path: '/admin', route: adminRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
```

#### 8.2 Application Config (`src/app.ts`)
- Registers static middleware (`/public` directory).
- Configures `express.json` with `rawBody` preservation.
- Adds `cookieParser`, `helmet`, `mongoSanitize`, and `cors`.
- Injects HTTP request logger (method, route, status code).
- Mounts `/` status route using `serverHomePage(projectName)`.
- Mounts `/api/v1` with the router.
- Mounts `globalErrorHandler` and `notFound` middlewares.

#### 8.3 Server Bootstrap & Graceful Shutdown (`src/server.ts`)
- Connects to MongoDB with `mongoose.connect(config.database_url)`.
- Calls `createDefaultAdmin()` to ensure super admin and admin exist.
- Binds HTTP server on `config.port`.
- Listens for `SIGTERM`, `SIGINT`, `unhandledRejection`, and `uncaughtException` to cleanly disconnect DB and close HTTP connections before exiting.

---

## 4. MASTER AI PROMPT (COPY & PASTE FOR NEW PROJECTS)

> **Instructions for the User:** Copy the entire prompt enclosed inside the markdown block below. Paste it into any AI coding assistant (such as ChatGPT, Claude, Cursor, Antigravity, or Gemini) when starting any new backend project. It instructs the AI to generate this exact authentication starter kit with 100/100 fidelity.

````markdown
You are a Principal Backend Architect specializing in Node.js, Express, TypeScript, MongoDB (Mongoose), Zod, and JWT authentication.

Your task is to build a complete, 100/100 production-ready Authentication and Role-Based Access Control (RBAC) starter template.
The project must strictly implement three roles: `user`, `admin`, and `super_admin`.

Follow this exact layered architecture:
Route -> Middleware (Auth / ValidateRequest / Multer / ParseData) -> Controller (catchAsync / sendResponse) -> Service (Business Logic / Hashing / Tokens) -> Model (Mongoose Schema / Hooks / Statics / Lean Queries).

### STRICT FOLDER AND FILE STRUCTURE:
Generate all files using this exact structure without omitting any file:
```
├── public/
│   └── uploads/
│       └── profile/
├── src/
│   ├── app/
│   │   ├── builder/
│   │   │   └── QueryBuilder.ts
│   │   ├── config/
│   │   │   ├── index.ts
│   │   │   ├── multer.config.ts
│   │   │   └── transporter.ts
│   │   ├── db/
│   │   │   ├── adminStore.ts
│   │   │   └── createDefaultAdmin.ts
│   │   ├── error/
│   │   │   ├── AppError.ts
│   │   │   ├── CastError.ts
│   │   │   ├── DuplicateError.ts
│   │   │   ├── MulterError.ts
│   │   │   ├── ValidationError.ts
│   │   │   └── ZodError.ts
│   │   ├── interface/
│   │   │   ├── common.interface.ts
│   │   │   ├── error.ts
│   │   │   ├── index.d.ts
│   │   │   └── query.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── fileUpload.ts
│   │   │   ├── globalErrorhandler.ts
│   │   │   ├── notfound.ts
│   │   │   ├── parseData.ts
│   │   │   └── validateRequest.ts
│   │   ├── modules/
│   │   │   ├── Admin/
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── admin.interface.ts
│   │   │   │   ├── admin.route.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   └── admin.validation.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.constant.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.interface.ts
│   │   │   │   ├── auth.route.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.utils.ts
│   │   │   │   └── auth.validation.ts
│   │   │   ├── otp/
│   │   │   │   ├── otp.constants.ts
│   │   │   │   ├── otp.controller.ts
│   │   │   │   ├── otp.interface.ts
│   │   │   │   ├── otp.model.ts
│   │   │   │   ├── otp.routes.ts
│   │   │   │   ├── otp.service.ts
│   │   │   │   ├── otp.utils.ts
│   │   │   │   └── otp.validation.ts
│   │   │   └── user/
│   │   │       ├── user.constants.ts
│   │   │       ├── user.controller.ts
│   │   │       ├── user.interface.ts
│   │   │       ├── user.models.ts
│   │   │       ├── user.route.ts
│   │   │       ├── user.service.ts
│   │   │       ├── user.utils.ts
│   │   │       └── user.validation.ts
│   │   ├── routes/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── catchAsync.ts
│   │       ├── emailNotification.ts
│   │       ├── fileHelper.ts
│   │       ├── logger.ts
│   │       ├── mailSender.ts
│   │       ├── otpGenerator.ts
│   │       ├── rateLimiter.ts
│   │       ├── sendResponse.ts
│   │       ├── serverHomePage.ts
│   │       └── tokenManage.ts
│   ├── app.ts
│   └── server.ts
├── .env.example
├── .gitignore
├── .prettierrc.json
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

### DETAILED SPECIFICATIONS:

#### 1. Roles & Permissions:
- Roles in `user.constants.ts`: `USER_ROLE = { SUPER_ADMIN: 'super_admin', ADMIN: 'admin', USER: 'user', OPTIONAL: 'optional' } as const`.
- Default seeder (`createDefaultAdmin.ts`): Automatically bootstraps both a Super Admin and an Admin from `.env` variables if they do not exist when the database connects.

#### 2. User & Authentication Flows:
- **Registration with OTP Verification (2-step):**
  - Step 1: `POST /api/v1/users/create`: Validates body with Zod, checks email duplication, creates/updates 6-digit OTP with TTL expiration, emails HTML OTP, returns temporary encrypted registration token.
  - Step 2: `POST /api/v1/users/create-user-verify-otp`: Decodes registration token, validates OTP from DB, creates User in MongoDB with hashed password, returns user object + Access and Refresh JWTs.
- **Login:**
  - `POST /api/v1/auth/login`: Checks user existence, active status (not blocked, not deleted), compares bcrypt password, sets HttpOnly `refreshToken` cookie, returns Access Token.
- **OAuth Login:**
  - `POST /api/v1/auth/create-or-login-google-user`: Verifies Google ID token with `google-auth-library`.
  - `POST /api/v1/auth/create-or-login-apple-user`: Verifies Apple token using `jwks-rsa`.
- **Token Refresh:**
  - `POST /api/v1/auth/refresh-token`: Reads refresh token from cookie or header, checks user status and `passwordChangedAt`, returns a new Access Token.
- **Forgot Password via OTP (3-step):**
  - Step 1: `POST /api/v1/auth/forgot-password-otpByEmail`: Sends OTP via email, returns `forgetToken`.
  - Step 2: `PATCH /api/v1/auth/forgot-password-otp-match`: Validates OTP against `forgetToken`, marks OTP verified, returns `forgetOtpMatchToken`.
  - Step 3: `PATCH /api/v1/auth/forgot-password-reset`: Receives `forgetOtpMatchToken` + newPassword + confirmPassword, updates password, sets `passwordChangedAt = new Date()`, revoking all older tokens.
- **Change Password:**
  - `PATCH /api/v1/auth/change-password`: Protected (`USER`, `ADMIN`, `SUPER_ADMIN`), validates oldPassword, hashes newPassword, updates `passwordChangedAt`.
- **Profile Management:**
  - `GET /api/v1/users/my-profile`: Returns authenticated user's profile.
  - `POST /api/v1/users/complete-my-profile`: Handles avatar upload via Multer, parses JSON with `parseData()`, updates profile, sets `hasCompletedProfile = true`.
  - `PATCH /api/v1/users/update-my-profile`: Updates user profile information.
  - `DELETE /api/v1/users/delete-my-account`: Soft deletes account (`isDeleted = true`) after verifying password.

#### 3. Admin & Super Admin System:
- `GET /api/v1/admin/users`: QueryBuilder pagination, searching (`fullName`, `email`), filtering by role/status (`ADMIN`, `SUPER_ADMIN`).
- `PATCH /api/v1/admin/users/:id/block`: Blocks or unblocks a user account (`ADMIN`, `SUPER_ADMIN`).
- `DELETE /api/v1/admin/users/:id`: Soft deletes a user account (prevents deleting other administrators).
- `PATCH /api/v1/admin/users/:id/change-role`: Promotes/demotes user roles (`SUPER_ADMIN` only).

#### 4. Architecture Standards:
- Use `catchAsync` in all controller handlers.
- Use `sendResponse` in all controller responses.
- Throw custom `AppError(httpStatus.*, 'message')` for operational exceptions.
- Implement central `globalErrorHandler` supporting Zod, Mongoose, Multer, and Mongo Duplicate Key errors.
- Soft-delete pattern: Mongoose query middleware `pre(/^find/)` and `pre('aggregate')` automatically exclude `{ isDeleted: true }`.
- Password protection: Model has `select: false` on password, Mongoose `toJSON` strips `password`, post-save hook sets `doc.password = ''`.
- Graceful shutdown in `server.ts` handling `SIGTERM`, `SIGINT`, `unhandledRejection`, and `uncaughtException`.

Produce the complete code for all files step-by-step in logical phases. Ensure 100% strict TypeScript types and zero missing imports!
````

---

## 5. COMPLETE API ENDPOINTS & VERIFICATION GUIDE

| Method | Endpoint | Allowed Roles | Request Body / Headers | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/users/create` | Public | `{ email, password, fullName }` | Step 1 Registration: Sends OTP to email & returns sign-up token |
| **POST** | `/api/v1/users/create-user-verify-otp` | Public | `{ otp, token }` | Step 2 Registration: Verifies OTP & creates user in MongoDB |
| **POST** | `/api/v1/auth/login` | Public | `{ email, password }` | Authenticates user; returns Access Token & sets Refresh Cookie |
| **POST** | `/api/v1/auth/google-login` | Public | `{ accessToken }` | Google OAuth token login / signup |
| **POST** | `/api/v1/auth/apple-login` | Public | `{ accessToken }` | Apple Sign In token login / signup |
| **POST** | `/api/v1/auth/refresh-token` | Public | `cookies: { refreshToken }` | Generates a new Access Token using valid Refresh Token |
| **POST** | `/api/v1/auth/forgot-password-otpByEmail` | Public | `{ email }` | Step 1 Forgot Password: Sends OTP to email & returns `forgetToken` |
| **PATCH** | `/api/v1/auth/forgot-password-otp-match` | Public | `headers: { token: forgetToken }`, `{ otp }` | Step 2 Forgot Password: Match OTP; returns `forgetOtpMatchToken` |
| **PATCH** | `/api/v1/auth/forgot-password-reset` | Public | `headers: { token: forgetOtpMatchToken }`, `{ newPassword, confirmPassword }` | Step 3 Forgot Password: Sets new password & revokes previous tokens |
| **PATCH** | `/api/v1/auth/change-password` | `user`, `admin`, `super_admin` | `Bearer Token`, `{ oldPassword, newPassword, confirmPassword }` | Updates password and invalidates earlier tokens |
| **GET** | `/api/v1/users/my-profile` | `user`, `admin`, `super_admin` | `Bearer Token` | Retrieves currently logged-in user's profile |
| **POST** | `/api/v1/users/complete-my-profile` | `user`, `admin`, `super_admin` | `Bearer Token`, Multipart Form: `image`, `data: JSON` | Uploads profile image & completes user profile |
| **PATCH** | `/api/v1/users/update-my-profile` | `user`, `admin`, `super_admin` | `Bearer Token`, Multipart Form or JSON | Updates profile details |
| **DELETE** | `/api/v1/users/delete-my-account` | `user` | `Bearer Token`, `{ password }` | Soft deletes account (`isDeleted = true`) |
| **PATCH** | `/api/v1/otp/resend-email-otp` | Public | `headers: { token }` | Resends OTP to email with rate-limit protection |
| **GET** | `/api/v1/admin/users` | `admin`, `super_admin` | `Bearer Token`, Query: `page, limit, searchTerm, role` | Lists all users with search, pagination, and filter |
| **PATCH** | `/api/v1/admin/users/:id/block` | `admin`, `super_admin` | `Bearer Token`, `{ isBlocked: boolean }` | Blocks or unblocks a specific user |
| **DELETE** | `/api/v1/admin/users/:id` | `admin`, `super_admin` | `Bearer Token` | Soft deletes user (admins cannot delete other admins) |
| **PATCH** | `/api/v1/admin/users/:id/change-role` | `super_admin` | `Bearer Token`, `{ role: 'admin' \| 'user' }` | Promotes/demotes user roles (Super Admin only) |

---

## 6. HOW TO USE IN A NEW PROJECT

1. **Initialize project directory:**
   ```bash
   mkdir my-new-project && cd my-new-project
   git init
   npm init -y
   ```
2. **Execute the Master Prompt:**
   - Copy the text in [Section 4: Master AI Prompt](#4-master-ai-prompt-copy--paste-for-new-projects).
   - Paste it into your AI assistant. The AI will follow the 8 sequential phases to write out every file cleanly.
3. **Install Dependencies:**
   ```bash
   npm install
   ```
4. **Configure Environment:**
   - Copy `.env.example` to `.env`.
   - Update `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and SMTP credentials.
5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   *The server connects to MongoDB, auto-creates the Super Admin and Admin, and starts listening on port 5000 with a live dashboard at `http://localhost:5000`!*
