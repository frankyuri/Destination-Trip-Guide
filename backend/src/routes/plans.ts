/**
 * src/routes/plans.ts — 行程方案 CRUD
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/trips/:tripId/plans — 列出方案
 */
router.get('/:tripId/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const plans = await prisma.itineraryPlan.findMany({
      where: {
        tripId,
        trip: { userId: req.user!.userId },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(plans.map((p: any) => ({
      id: p.id,
      plan_name: p.planName,
      is_active: p.isActive,
      sort_order: p.sortOrder,
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/:tripId/plans — 新增方案
 */
router.post('/:tripId/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan_name } = req.body;
    const tripId = req.params.tripId as string;

    // Verify trip ownership
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.userId },
    });
    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }

    const maxOrder = await prisma.itineraryPlan.aggregate({
      where: { tripId: trip.id },
      _max: { sortOrder: true },
    });

    const plan = await prisma.itineraryPlan.create({
      data: {
        tripId: trip.id,
        planName: plan_name || '新方案',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    res.status(201).json({
      id: plan.id,
      plan_name: plan.planName,
      is_active: plan.isActive,
      sort_order: plan.sortOrder,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/trips/:tripId/plans/:planId — 更新方案
 */
router.put('/:tripId/plans/:planId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan_name } = req.body;
    const tripId = req.params.tripId as string;
    const planId = req.params.planId as string;

    const plan = await prisma.itineraryPlan.updateMany({
      where: {
        id: planId,
        tripId,
        trip: { userId: req.user!.userId },
      },
      data: { ...(plan_name !== undefined && { planName: plan_name }) },
    });

    if (plan.count === 0) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    res.json({ message: '方案已更新' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/trips/:tripId/plans/:planId/activate — 啟用此方案
 */
router.patch('/:tripId/plans/:planId/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const planId = req.params.planId as string;
    // Verify ownership
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.userId },
    });
    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }

    // Deactivate all plans, then activate the selected one
    await prisma.$transaction([
      prisma.itineraryPlan.updateMany({
        where: { tripId: trip.id },
        data: { isActive: false },
      }),
      prisma.itineraryPlan.update({
        where: { id: planId },
        data: { isActive: true },
      }),
    ]);

    res.json({ message: '方案已啟用' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId/plans/:planId — 刪除方案
 */
router.delete('/:tripId/plans/:planId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const planId = req.params.planId as string;
    const result = await prisma.itineraryPlan.deleteMany({
      where: {
        id: planId,
        tripId,
        trip: { userId: req.user!.userId },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    res.json({ message: '方案已刪除' });
  } catch (err) {
    next(err);
  }
});

export { router as plansRouter };
