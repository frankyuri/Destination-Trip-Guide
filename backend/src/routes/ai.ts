/**
 * src/routes/ai.ts — AI Tips (Gemini proxy)
 *
 * 將 Gemini API 呼叫封裝在後端，避免前端暴露 API Key
 */
import { Router, Request, Response, NextFunction } from 'express';
import { optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/ai/place-insight
 */
router.post('/place-insight', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { place_name, nearby_restaurants } = req.body;

    if (!place_name) {
      res.status(400).json({ error: '請提供 place_name' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({ insight: '請先設定 GEMINI_API_KEY 才能使用 AI 嚮導功能' });
      return;
    }

    // Build prompt
    let restaurantContext = '';
    if (nearby_restaurants && nearby_restaurants.length > 0) {
      const restaurantList = nearby_restaurants.slice(0, 5).map((r: any, i: number) => {
        const parts = [`${i + 1}. ${r.name}`];
        if (r.rating) parts.push(`評分 ${r.rating}`);
        if (r.distance) parts.push(`${Math.round(r.distance)}m`);
        return parts.join(' | ');
      }).join('\n');
      restaurantContext = `\n\n附近餐廳 (500m 內):\n${restaurantList}`;
    }

    const prompt = nearby_restaurants && nearby_restaurants.length > 0
      ? `You are a professional local tour guide in Fukuoka, Japan.\n\nThe tourist is at "${place_name}".${restaurantContext}\n\n請提供：\n1. 這個景點的一個獨家祕技或隱藏景點（約 30 字）\n2. 從以上餐廳中推薦最值得去的 1-2 間，說明為什麼（約 40 字）\n\nOutput in Traditional Chinese (Taiwan).\nTone: Excited, helpful, and concise.\nTotal under 80 words.`
      : `You are a professional local tour guide in Fukuoka, Japan.\nProvide a specific, single "Insider Tip" or "Hidden Gem" about "${place_name}".\nKeep it under 60 words.\nOutput in Traditional Chinese (Taiwan).\nTone: Excited, helpful, and concise.`;

    // Call Gemini REST API directly (no SDK needed)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ insight: text || '目前無法取得 AI 資訊，請稍後再試。' });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.json({ insight: 'AI 連線發生錯誤，請檢查網路或 API Key。' });
  }
});

export { router as aiRouter };
