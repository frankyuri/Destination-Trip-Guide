/**
 * src/routes/trips.ts — 旅程 CRUD
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All trip routes require authentication
router.use(authenticate);

/**
 * GET /api/trips — 列出我的旅程
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.user!.userId },
      include: {
        plans: {
          select: { id: true, planName: true, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(trips.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      start_date: t.startDate,
      end_date: t.endDate,
      plans: t.plans.map(p => ({
        id: p.id,
        plan_name: p.planName,
        is_active: p.isActive,
      })),
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips — 建立旅程
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, start_date, end_date } = req.body;

    if (!name) {
      res.status(400).json({ error: '旅程名稱為必填' });
      return;
    }

    const trip = await prisma.trip.create({
      data: {
        userId: req.user!.userId,
        name,
        description,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
      },
    });

    res.status(201).json({
      id: trip.id,
      name: trip.name,
      description: trip.description,
      start_date: trip.startDate,
      end_date: trip.endDate,
      created_at: trip.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:tripId — 取得旅程詳情
 */
router.get('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user!.userId },
      include: {
        plans: {
          orderBy: { sortOrder: 'asc' },
          include: {
            days: {
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
            },
          },
        },
      },
    });

    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }

    res.json(formatTrip(trip));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/trips/:tripId — 更新旅程
 */
router.put('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, start_date, end_date } = req.body;

    const tripId = req.params.tripId as string;
    const trip = await prisma.trip.updateMany({
      where: { id: tripId, userId: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(start_date !== undefined && { startDate: start_date ? new Date(start_date) : null }),
        ...(end_date !== undefined && { endDate: end_date ? new Date(end_date) : null }),
      },
    });

    if (trip.count === 0) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }

    const updated = await prisma.trip.findUnique({ where: { id: tripId } });
    res.json({ id: updated!.id, name: updated!.name, description: updated!.description });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trips/:tripId — 刪除旅程
 */
router.delete('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tripId = req.params.tripId as string;
    const result = await prisma.trip.deleteMany({
      where: { id: tripId, userId: req.user!.userId },
    });

    if (result.count === 0) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }

    res.json({ message: '旅程已刪除' });
  } catch (err) {
    next(err);
  }
});

// --- Helper ---
function formatTrip(trip: any) {
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description,
    start_date: trip.startDate,
    end_date: trip.endDate,
    plans: trip.plans?.map((p: any) => ({
      id: p.id,
      plan_name: p.planName,
      is_active: p.isActive,
      days: p.days?.map((d: any) => ({
        id: d.id,
        date_label: d.dateLabel,
        day_title: d.dayTitle,
        theme: d.theme,
        focus: d.focus,
        sort_order: d.sortOrder,
        items: d.items?.map(formatItem),
      })),
    })),
    created_at: trip.createdAt,
    updated_at: trip.updatedAt,
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

export { router as tripsRouter };
