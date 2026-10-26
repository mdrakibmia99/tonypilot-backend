import config from "../../config";
import { createToken } from "../../utils/tokenManage";
import { IJwtPayload } from "./auth.interface";
import AppError from "../../error/AppError";
import httpStatus from "http-status";
import { OAuth2Client } from "google-auth-library";
import jwt, { JwtHeader } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
// import firebaseAdmin from "../../utils/firebase";
const appleClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});
const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

const getAppleSigningKey = async (kid: string) => {
  const key = await appleClient.getSigningKey(kid);
  return key.getPublicKey();
};

export const generateTokens = (jwtPayload: IJwtPayload) => {
  const accessToken = createToken({
    payload: jwtPayload,
    access_secret: config.jwt_access_secret as string,
    expity_time: config.jwt_access_expires_in as string,
  });

  const refreshToken = createToken({
    payload: jwtPayload,
    access_secret: config.jwt_refresh_secret as string,
    expity_time: config.jwt_refresh_expires_in as string,
  });

  return { accessToken, refreshToken };
};

export const generateAndReturnTokens = (user: any) => {
  const payload: IJwtPayload = {
    userId: user._id.toString(),
    role: user?.role,
    fullName: user?.fullName || null,
    email: user?.email || null,
    phone: user?.phone || null,
    googleId: user?.googleId || null,
    isVerifiedByAdmin: user?.isVerifiedByAdmin || false,
  };
  console.log(payload, "payload =>>>>");
  const { accessToken, refreshToken } = generateTokens(payload);

  return { user, accessToken, refreshToken };
};




export const verifyGoogleToken = async (idToken: string) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log({ payload }, 'check data=')
    return {
      googleId: payload?.sub,
      email: payload?.email,
      name: payload?.name,
      picture: payload?.picture,
      emailVerified: payload?.email_verified,
    };
  } catch (error) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid Google ID token');
  }

  // firebase setup for google token verification
  // try {
  //   const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
  //   console.log({ decodedToken }, 'check data=')
  //   return {
  //     googleId: decodedToken?.sub,
  //     email: decodedToken?.email,
  //     name: decodedToken?.name,
  //     picture: decodedToken?.picture,
  //     emailVerified: decodedToken?.email_verified,
  //   };
  // } catch (error) {
  //   throw new AppError(httpStatus.FORBIDDEN, 'Invalid Google ID token');
  // }
};

export const verifyAppleToken = async (idToken: string) => {
  try {
    const decodedHeader = jwt.decode(idToken, {
      complete: true,
    });

    if (!decodedHeader) {
      throw new Error('Invalid token');
    }

    const kid = (decodedHeader.header as JwtHeader).kid;

    const publicKey = await getAppleSigningKey(kid!);

    // const payload = jwt.verify(idToken, publicKey, {
    //   algorithms: ['RS256'],
    //   issuer: 'https://appleid.apple.com',
    //   audience: config.APPLE_CLIENT_ID,
    // }) as jwt.JwtPayload;
      const payload = jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
      }) as jwt.JwtPayload;
    return {
      appleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload?.name || "new user",
    };


    // firebase wise setup

    // const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    // console.log({ decodedToken }, 'check data=')
    // return {
    //   appleId: decodedToken?.sub,
    //   email: decodedToken?.email,
    //   name: decodedToken?.name,
    //   picture: decodedToken?.picture,
    //   emailVerified: decodedToken?.email_verified,
    // };
  } catch (error) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid Apple ID token');
  }
};