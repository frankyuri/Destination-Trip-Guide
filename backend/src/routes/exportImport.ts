/**
 * src/routes/exportImport.ts — 匯出 / 匯入
 */
import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/plans/:planId/export/json — 匯出 JSON
 */
router.get('/:planId/export/json', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const plan = await prisma.itineraryPlan.findFirst({
      where: {
        id: planId,
        trip: { userId: req.user!.userId },
      },
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
    });

    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    // Format to match frontend DayItinerary[] structure
    const itinerary = plan.days.map(day => ({
      date: day.dateLabel,
      dayTitle: day.dayTitle,
      theme: day.theme,
      focus: day.focus,
      items: day.items.map(item => ({
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description || '',
        address_jp: item.addressJp || '',
        address_en: item.addressEn || '',
        coordinates: { lat: Number(item.lat), lng: Number(item.lng) },
        transportType: item.transportType,
        transportDetail: item.transportDetail || '',
        googleMapsQuery: item.googleMapsQuery || '',
        recommendedFood: item.recommendedFoods.map(f => f.name),
        nearbySpots: item.nearbySpots.map(s => s.name),
        shoppingSideQuests: item.shoppingSpots.map(s => ({
          name: s.name,
          category: s.category,
          description: s.description || '',
        })),
      })),
    }));

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: plan.planName,
      itinerary,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fukuoka-trip-${plan.planName}.json"`);
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/plans/:planId/export/ics — 匯出 ICS 日曆
 */
router.get('/:planId/export/ics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const plan = await prisma.itineraryPlan.findFirst({
      where: {
        id: planId,
        trip: { userId: req.user!.userId },
      },
      include: {
        days: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();

    const events = plan.days.flatMap(day => {
      const dateMatch = day.dateLabel.match(/(\d{1,2})\/(\d{1,2})/);
      if (!dateMatch) return [];

      const month = parseInt(dateMatch[1], 10);
      const dayNum = parseInt(dateMatch[2], 10);
      const tentativeDate = new Date(currentYear, month - 1, dayNum);
      const year = tentativeDate < now ? currentYear + 1 : currentYear;

      return day.items.map(item => {
        const [hours, minutes] = item.time.split(':').map(Number);
        const startDate = new Date(year, month - 1, dayNum, hours, minutes);
        const endDate = new Date(startDate.getTime() + 90 * 60000);

        return [
          'BEGIN:VEVENT',
          `UID:${item.id}@fukuokatrip.com`,
          `DTSTAMP:${formatICSDate(now)}`,
          `DTSTART:${formatICSDate(startDate)}`,
          `DTEND:${formatICSDate(endDate)}`,
          `SUMMARY:${escapeICS(item.title)}`,
          `DESCRIPTION:${escapeICS(item.description || '')}`,
          `LOCATION:${escapeICS(item.addressJp || '')}`,
          'END:VEVENT',
        ].join('\r\n');
      });
    });

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Fukuoka Trip Guide//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Fukuoka Trip',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fukuoka-trip.ics"');
    res.send(icsContent);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/plans/:planId/import/json — 匯入 JSON
 */
router.post('/:planId/import/json', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const { itinerary } = req.body;

    if (!Array.isArray(itinerary)) {
      res.status(400).json({ error: 'itinerary 必須為陣列' });
      return;
    }

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

    // Clear existing days for this plan
    await prisma.itineraryDay.deleteMany({ where: { planId: plan.id } });

    // Import all days
    for (let di = 0; di < itinerary.length; di++) {
      const dayData = itinerary[di];
      const day = await prisma.itineraryDay.create({
        data: {
          planId: plan.id,
          dateLabel: dayData.date || dayData.date_label || `Day ${di + 1}`,
          dayTitle: dayData.dayTitle || dayData.day_title || `Day ${di + 1}`,
          theme: dayData.theme || '',
          focus: dayData.focus || '',
          sortOrder: di,
        },
      });

      for (let ii = 0; ii < (dayData.items || []).length; ii++) {
        const itemData = dayData.items[ii];
        await prisma.itineraryItem.create({
          data: {
            dayId: day.id,
            time: itemData.time || '09:00',
            title: itemData.title || '',
            description: itemData.description || '',
            addressJp: itemData.address_jp || '',
            addressEn: itemData.address_en || '',
            lat: itemData.coordinates?.lat || itemData.lat || 33.5902,
            lng: itemData.coordinates?.lng || itemData.lng || 130.4017,
            transportType: itemData.transportType || itemData.transport_type || 'WALK',
            transportDetail: itemData.transportDetail || itemData.transport_detail || '',
            googleMapsQuery: itemData.googleMapsQuery || itemData.google_maps_query || '',
            sortOrder: ii,
            recommendedFoods: {
              create: (itemData.recommendedFood || itemData.recommended_foods || []).map(
                (name: string, i: number) => ({ name, sortOrder: i })
              ),
            },
            nearbySpots: {
              create: (itemData.nearbySpots || itemData.nearby_spots || []).map(
                (name: string, i: number) => ({ name, sortOrder: i })
              ),
            },
            shoppingSpots: {
              create: (itemData.shoppingSideQuests || itemData.shopping_spots || []).map(
                (s: any, i: number) => ({
                  name: s.name,
                  category: s.category || '',
                  description: s.description || '',
                  sortOrder: i,
                })
              ),
            },
          },
        });
      }
    }

    res.json({ message: '匯入成功', days_imported: itinerary.length });
  } catch (err) {
    next(err);
  }
});

// --- Helpers ---
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d+/g, '');
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

export { router as exportRouter };
