/**
 * src/middleware/errorHandler.ts — 全域錯誤處理
 */
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma known errors
  if ((err as any).code === 'P2002') {
    res.status(409).json({ error: '資料已存在 (唯一鍵衝突)' });
    return;
  }

  if ((err as any).code === 'P2025') {
    res.status(404).json({ error: '找不到指定的資料' });
    return;
  }

  res.status(500).json({ error: '伺服器內部錯誤' });
};
