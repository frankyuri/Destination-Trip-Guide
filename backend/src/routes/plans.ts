import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:tripId/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.itineraryPlan.findMany({
      where: { tripId: req.params.tripId, trip: { userId: req.user!.userId } },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(plans.map((plan) => ({ id: plan.id, plan_name: plan.planName, is_active: plan.isActive, sort_order: plan.sortOrder })));
  } catch (error) {
    next(error);
  }
});

router.post('/:tripId/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const planName = optionalString(body.plan_name, '方案名稱', 50) || '新方案';
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user!.userId } });
    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }
    const maxOrder = await prisma.itineraryPlan.aggregate({ where: { tripId: trip.id }, _max: { sortOrder: true } });
    const plan = await prisma.itineraryPlan.create({
      data: { tripId: trip.id, planName, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    });
    res.status(201).json({ id: plan.id, plan_name: plan.planName, is_active: plan.isActive, sort_order: plan.sortOrder });
  } catch (error) {
    next(error);
  }
});

router.put('/:tripId/plans/:planId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const planName = optionalString(body.plan_name, '方案名稱', 50);
    const result = await prisma.itineraryPlan.updateMany({
      where: { id: req.params.planId, tripId: req.params.tripId, trip: { userId: req.user!.userId } },
      data: { ...(planName !== undefined && { planName }) },
    });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }
    res.json({ message: '方案已更新' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:tripId/plans/:planId/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.itineraryPlan.findFirst({
      where: {
        id: req.params.planId,
        tripId: req.params.tripId,
        trip: { userId: req.user!.userId },
      },
      select: { id: true, tripId: true },
    });
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    await prisma.$transaction([
      prisma.itineraryPlan.updateMany({ where: { tripId: plan.tripId }, data: { isActive: false } }),
      prisma.itineraryPlan.update({ where: { id: plan.id }, data: { isActive: true } }),
    ]);
    res.json({ message: '方案已啟用' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:tripId/plans/:planId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.itineraryPlan.deleteMany({
      where: { id: req.params.planId, tripId: req.params.tripId, trip: { userId: req.user!.userId } },
    });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }
    res.json({ message: '方案已刪除' });
  } catch (error) {
    next(error);
  }
});

export { router as plansRouter };