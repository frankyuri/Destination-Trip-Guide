import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [plans, days, items, progress, exportImport, auth, schema, migration, prismaConfig] = await Promise.all([
  read('src/routes/plans.ts'), read('src/routes/days.ts'), read('src/routes/items.ts'), read('src/routes/progress.ts'),
  read('src/routes/exportImport.ts'), read('src/routes/auth.ts'), read('prisma/schema.prisma'),
  read('prisma/migrations/202606250001_init/migration.sql'), read('prisma.config.ts'),
]);

assert.match(plans, /trip:\s*\{\s*userId:/, '方案操作必須驗證旅程擁有者');
assert.match(days, /ownedDays\.length !== order\.length/, '天數排序必須驗證所有權');
assert.match(items, /ownedItems\.length !== order\.length/, '項目排序必須驗證所有權');
assert.match(progress, /itineraryItem\.findFirst[\s\S]*userId:/, '進度寫入必須驗證項目所有權');
assert.match(exportImport, /\$transaction\(async \(tx\)/, 'JSON 匯入必須使用 transaction');
assert.match(exportImport, /isValidISODate/, 'JSON 匯入必須驗證真實日期');
assert.match(exportImport, /isValidTime/, 'JSON 匯入必須驗證 24 小時制時間');
assert.match(exportImport, /addLocalMinutes/, 'ICS 結束時間必須支援跨日');
assert.match(auth, /tokenType:\s*'refresh'/, 'Refresh token 必須與 access token 分流');
assert.match(schema, /isoDate\s+DateTime/);
assert.match(schema, /@@index\(\[dayId, sortOrder\]\)/);
assert.match(migration, /CREATE TABLE "itinerary_days"/);
assert.match(migration, /"iso_date" DATE NOT NULL/);
assert.match(prismaConfig, /migrations:[\s\S]*seed:/, 'Prisma seed 應使用 prisma.config.ts');

console.log('Backend security and migration invariants validated.');
