import { NextFunction, Request, Response, Router } from 'express';
import { asRecord, requireString } from '../lib/validation';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/place-insight', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const placeName = requireString(body.place_name, 'place_name', 200);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'AI 嚮導尚未設定' });
      return;
    }

    const prompt = `你是熟悉目的地與北九州的在地旅遊嚮導。請針對「${placeName}」提供一個具體、實用且可查證的隱藏密技。使用台灣繁體中文，60 字以內；如果不確定就明確說明，不要捏造營業資訊。`;
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Gemini API returned ${response.status}`);
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const insight = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!insight) throw new Error('Gemini API returned no text');
      res.json({ insight });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'AI 回應逾時' });
      return;
    }
    next(error);
  }
});

export { router as aiRouter };