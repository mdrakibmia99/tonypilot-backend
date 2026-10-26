import crypto from 'crypto';
import config from '../../config';

export interface IZegoTokenPayload {
  room_id?: string;
  privilege?: {
    [key: number]: number; // 1: login room, 2: publish stream (1 = allow, 0 = disallow)
  };
  stream_id_list?: string[] | null;
}

/**
 * Generates an official ZEGOCLOUD Token04 using AES-256-GCM encryption.
 * Compatible with ZegoUIKitPrebuiltLiveStreaming, ZegoExpressEngine, and ZIM SDKs.
 */
export function generateZegoToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload: string = '',
): string {
  if (!appId || typeof appId !== 'number') {
    throw new Error('ZEGO appId must be a valid number');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('ZEGO userId must be a non-empty string');
  }
  if (!secret || secret.length !== 32) {
    throw new Error('ZEGO serverSecret must be a 32-character string');
  }
  if (!effectiveTimeInSeconds || effectiveTimeInSeconds <= 0) {
    throw new Error('effectiveTimeInSeconds must be greater than 0');
  }

  const version = '04';
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;

  // 1. Construct token info object
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: crypto.randomInt(0, 2147483647),
    ctime: createTime,
    expire: expireTime,
    payload: payload || '',
  };

  const plaintext = JSON.stringify(tokenInfo);

  // 2. Prepare AES-256-GCM encryption
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM
  const key = Buffer.from(secret, 'utf8'); // 32-byte secret key

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16-byte authentication tag

  // Combine ciphertext and authTag
  const cipherBuffer = Buffer.concat([encrypted, authTag]);

  // 3. Build binary header with BigInt expiration
  const header = Buffer.alloc(13);
  header.writeBigInt64BE(BigInt(expireTime), 0);
  header.writeUInt16BE(iv.length, 8);
  header.writeUInt16BE(cipherBuffer.length, 10);
  header[12] = 1; // Encryption flag (GCM)

  // 4. Assemble final token: "04" + Base64(header + iv + cipherBuffer)
  const finalBuffer = Buffer.concat([header, iv, cipherBuffer]);
  return version + finalBuffer.toString('base64');
}

/**
 * Generate tokens for Stream Host with full publishing and room control rights.
 */
export function generateHostTokens(params: {
  userId: string;
  roomId: string;
  effectiveTimeInSeconds?: number;
}) {
  const appId = config.zego.app_id;
  const secret = config.zego.server_secret;
  const duration = params.effectiveTimeInSeconds || 7200; // 2 hours default

  const rtcPayload: IZegoTokenPayload = {
    room_id: params.roomId,
    privilege: {
      1: 1, // Login Room: Allowed
      2: 1, // Publish Stream: Allowed
    },
    stream_id_list: null,
  };

  const rtcToken = generateZegoToken04(
    appId,
    params.userId,
    secret,
    duration,
    JSON.stringify(rtcPayload),
  );

  const zimToken = generateZegoToken04(appId, params.userId, secret, duration, '');

  return {
    appId,
    rtcToken,
    zimToken,
    effectiveTimeInSeconds: duration,
  };
}

/**
 * Generate audience tokens for Viewers (subscribe-only, no stream publishing).
 */
export function generateViewerTokens(params: {
  userId: string;
  roomId: string;
  effectiveTimeInSeconds?: number;
}) {
  const appId = config.zego.app_id;
  const secret = config.zego.server_secret;
  const duration = params.effectiveTimeInSeconds || 7200;

  const rtcPayload: IZegoTokenPayload = {
    room_id: params.roomId,
    privilege: {
      1: 1, // Login Room: Allowed
      2: 0, // Publish Stream: Disallowed
    },
    stream_id_list: null,
  };

  const rtcToken = generateZegoToken04(
    appId,
    params.userId,
    secret,
    duration,
    JSON.stringify(rtcPayload),
  );

  const zimToken = generateZegoToken04(appId, params.userId, secret, duration, '');

  return {
    appId,
    rtcToken,
    zimToken,
    effectiveTimeInSeconds: duration,
  };
}

/**
 * Generate silent spectator token for Admin monitoring.
 */
export function generateAdminSpectatorToken(params: {
  adminId: string;
  roomId: string;
}) {
  const appId = config.zego.app_id;
  const secret = config.zego.server_secret;
  const duration = 14400; // 4 hours

  const rtcPayload: IZegoTokenPayload = {
    room_id: params.roomId,
    privilege: {
      1: 1,
      2: 0,
    },
    stream_id_list: null,
  };

  return generateZegoToken04(
    appId,
    params.adminId,
    secret,
    duration,
    JSON.stringify(rtcPayload),
  );
}

/**
 * Verifies webhook signatures incoming from ZEGOCLOUD callback servers.
 */
export function verifyZegoWebhookSignature(params: {
  signature: string;
  timestamp: string | number;
  nonce: string | number;
  callbackSecret?: string;
  bodyString?: string;
}): boolean {
  try {
    const callbackSecret = params.callbackSecret || config.zego.callback_secret;
    if (!callbackSecret || !params.signature) {
      return false;
    }

    // ZEGOCLOUD standard callback signature algorithm:
    // sha256(callbackSecret + nonce + timestamp) or sha256(callbackSecret + timestamp + nonce + body)
    const strToSign = `${callbackSecret}${params.nonce}${params.timestamp}`;
    const computedSha256 = crypto.createHash('sha256').update(strToSign).digest('hex');

    if (computedSha256.toLowerCase() === params.signature.toLowerCase()) {
      return true;
    }

    // Alternative MD5 format used by some legacy callbacks
    const computedMd5 = crypto.createHash('md5').update(strToSign).digest('hex');
    return computedMd5.toLowerCase() === params.signature.toLowerCase();
  } catch {
    return false;
  }
}
