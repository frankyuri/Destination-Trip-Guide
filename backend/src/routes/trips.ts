import { Prisma } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString, requireIsoDate, requireString } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const tripInclude = {
  plans: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      days: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' as const },
            include: {
              recommendedFoods: { orderBy: { sortOrder: 'asc' as const } },
              nearbySpots: { orderBy: { sortOrder: 'asc' as const } },
              shoppingSpots: { orderBy: { sortOrder: 'asc' as const } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TripInclude;

type FullTrip = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

const formatTrip = (trip: FullTrip) => ({
  id: trip.id,
  name: trip.name,
  description: trip.description,
  start_date: trip.startDate,
  end_date: trip.endDate,
  plans: trip.plans.map((plan) => ({
    id: plan.id,
    plan_name: plan.planName,
    is_active: plan.isActive,
    days: plan.days.map((day) => ({
      id: day.id,
      isoDate: day.isoDate.toISOString().slice(0, 10),
      date: day.dateLabel,
      dayTitle: day.dayTitle,
      theme: day.theme,
      focus: day.focus,
      sort_order: day.sortOrder,
      items: day.items.map((item) => ({
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description,
        address_jp: item.addressJp,
        address_en: item.addressEn,
        coordinates: { lat: Number(item.lat), lng: Number(item.lng) },
        transportType: item.transportType,
        transportDetail: item.transportDetail,
        googleMapsQuery: item.googleMapsQuery,
        sort_order: item.sortOrder,
        recommendedFood: item.recommendedFoods.map((food) => food.name),
        nearbySpots: item.nearbySpots.map((spot) => spot.name),
        shoppingSideQuests: item.shoppingSpots.map((spot) => ({ name: spot.name, category: spot.category, description: spot.description })),
      })),
    })),
  })),
  created_at: trip.createdAt,
  updated_at: trip.updatedAt,
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.user!.userId },
      include: { plans: { select: { id: true, planName: true, isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(trips.map((trip) => ({
      id: trip.id, name: trip.name, description: trip.description, start_date: trip.startDate, end_date: trip.endDate,
      plans: trip.plans.map((plan) => ({ id: plan.id, plan_name: plan.planName, is_active: plan.isActive })),
      created_at: trip.createdAt, updated_at: trip.updatedAt,
    })));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const startDate = body.start_date === undefined || body.start_date === null ? null : requireIsoDate(body.start_date, 'start_date');
    const endDate = body.end_date === undefined || body.end_date === null ? null : requireIsoDate(body.end_date, 'end_date');
    if (startDate && endDate && endDate < startDate) {
      res.status(400).json({ error: 'end_date 不可早於 start_date' });
      return;
    }
    const trip = await prisma.trip.create({
      data: {
        userId: req.user!.userId,
        name: requireString(body.name, '旅程名稱', 200),
        description: optionalString(body.description, '旅程說明', 5000),
        startDate,
        endDate,
      },
    });
    res.status(201).json({ id: trip.id, name: trip.name, description: trip.description, start_date: trip.startDate, end_date: trip.endDate, created_at: trip.createdAt });
  } catch (error) {
    next(error);
  }
});

router.get('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: req.user!.userId }, include: tripInclude });
    if (!trip) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }
    res.json(formatTrip(trip));
  } catch (error) {
    next(error);
  }
});

router.put('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const startDate = body.start_date === undefined ? undefined : body.start_date === null ? null : requireIsoDate(body.start_date, 'start_date');
    const endDate = body.end_date === undefined ? undefined : body.end_date === null ? null : requireIsoDate(body.end_date, 'end_date');
    const result = await prisma.trip.updateMany({
      where: { id: req.params.tripId, userId: req.user!.userId },
      data: {
        ...(body.name !== undefined && { name: requireString(body.name, '旅程名稱', 200) }),
        ...(body.description !== undefined && { description: optionalString(body.description, '旅程說明', 5000) }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
      },
    });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }
    const updated = await prisma.trip.findUniqueOrThrow({ where: { id: req.params.tripId } });
    res.json({ id: updated.id, name: updated.name, description: updated.description, start_date: updated.startDate, end_date: updated.endDate });
  } catch (error) {
    next(error);
  }
});

router.delete('/:tripId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.trip.deleteMany({ where: { id: req.params.tripId, userId: req.user!.userId } });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此旅程' });
      return;
    }
    res.json({ message: '旅程已刪除' });
  } catch (error) {
    next(error);
  }
});

export { router as tripsRouter };