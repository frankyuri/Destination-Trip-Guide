import { Prisma, TransportType } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString, requireArray, requireFiniteNumber, requireString } from '../lib/validation';
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

const parseTime = (value: unknown, required: boolean): string | undefined => {
  if (value === undefined && !required) return undefined;
  const time = requireString(value, 'time', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new AppError('time 格式必須為 HH:mm', 400);
  return time;
};

const parseTransportType = (value: unknown, required: boolean): TransportType | undefined => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !Object.values(TransportType).includes(value as TransportType)) throw new AppError('transport_type 格式錯誤', 400);
  return value as TransportType;
};

const parseStringList = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined) return undefined;
  return requireArray(value, field, 50).map((entry) => requireString(entry, field, 200));
};

interface ShoppingInput { name: string; category: string; description: string }
const parseShoppingList = (value: unknown): ShoppingInput[] | undefined => {
  if (value === undefined) return undefined;
  return requireArray(value, 'shopping_spots', 50).map((entry) => {
    const record = asRecord(entry);
    return {
      name: requireString(record.name, '購物點名稱', 200),
      category: optionalString(record.category, '購物點分類', 50) || '',
      description: optionalString(record.description, '購物點說明', 2000) || '',
    };
  });
};

router.post('/days/:dayId/items', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const day = await prisma.itineraryDay.findFirst({
      where: { id: req.params.dayId, plan: { trip: { userId: req.user!.userId } } },
      select: { id: true },
    });
    if (!day) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }

    const recommendedFoods = parseStringList(body.recommended_foods, 'recommended_foods') || [];
    const nearbySpots = parseStringList(body.nearby_spots, 'nearby_spots') || [];
    const shoppingSpots = parseShoppingList(body.shopping_spots) || [];
    const maxOrder = await prisma.itineraryItem.aggregate({ where: { dayId: day.id }, _max: { sortOrder: true } });
    const item = await prisma.itineraryItem.create({
      data: {
        dayId: day.id,
        time: parseTime(body.time, true)!,
        title: requireString(body.title, 'title', 200),
        description: optionalString(body.description, 'description', 5000) || '',
        addressJp: optionalString(body.address_jp, 'address_jp', 300) || '',
        addressEn: optionalString(body.address_en, 'address_en', 300) || '',
        lat: requireFiniteNumber(body.lat, 'lat', -90, 90),
        lng: requireFiniteNumber(body.lng, 'lng', -180, 180),
        transportType: parseTransportType(body.transport_type, true)!,
        transportDetail: optionalString(body.transport_detail, 'transport_detail', 200) || '',
        googleMapsQuery: optionalString(body.google_maps_query, 'google_maps_query', 300) || '',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        recommendedFoods: { create: recommendedFoods.map((name, sortOrder) => ({ name, sortOrder })) },
        nearbySpots: { create: nearbySpots.map((name, sortOrder) => ({ name, sortOrder })) },
        shoppingSpots: { create: shoppingSpots.map((spot, sortOrder) => ({ ...spot, sortOrder })) },
      },
      include: itemInclude,
    });
    res.status(201).json(formatItem(item));
  } catch (error) {
    next(error);
  }
});

router.put('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const existing = await prisma.itineraryItem.findFirst({
      where: { id: req.params.itemId, day: { plan: { trip: { userId: req.user!.userId } } } },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: '找不到此行程項目' });
      return;
    }

    const recommendedFoods = parseStringList(body.recommended_foods, 'recommended_foods');
    const nearbySpots = parseStringList(body.nearby_spots, 'nearby_spots');
    const shoppingSpots = parseShoppingList(body.shopping_spots);
    await prisma.$transaction(async (tx) => {
      await tx.itineraryItem.update({
        where: { id: existing.id },
        data: {
          ...(body.time !== undefined && { time: parseTime(body.time, false) }),
          ...(body.title !== undefined && { title: requireString(body.title, 'title', 200) }),
          ...(body.description !== undefined && { description: optionalString(body.description, 'description', 5000) }),
          ...(body.address_jp !== undefined && { addressJp: optionalString(body.address_jp, 'address_jp', 300) }),
          ...(body.address_en !== undefined && { addressEn: optionalString(body.address_en, 'address_en', 300) }),
          ...(body.lat !== undefined && { lat: requireFiniteNumber(body.lat, 'lat', -90, 90) }),
          ...(body.lng !== undefined && { lng: requireFiniteNumber(body.lng, 'lng', -180, 180) }),
          ...(body.transport_type !== undefined && { transportType: parseTransportType(body.transport_type, false) }),
          ...(body.transport_detail !== undefined && { transportDetail: optionalString(body.transport_detail, 'transport_detail', 200) }),
          ...(body.google_maps_query !== undefined && { googleMapsQuery: optionalString(body.google_maps_query, 'google_maps_query', 300) }),
        },
      });

      if (recommendedFoods !== undefined) {
        await tx.recommendedFood.deleteMany({ where: { itemId: existing.id } });
        if (recommendedFoods.length) await tx.recommendedFood.createMany({ data: recommendedFoods.map((name, sortOrder) => ({ itemId: existing.id, name, sortOrder })) });
      }
      if (nearbySpots !== undefined) {
        await tx.nearbySpot.deleteMany({ where: { itemId: existing.id } });
        if (nearbySpots.length) await tx.nearbySpot.createMany({ data: nearbySpots.map((name, sortOrder) => ({ itemId: existing.id, name, sortOrder })) });
      }
      if (shoppingSpots !== undefined) {
        await tx.shoppingSpot.deleteMany({ where: { itemId: existing.id } });
        if (shoppingSpots.length) await tx.shoppingSpot.createMany({ data: shoppingSpots.map((spot, sortOrder) => ({ itemId: existing.id, ...spot, sortOrder })) });
      }
    });

    const updated = await prisma.itineraryItem.findUniqueOrThrow({ where: { id: existing.id }, include: itemInclude });
    res.json(formatItem(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.itineraryItem.findFirst({
      where: { id: req.params.itemId, day: { plan: { trip: { userId: req.user!.userId } } } },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({ error: '找不到此行程項目' });
      return;
    }
    await prisma.itineraryItem.delete({ where: { id: existing.id } });
    res.json({ message: '項目已刪除' });
  } catch (error) {
    next(error);
  }
});

router.patch('/days/:dayId/items/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const order = requireArray(body.order, 'order', 100).map((entry) => {
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
    const ownedItems = await prisma.itineraryItem.findMany({
      where: { id: { in: ids }, dayId: req.params.dayId, day: { plan: { trip: { userId: req.user!.userId } } } },
      select: { id: true },
    });
    if (ownedItems.length !== order.length) {
      res.status(403).json({ error: 'order 包含無權限的項目' });
      return;
    }
    await prisma.$transaction(order.map((entry) => prisma.itineraryItem.update({ where: { id: entry.id }, data: { sortOrder: entry.sortOrder } })));
    res.json({ message: '排序已更新' });
  } catch (error) {
    next(error);
  }
});

export { router as itemsRouter };