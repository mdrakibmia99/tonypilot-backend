import { Request, Response, NextFunction } from 'express';
import auth from './auth'; // তোমার existing auth middleware

export const optionalAuth =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.headers?.authorization?.split(' ')[1] ||
      (req.headers?.token as string | undefined);

    if (token) {

      return auth(...roles)(req, res, next);
    }

    next();
  };