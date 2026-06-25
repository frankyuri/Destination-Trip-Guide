/**
 * src/routes/progress.ts — 進度追蹤
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/trips/:tripId/progress — 取得該旅程所有完成進度
 */
router.get('/trips/:tripId/progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const progress = await prisma.progress.findMany({
      where: {
        userId: req.user!.userId,
        item: {
          day: {
            plan: { tripId },
          },
        },
      },
    });

    res.json(progress.map(p => ({
      item_id: p.itemId,
      is_completed: p.isCompleted,
      completed_at: p.completedAt,
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/progress/:itemId — 切換完成/未完成
 */
router.put('/progress/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { is_completed } = req.body;
    const userId = req.user!.userId;
    const itemId = req.params.itemId as string;

    const record = await prisma.progress.upsert({
      where: {
        userId_itemId: { userId, itemId },
      },
      create: {
        userId,
        itemId,
        isCompleted: is_completed ?? true,
        completedAt: is_completed ? new Date() : null,
      },
      update: {
        isCompleted: is_completed ?? true,
        completedAt: is_completed ? new Date() : null,
      },
    });

    res.json({
      item_id: record.itemId,
      is_completed: record.isCompleted,
      completed_at: record.completedAt,
    });
  } catch (err) {
    next(err);
  }
});

export { router as progressRouter };
