import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config';

export interface AuthPayload {
  userId: string;
  email: string;
  tokenType: 'access';
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

const decodeAccessToken = (token: string): AuthPayload => {
  const decoded = jwt.verify(token, getJwtSecret()) as Partial<AuthPayload>;
  if (decoded.tokenType !== 'access' || typeof decoded.userId !== 'string' || typeof decoded.email !== 'string') {
    throw new Error('Invalid access token payload');
  }
  return decoded as AuthPayload;
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供認證 Token' });
    return;
  }

  try {
    req.user = decodeAccessToken(authHeader.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效或已過期' });
  }
};

export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = decodeAccessToken(authHeader.slice(7));
    } catch {
      req.user = undefined;
    }
  }
  next();
};