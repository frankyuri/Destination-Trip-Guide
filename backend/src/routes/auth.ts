/**
 * src/routes/auth.ts — 認證相關路由
 */
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
  const refreshToken = jwt.sign(
    { userId, email },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, display_name, locale } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email 和密碼為必填' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: '此 Email 已被註冊' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: display_name || email.split('@')[0],
        locale: locale || 'zh-TW',
      },
    });

    const tokens = generateTokens(user.id, user.email);

    res.status(201).json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email 和密碼為必填' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: '帳號或密碼錯誤' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: '帳號或密碼錯誤' });
      return;
    }

    const tokens = generateTokens(user.id, user.email);

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: '請提供 Refresh Token' });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string; email: string };
    const tokens = generateTokens(decoded.userId, decoded.email);

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Refresh Token 無效或已過期' });
  }
});

/**
 * GET /api/auth/me
 */
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

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      created_at: user.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
