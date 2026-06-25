import { Prisma } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString, requireArray, requireString } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const itemInclude = {
  recommendedFoods: { orderBy: { sortOrder: 'asc' as const } },
  nearbySpots: { orderBy: { sortOrder: 'asc' as const } },
  shoppingSpots: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ItineraryItemInclude;

type ItemWithRelations = Prisma.ItineraryItemGetPayload<{ include: typeof itemInclude }>;
type DayWithItems = Prisma.ItineraryDayGetPayload<{ include: { items: { include: typeof itemInclude } } }>;

const formatItem = (item: ItemWithRelations) => ({
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
});

const formatDay = (day: DayWithItems) => ({
  id: day.id,
  date: day.isoDate.toISOString().slice(0, 10),
  date_label: day.dateLabel,
  day_title: day.dayTitle,
  theme: day.theme,
  focus: day.focus,
  sort_order: day.sortOrder,
  items: day.items.map(formatItem),
});

router.get('/:planId/days', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = await prisma.itineraryDay.findMany({
      where: { planId: req.params.planId, plan: { trip: { userId: req.user!.userId } } },
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' }, include: itemInclude } },
    });
    res.json(days.map(formatDay));
  } catch (error) {
    next(error);
  }
});

router.post('/:planId/days', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const plan = await prisma.itineraryPlan.findFirst({
      where: { id: req.params.planId, trip: { userId: req.user!.userId } },
    });
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }
    const maxOrder = await prisma.itineraryDay.aggregate({ where: { planId: plan.id }, _max: { sortOrder: true } });
    const isoDateText = requireString(body.iso_date, 'iso_date', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDateText)) {
      res.status(400).json({ error: 'iso_date 必須為 YYYY-MM-DD' });
      return;
    }
    const day = await prisma.itineraryDay.create({
      data: {
        planId: plan.id,
        isoDate: new Date(`${isoDateText}T00:00:00.000Z`),
        dateLabel: optionalString(body.date_label, '日期標籤', 20) || isoDateText,
        dayTitle: optionalString(body.day_title, '天數標題', 20) || `Day ${(maxOrder._max.sortOrder ?? -1) + 2}`,
        theme: optionalString(body.theme, '主題', 100) || '自由探索',
        focus: optionalString(body.focus, '重點', 200) || '新增的行程',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { items: { include: itemInclude } },
    });
    res.status(201).json(formatDay(day));
  } catch (error) {
    next(error);
  }
});

router.put('/:planId/days/:dayId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const isoDateText = optionalString(body.iso_date, 'iso_date', 10);
    if (isoDateText !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(isoDateText)) {
      res.status(400).json({ error: 'iso_date 必須為 YYYY-MM-DD' });
      return;
    }
    const result = await prisma.itineraryDay.updateMany({
      where: { id: req.params.dayId, planId: req.params.planId, plan: { trip: { userId: req.user!.userId } } },
      data: {
        ...(isoDateText !== undefined && { isoDate: new Date(`${isoDateText}T00:00:00.000Z`) }),
        ...(body.date_label !== undefined && { dateLabel: optionalString(body.date_label, '日期標籤', 20) || '' }),
        ...(body.day_title !== undefined && { dayTitle: optionalString(body.day_title, '天數標題', 20) || '' }),
        ...(body.theme !== undefined && { theme: optionalString(body.theme, '主題', 100) || '' }),
        ...(body.focus !== undefined && { focus: optionalString(body.focus, '重點', 200) || '' }),
      },
    });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }
    res.json({ message: '已更新' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:planId/days/:dayId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.itineraryDay.deleteMany({
      where: { id: req.params.dayId, planId: req.params.planId, plan: { trip: { userId: req.user!.userId } } },
    });
    if (result.count === 0) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }
    res.json({ message: '已刪除' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:planId/days/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const order = requireArray(body.order, 'order', 50).map((entry) => {
      const record = asRecord(entry);
      const id = requireString(record.id, 'id', 100);
      if (!Number.isInteger(record.sort_order) || (record.sort_order as number) < 0) throw new AppError('sort_order 格式錯誤', 400);
      return { id, sortOrder: record.sort_order as number };
    });
    const ids = order.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) {
      res.status(400).json({ error: 'order 不可包含重複 id' });
      return;
    }
    const ownedDays = await prisma.itineraryDay.findMany({
      where: { id: { in: ids }, planId: req.params.planId, plan: { trip: { userId: req.user!.userId } } },
      select: { id: true },
    });
    if (ownedDays.length !== order.length) {
      res.status(403).json({ error: 'order 包含無權限的天數' });
      return;
    }
    await prisma.$transaction(order.map((entry) => prisma.itineraryDay.update({ where: { id: entry.id }, data: { sortOrder: entry.sortOrder } })));
    res.json({ message: '排序已更新' });
  } catch (error) {
    next(error);
  }
});

export { router as daysRouter };