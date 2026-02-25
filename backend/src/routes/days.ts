/**
 * src/routes/days.ts — 每日行程 CRUD
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/plans/:planId/days — 列出所有天 (含 items)
 */
router.get('/:planId/days', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const days = await prisma.itineraryDay.findMany({
      where: {
        planId,
        plan: { trip: { userId: req.user!.userId } },
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            recommendedFoods: { orderBy: { sortOrder: 'asc' } },
            nearbySpots: { orderBy: { sortOrder: 'asc' } },
            shoppingSpots: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    res.json(days.map(formatDay));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plans/:planId/days — 新增一天
 */
router.post('/:planId/days', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date_label, day_title, theme, focus } = req.body;
    const planId = req.params.planId as string;

    // Verify ownership
    const plan = await prisma.itineraryPlan.findFirst({
      where: {
        id: planId,
        trip: { userId: req.user!.userId },
      },
    });
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    const maxOrder = await prisma.itineraryDay.aggregate({
      where: { planId: plan.id },
      _max: { sortOrder: true },
    });

    const day = await prisma.itineraryDay.create({
      data: {
        planId: plan.id,
        dateLabel: date_label || 'New Date',
        dayTitle: day_title || `Day ${(maxOrder._max.sortOrder ?? 0) + 1}`,
        theme: theme || '自由探索',
        focus: focus || '新增的行程',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    res.status(201).json(formatDay({ ...day, items: [] }));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/plans/:planId/days/:dayId — 更新某天
 */
router.put('/:planId/days/:dayId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date_label, day_title, theme, focus } = req.body;
    const planId = req.params.planId as string;
    const dayId = req.params.dayId as string;

    const result = await prisma.itineraryDay.updateMany({
      where: {
        id: dayId,
        planId,
        plan: { trip: { userId: req.user!.userId } },
      },
      data: {
        ...(date_label !== undefined && { dateLabel: date_label }),
        ...(day_title !== undefined && { dayTitle: day_title }),
        ...(theme !== undefined && { theme }),
        ...(focus !== undefined && { focus }),
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }

    res.json({ message: '已更新' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/plans/:planId/days/:dayId — 刪除某天
 */
router.delete('/:planId/days/:dayId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const dayId = req.params.dayId as string;

    const result = await prisma.itineraryDay.deleteMany({
      where: {
        id: dayId,
        planId,
        plan: { trip: { userId: req.user!.userId } },
      },
    });

    if (result.count === 0) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }

    res.json({ message: '已刪除' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/plans/:planId/days/reorder — 重新排序
 */
router.patch('/:planId/days/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { order } = req.body; // [{ id: string, sort_order: number }]

    if (!Array.isArray(order)) {
      res.status(400).json({ error: '請提供 order 陣列' });
      return;
    }

    await prisma.$transaction(
      order.map((item: { id: string; sort_order: number }) =>
        prisma.itineraryDay.update({
          where: { id: item.id },
          data: { sortOrder: item.sort_order },
        })
      )
    );

    res.json({ message: '排序已更新' });
  } catch (err) {
    next(err);
  }
});

// --- Helpers ---
function formatDay(day: any) {
  return {
    id: day.id,
    date_label: day.dateLabel,
    day_title: day.dayTitle,
    theme: day.theme,
    focus: day.focus,
    sort_order: day.sortOrder,
    items: day.items?.map(formatItem) || [],
  };
}

function formatItem(item: any) {
  return {
    id: item.id,
    time: item.time,
    title: item.title,
    description: item.description,
    address_jp: item.addressJp,
    address_en: item.addressEn,
    lat: Number(item.lat),
    lng: Number(item.lng),
    transport_type: item.transportType,
    transport_detail: item.transportDetail,
    google_maps_query: item.googleMapsQuery,
    sort_order: item.sortOrder,
    recommended_foods: item.recommendedFoods?.map((f: any) => f.name) || [],
    nearby_spots: item.nearbySpots?.map((s: any) => s.name) || [],
    shopping_spots: item.shoppingSpots?.map((s: any) => ({
      name: s.name,
      category: s.category,
      description: s.description,
    })) || [],
  };
}

export { router as daysRouter };
