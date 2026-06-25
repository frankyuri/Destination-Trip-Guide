/**
 * src/routes/items.ts — 行程項目 CRUD
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * POST /api/days/:dayId/items — 新增項目
 */
router.post('/days/:dayId/items', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dayId = req.params.dayId as string;
    const {
      time, title, description, address_jp, address_en,
      lat, lng, transport_type, transport_detail, google_maps_query,
      recommended_foods, nearby_spots, shopping_spots,
    } = req.body;

    // Verify ownership via chain
    const day = await prisma.itineraryDay.findFirst({
      where: {
        id: dayId,
        plan: { trip: { userId: req.user!.userId } },
      },
    });
    if (!day) {
      res.status(404).json({ error: '找不到此天' });
      return;
    }

    const maxOrder = await prisma.itineraryItem.aggregate({
      where: { dayId: day.id },
      _max: { sortOrder: true },
    });

    const item = await prisma.itineraryItem.create({
      data: {
        dayId: day.id,
        time: time || '09:00',
        title: title || '新行程',
        description: description || '',
        addressJp: address_jp || '',
        addressEn: address_en || '',
        lat: lat || 33.5902,
        lng: lng || 130.4017,
        transportType: transport_type || 'WALK',
        transportDetail: transport_detail || '',
        googleMapsQuery: google_maps_query || '',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        // Create sub-items
        recommendedFoods: {
          create: (recommended_foods || []).map((name: string, i: number) => ({
            name,
            sortOrder: i,
          })),
        },
        nearbySpots: {
          create: (nearby_spots || []).map((name: string, i: number) => ({
            name,
            sortOrder: i,
          })),
        },
        shoppingSpots: {
          create: (shopping_spots || []).map((s: any, i: number) => ({
            name: s.name,
            category: s.category || '',
            description: s.description || '',
            sortOrder: i,
          })),
        },
      },
      include: {
        recommendedFoods: { orderBy: { sortOrder: 'asc' } },
        nearbySpots: { orderBy: { sortOrder: 'asc' } },
        shoppingSpots: { orderBy: { sortOrder: 'asc' } },
      },
    });

    res.status(201).json(formatItem(item));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/items/:itemId — 更新項目（含子項目 replace 策略）
 */
router.put('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params.itemId as string;
    const {
      time, title, description, address_jp, address_en,
      lat, lng, transport_type, transport_detail, google_maps_query,
      recommended_foods, nearby_spots, shopping_spots,
    } = req.body;

    // Verify ownership
    const existing = await prisma.itineraryItem.findFirst({
      where: {
        id: itemId,
        day: { plan: { trip: { userId: req.user!.userId } } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: '找不到此行程項目' });
      return;
    }

    // Transaction: update item + replace sub-items
    await prisma.$transaction(async (tx) => {
      // Update main item
      await tx.itineraryItem.update({
        where: { id: itemId },
        data: {
          ...(time !== undefined && { time }),
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(address_jp !== undefined && { addressJp: address_jp }),
          ...(address_en !== undefined && { addressEn: address_en }),
          ...(lat !== undefined && { lat }),
          ...(lng !== undefined && { lng }),
          ...(transport_type !== undefined && { transportType: transport_type }),
          ...(transport_detail !== undefined && { transportDetail: transport_detail }),
          ...(google_maps_query !== undefined && { googleMapsQuery: google_maps_query }),
        },
      });

      // Replace sub-items if provided
      if (recommended_foods !== undefined) {
        await tx.recommendedFood.deleteMany({ where: { itemId } });
        if (recommended_foods.length > 0) {
          await tx.recommendedFood.createMany({
            data: recommended_foods.map((name: string, i: number) => ({
              itemId,
              name,
              sortOrder: i,
            })),
          });
        }
      }

      if (nearby_spots !== undefined) {
        await tx.nearbySpot.deleteMany({ where: { itemId } });
        if (nearby_spots.length > 0) {
          await tx.nearbySpot.createMany({
            data: nearby_spots.map((name: string, i: number) => ({
              itemId,
              name,
              sortOrder: i,
            })),
          });
        }
      }

      if (shopping_spots !== undefined) {
        await tx.shoppingSpot.deleteMany({ where: { itemId } });
        if (shopping_spots.length > 0) {
          await tx.shoppingSpot.createMany({
            data: shopping_spots.map((s: any, i: number) => ({
              itemId,
              name: s.name,
              category: s.category || '',
              description: s.description || '',
              sortOrder: i,
            })),
          });
        }
      }
    });

    // Fetch updated
    const updated = await prisma.itineraryItem.findUnique({
      where: { id: itemId },
      include: {
        recommendedFoods: { orderBy: { sortOrder: 'asc' } },
        nearbySpots: { orderBy: { sortOrder: 'asc' } },
        shoppingSpots: { orderBy: { sortOrder: 'asc' } },
      },
    });

    res.json(formatItem(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/items/:itemId — 刪除項目
 */
router.delete('/items/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params.itemId as string;
    const existing = await prisma.itineraryItem.findFirst({
      where: {
        id: itemId,
        day: { plan: { trip: { userId: req.user!.userId } } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: '找不到此行程項目' });
      return;
    }

    await prisma.itineraryItem.delete({ where: { id: itemId } });
    res.json({ message: '項目已刪除' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/days/:dayId/items/reorder — 重新排序
 */
router.patch('/days/:dayId/items/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      res.status(400).json({ error: '請提供 order 陣列' });
      return;
    }

    await prisma.$transaction(
      order.map((item: { id: string; sort_order: number }) =>
        prisma.itineraryItem.update({
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

// --- Helper ---
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

export { router as itemsRouter };
