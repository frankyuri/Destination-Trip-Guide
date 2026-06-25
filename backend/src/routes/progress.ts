import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, requireBoolean } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/trips/:tripId/progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user!.userId }, select: { id: true } });
    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }
    const progress = await prisma.progress.findMany({
      where: { userId: req.user!.userId, item: { day: { plan: { tripId: trip.id } } } },
    });
    res.json(progress.map((record) => ({ item_id: record.itemId, is_completed: record.isCompleted, completed_at: record.completedAt })));
  } catch (error) {
    next(error);
  }
});

router.put('/progress/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const isCompleted = requireBoolean(body.is_completed, 'is_completed');
    const item = await prisma.itineraryItem.findFirst({
      where: { id: req.params.itemId, day: { plan: { trip: { userId: req.user!.userId } } } },
      select: { id: true },
    });
    if (!item) {
      res.status(404).json({ error: '找不到此行程項目' });
      return;
    }
    const record = await prisma.progress.upsert({
      where: { userId_itemId: { userId: req.user!.userId, itemId: item.id } },
      create: { userId: req.user!.userId, itemId: item.id, isCompleted, completedAt: isCompleted ? new Date() : null },
      update: { isCompleted, completedAt: isCompleted ? new Date() : null },
    });
    res.json({ item_id: record.itemId, is_completed: record.isCompleted, completed_at: record.completedAt });
  } catch (error) {
    next(error);
  }
});

export { router as progressRouter };