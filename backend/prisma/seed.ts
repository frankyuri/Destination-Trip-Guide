import { PrismaClient, TransportType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ITINERARY_DATA } from '../../constants';

const prisma = new PrismaClient();

async function main() {
  const demoPassword = process.env.DEMO_PASSWORD || 'demo1234';
  const user = await prisma.user.upsert({
    where: { email: 'demo@destinationtrip.com' },
    update: {},
    create: {
      email: 'demo@destinationtrip.com',
      passwordHash: await bcrypt.hash(demoPassword, 12),
      displayName: '旅人 Demo',
      locale: 'zh-TW',
    },
  });

  const trip = await prisma.trip.upsert({
    where: { id: 'seed-trip-destination-2026' },
    update: {
      name: '2026 目的地之旅',
      startDate: new Date('2026-02-27T00:00:00.000Z'),
      endDate: new Date('2026-03-02T00:00:00.000Z'),
    },
    create: {
      id: 'seed-trip-destination-2026',
      userId: user.id,
      name: '2026 目的地之旅',
      description: '四天三夜目的地深度遊',
      startDate: new Date('2026-02-27T00:00:00.000Z'),
      endDate: new Date('2026-03-02T00:00:00.000Z'),
    },
  });

  await prisma.itineraryPlan.deleteMany({ where: { tripId: trip.id } });
  const plan = await prisma.itineraryPlan.create({
    data: { tripId: trip.id, planName: '主要行程', isActive: true, sortOrder: 0 },
  });

  for (const [dayIndex, dayData] of ITINERARY_DATA.entries()) {
    const day = await prisma.itineraryDay.create({
      data: {
        planId: plan.id,
        isoDate: new Date(`${dayData.isoDate}T00:00:00.000Z`),
        dateLabel: dayData.date,
        dayTitle: dayData.dayTitle,
        theme: dayData.theme,
        focus: dayData.focus,
        sortOrder: dayIndex,
      },
    });

    for (const [itemIndex, item] of dayData.items.entries()) {
      await prisma.itineraryItem.create({
        data: {
          id: item.id,
          dayId: day.id,
          time: item.time,
          title: item.title,
          description: item.description,
          addressJp: item.address_jp,
          addressEn: item.address_en,
          lat: item.coordinates.lat,
          lng: item.coordinates.lng,
          transportType: item.transportType as TransportType,
          transportDetail: item.transportDetail,
          googleMapsQuery: item.googleMapsQuery || '',
          sortOrder: itemIndex,
          recommendedFoods: { create: item.recommendedFood.map((name, sortOrder) => ({ name, sortOrder })) },
          nearbySpots: { create: item.nearbySpots.map((name, sortOrder) => ({ name, sortOrder })) },
          shoppingSpots: {
            create: (item.shoppingSideQuests || []).map((spot, sortOrder) => ({
              name: spot.name,
              category: spot.category,
              description: spot.description || '',
              sortOrder,
            })),
          },
        },
      });
    }
  }

  console.log(`Seeded ${trip.name} for ${user.email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());