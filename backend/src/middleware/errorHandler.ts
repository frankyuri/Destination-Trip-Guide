import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: '資料已存在' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: '找不到指定的資料' });
      return;
    }
  }

  if (error.message.includes('來源不允許')) {
    res.status(403).json({ error: error.message });
    return;
  }

  console.error('Unhandled API error:', error);
  res.status(500).json({ error: '伺服器內部錯誤' });
};