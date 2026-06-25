import { Prisma, TransportType } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { asRecord, optionalString, requireArray, requireFiniteNumber, requireString } from '../lib/validation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const planInclude = {
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
} satisfies Prisma.ItineraryPlanInclude;

type PlanExport = Prisma.ItineraryPlanGetPayload<{ include: typeof planInclude }>;

const getOwnedPlan = (planId: string, userId: string) => prisma.itineraryPlan.findFirst({
  where: { id: planId, trip: { userId } },
  include: planInclude,
});

const formatItinerary = (plan: PlanExport) => plan.days.map((day) => ({
  isoDate: day.isoDate.toISOString().slice(0, 10),
  date: day.dateLabel,
  dayTitle: day.dayTitle,
  theme: day.theme,
  focus: day.focus,
  items: day.items.map((item) => ({
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
    recommendedFood: item.recommendedFoods.map((food) => food.name),
    nearbySpots: item.nearbySpots.map((spot) => spot.name),
    shoppingSideQuests: item.shoppingSpots.map((spot) => ({ name: spot.name, category: spot.category, description: spot.description || '' })),
  })),
}));

router.get('/:planId/export/json', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await getOwnedPlan(req.params.planId, req.user!.userId);
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }
    const filename = plan.planName.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 50) || 'trip';
    res.setHeader('Content-Disposition', `attachment; filename="fukuoka-${filename}.json"`);
    res.json({ version: 2, exportedAt: new Date().toISOString(), plan: plan.planName, itinerary: formatItinerary(plan) });
  } catch (error) {
    next(error);
  }
});

const escapeICS = (value: string): string => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const formatUtc = (date: Date): string => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
const localDateTime = (isoDate: string, time: string): string => `${isoDate.replace(/-/g, '')}T${time.replace(':', '')}00`;

const addLocalMinutes = (isoDate: string, time: string, minutes: number): { isoDate: string; time: string } => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return {
    isoDate: result.toISOString().slice(0, 10),
    time: `${String(result.getUTCHours()).padStart(2, '0')}:${String(result.getUTCMinutes()).padStart(2, '0')}`,
  };
};

router.get('/:planId/export/ics', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await getOwnedPlan(req.params.planId, req.user!.userId);
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }
    const now = new Date();
    const events = plan.days.flatMap((day) => {
      const isoDate = day.isoDate.toISOString().slice(0, 10);
      return day.items.map((item) => {
        const end = addLocalMinutes(isoDate, item.time, 90);
        return [
          'BEGIN:VEVENT',
          `UID:${escapeICS(item.id)}@fukuoka-trip-guide`,
          `DTSTAMP:${formatUtc(now)}`,
          `DTSTART;TZID=Asia/Tokyo:${localDateTime(isoDate, item.time)}`,
          `DTEND;TZID=Asia/Tokyo:${localDateTime(end.isoDate, end.time)}`,
          `SUMMARY:${escapeICS(item.title)}`,
          `DESCRIPTION:${escapeICS(item.description || '')}`,
          `LOCATION:${escapeICS(item.addressJp || '')}`,
          'END:VEVENT',
        ].join('\r\n');
      });
    });
    const content = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fukuoka Trip Guide//ZH-TW', 'CALSCALE:GREGORIAN',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE',
      ...events, 'END:VCALENDAR',
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fukuoka-trip.ics"');
    res.send(content);
  } catch (error) {
    next(error);
  }
});

interface ShoppingInput { name: string; category: string; description: string }
interface ImportedItem {
  time: string; title: string; description: string; addressJp: string; addressEn: string;
  lat: number; lng: number; transportType: TransportType; transportDetail: string; googleMapsQuery: string;
  recommendedFoods: string[]; nearbySpots: string[]; shoppingSpots: ShoppingInput[];
}
interface ImportedDay { isoDate: string; dateLabel: string; dayTitle: string; theme: string; focus: string; items: ImportedItem[] }

const isValidISODate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const isValidTime = (value: string): boolean => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

const parseStringList = (value: unknown, field: string): string[] => requireArray(value ?? [], field, 50).map((entry) => requireString(entry, field, 200));

const parseImport = (value: unknown): ImportedDay[] => requireArray(value, 'itinerary', 31).map((dayValue, dayIndex) => {
  const day = asRecord(dayValue);
  const isoDate = requireString(day.isoDate ?? day.iso_date, `第 ${dayIndex + 1} 天 isoDate`, 10);
  if (!isValidISODate(isoDate)) throw new AppError(`第 ${dayIndex + 1} 天日期格式錯誤`, 400);
  const items = requireArray(day.items ?? [], 'items', 100).map((itemValue, itemIndex): ImportedItem => {
    const item = asRecord(itemValue);
    const coordinates = item.coordinates === undefined ? {} : asRecord(item.coordinates);
    const transportValue = item.transportType ?? item.transport_type ?? 'WALK';
    if (typeof transportValue !== 'string' || !Object.values(TransportType).includes(transportValue as TransportType)) throw new AppError(`第 ${dayIndex + 1} 天第 ${itemIndex + 1} 筆交通格式錯誤`, 400);
    const shopping = requireArray(item.shoppingSideQuests ?? item.shopping_spots ?? [], 'shopping_spots', 50).map((spotValue): ShoppingInput => {
      const spot = asRecord(spotValue);
      return { name: requireString(spot.name, '購物點名稱', 200), category: optionalString(spot.category, '分類', 50) || '', description: optionalString(spot.description, '說明', 2000) || '' };
    });
    const time = requireString(item.time, 'time', 5);
    if (!isValidTime(time)) throw new AppError(`第 ${dayIndex + 1} 天第 ${itemIndex + 1} 筆時間格式錯誤`, 400);
    return {
      time,
      title: requireString(item.title, 'title', 200),
      description: optionalString(item.description, 'description', 5000) || '',
      addressJp: optionalString(item.address_jp, 'address_jp', 300) || '',
      addressEn: optionalString(item.address_en, 'address_en', 300) || '',
      lat: requireFiniteNumber(coordinates.lat ?? item.lat, 'lat', -90, 90),
      lng: requireFiniteNumber(coordinates.lng ?? item.lng, 'lng', -180, 180),
      transportType: transportValue as TransportType,
      transportDetail: optionalString(item.transportDetail ?? item.transport_detail, 'transport_detail', 200) || '',
      googleMapsQuery: optionalString(item.googleMapsQuery ?? item.google_maps_query, 'google_maps_query', 300) || '',
      recommendedFoods: parseStringList(item.recommendedFood ?? item.recommended_foods, 'recommended_foods'),
      nearbySpots: parseStringList(item.nearbySpots ?? item.nearby_spots, 'nearby_spots'),
      shoppingSpots: shopping,
    };
  });
  return {
    isoDate,
    dateLabel: optionalString(day.date ?? day.date_label, '日期標籤', 20) || isoDate,
    dayTitle: optionalString(day.dayTitle ?? day.day_title, '天數標題', 20) || `Day ${dayIndex + 1}`,
    theme: optionalString(day.theme, '主題', 100) || '',
    focus: optionalString(day.focus, '重點', 200) || '',
    items,
  };
});

router.post('/:planId/import/json', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const itinerary = parseImport(body.itinerary);
    const plan = await prisma.itineraryPlan.findFirst({
      where: { id: req.params.planId, trip: { userId: req.user!.userId } },
      select: { id: true },
    });
    if (!plan) {
      res.status(404).json({ error: '找不到此方案' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.itineraryDay.deleteMany({ where: { planId: plan.id } });
      for (const [dayIndex, dayData] of itinerary.entries()) {
        const day = await tx.itineraryDay.create({
          data: { planId: plan.id, isoDate: new Date(`${dayData.isoDate}T00:00:00.000Z`), dateLabel: dayData.dateLabel, dayTitle: dayData.dayTitle, theme: dayData.theme, focus: dayData.focus, sortOrder: dayIndex },
        });
        for (const [itemIndex, item] of dayData.items.entries()) {
          await tx.itineraryItem.create({
            data: {
              dayId: day.id, time: item.time, title: item.title, description: item.description, addressJp: item.addressJp, addressEn: item.addressEn,
              lat: item.lat, lng: item.lng, transportType: item.transportType, transportDetail: item.transportDetail, googleMapsQuery: item.googleMapsQuery, sortOrder: itemIndex,
              recommendedFoods: { create: item.recommendedFoods.map((name, sortOrder) => ({ name, sortOrder })) },
              nearbySpots: { create: item.nearbySpots.map((name, sortOrder) => ({ name, sortOrder })) },
              shoppingSpots: { create: item.shoppingSpots.map((spot, sortOrder) => ({ ...spot, sortOrder })) },
            },
          });
        }
      }
    });
    res.json({ message: '匯入成功', days_imported: itinerary.length });
  } catch (error) {
    next(error);
  }
});

export { router as exportRouter };
