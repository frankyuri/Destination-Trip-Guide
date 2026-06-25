import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [constants, viteConfig, gemini, calendar, serviceWorker, manifest, indexHtml, indexCss] = await Promise.all([
  readFile(new URL('../constants.ts', import.meta.url), 'utf8'),
  readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
  readFile(new URL('../utils/gemini.ts', import.meta.url), 'utf8'),
  readFile(new URL('../utils/calendar.ts', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../index.css', import.meta.url), 'utf8'),
]);

const isoDates = [...constants.matchAll(/isoDate:\s*'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(isoDates, ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31']);
const ids = [...constants.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, '行程 item id 不可重複');
assert.equal(viteConfig.includes('GEMINI_API_KEY'), false, 'Vite 不可把 Gemini 金鑰注入前端');
assert.equal(gemini.includes('@google/genai'), false, '前端不可直接載入 Gemini SDK');
assert.equal(indexHtml.includes('cdn.tailwindcss.com'), false, '正式版不可依賴 Tailwind CDN');
assert.match(indexCss, /@import ["']tailwindcss["']/, 'Tailwind 必須由本地建置產生');
assert.match(calendar, /TZID:Asia\/Tokyo/);
assert.match(serviceWorker, /api\/.*return/si, 'Service Worker 必須略過 API');
const manifestJson = JSON.parse(manifest);
assert.equal(manifestJson.start_url, '.');
assert.equal(manifestJson.icons.length, 2);

console.log(`Validated ${isoDates.length} days and ${ids.length} itinerary items.`);
