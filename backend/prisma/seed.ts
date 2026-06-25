/**
 * prisma/seed.ts — 匯入現有前端 JSON 資料作為種子資料
 *
 * Usage: npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@fukuokatrip.com' },
    update: {},
    create: {
      email: 'demo@fukuokatrip.com',
      passwordHash: '$2a$12$LJ3Y5U5JqHhMZK8Iw8RhCeNTITHMLYh8k7Zz0qR8sE1oXV/Gq2nW6', // "demo1234"
      displayName: '旅人 Demo',
      locale: 'zh-TW',
    },
  });
  console.log(`👤 User: ${user.email} (${user.id})`);

  // Create trip
  const trip = await prisma.trip.upsert({
    where: { id: 'seed-trip-fukuoka-2025' },
    update: {},
    create: {
      id: 'seed-trip-fukuoka-2025',
      userId: user.id,
      name: '2025 福岡之旅',
      description: '四天三夜福岡深度遊',
      startDate: new Date('2025-02-27'),
      endDate: new Date('2025-03-02'),
    },
  });
  console.log(`✈️ Trip: ${trip.name}`);

  // Create plans
  const dataDir = path.resolve(__dirname, '../../data');

  for (const planDef of [
    { name: 'plan1', folder: 'itinerary', active: true },
    { name: 'plan2', folder: 'itinerary2', active: false },
  ]) {
    const planDir = path.join(dataDir, planDef.folder);
    if (!fs.existsSync(planDir)) {
      console.log(`⚠️  Skipping ${planDef.name}: directory ${planDir} not found`);
      continue;
    }

    // Delete existing plan data if re-seeding
    await prisma.itineraryPlan.deleteMany({
      where: { tripId: trip.id, planName: planDef.name },
    });

    const plan = await prisma.itineraryPlan.create({
      data: {
        tripId: trip.id,
        planName: planDef.name,
        isActive: planDef.active,
        sortOrder: planDef.name === 'plan1' ? 0 : 1,
      },
    });
    console.log(`📋 Plan: ${plan.planName} (active: ${plan.isActive})`);

    // Read day JSON files
    const dayFiles = fs.readdirSync(planDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    for (let di = 0; di < dayFiles.length; di++) {
      const raw = fs.readFileSync(path.join(planDir, dayFiles[di]), 'utf-8');
      const dayData = JSON.parse(raw);

      const day = await prisma.itineraryDay.create({
        data: {
          planId: plan.id,
          dateLabel: dayData.date,
          dayTitle: dayData.dayTitle,
          theme: dayData.theme,
          focus: dayData.focus,
          sortOrder: di,
        },
      });

      for (let ii = 0; ii < (dayData.items || []).length; ii++) {
        const item = dayData.items[ii];

        await prisma.itineraryItem.create({
          data: {
            dayId: day.id,
            time: item.time,
            title: item.title,
            description: item.description || '',
            addressJp: item.address_jp || '',
            addressEn: item.address_en || '',
            lat: item.coordinates?.lat || 33.5902,
            lng: item.coordinates?.lng || 130.4017,
            transportType: item.transportType || 'WALK',
            transportDetail: item.transportDetail || '',
            googleMapsQuery: item.googleMapsQuery || '',
            sortOrder: ii,
            recommendedFoods: {
              create: (item.recommendedFood || []).map((name: string, i: number) => ({
                name,
                sortOrder: i,
              })),
            },
            nearbySpots: {
              create: (item.nearbySpots || []).map((name: string, i: number) => ({
                name,
                sortOrder: i,
              })),
            },
            shoppingSpots: {
              create: (item.shoppingSideQuests || []).map((s: any, i: number) => ({
                name: s.name,
                category: s.category || '',
                description: s.description || '',
                sortOrder: i,
              })),
            },
          },
        });
      }

      console.log(`  📅 ${day.dayTitle} (${day.dateLabel}): ${dayData.items?.length || 0} items`);
    }
  }

  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
