import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret, getRefreshSecret } from '../config';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString, requireString } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

interface RefreshPayload {
  userId: string;
  email: string;
  tokenType: 'refresh';
}

const generateTokens = (userId: string, email: string) => ({
  accessToken: jwt.sign({ userId, email, tokenType: 'access' }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions),
  refreshToken: jwt.sign({ userId, email, tokenType: 'refresh' }, getRefreshSecret(), { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions),
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const email = requireString(body.email, 'Email', 254).toLowerCase();
    const password = requireString(body.password, '密碼', 128);
    if (password.length < 8) {
      res.status(400).json({ error: '密碼至少需要 8 個字元' });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ error: 'Email 格式錯誤' });
      return;
    }
    const displayName = optionalString(body.display_name, '顯示名稱', 100) || email.split('@')[0];
    const locale = optionalString(body.locale, '語系', 10) || 'zh-TW';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: '此 Email 已被註冊' });
      return;
    }

    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12), displayName, locale },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      ...generateTokens(user.id, user.email),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const email = requireString(body.email, 'Email', 254).toLowerCase();
    const password = requireString(body.password, '密碼', 128);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: '帳號或密碼錯誤' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      ...generateTokens(user.id, user.email),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const body = asRecord(req.body);
    const refreshToken = requireString(body.refreshToken, 'Refresh Token', 4096);
    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as Partial<RefreshPayload>;
    if (decoded.tokenType !== 'refresh' || typeof decoded.userId !== 'string') throw new Error('Invalid refresh payload');
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, email: true } });
    if (!user) throw new Error('User not found');
    res.json(generateTokens(user.id, user.email));
  } catch {
    res.status(401).json({ error: 'Refresh Token 無效或已過期' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, locale: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: '使用者不存在' });
      return;
    }
    res.json({ id: user.id, email: user.email, display_name: user.displayName, locale: user.locale, created_at: user.createdAt });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };