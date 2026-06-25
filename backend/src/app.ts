import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { aiRouter } from './routes/ai';
import { authRouter } from './routes/auth';
import { daysRouter } from './routes/days';
import { exportRouter } from './routes/exportImport';
import { itemsRouter } from './routes/items';
import { plansRouter } from './routes/plans';
import { progressRouter } from './routes/progress';
import { tripsRouter } from './routes/trips';
import { errorHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimit';
import { securityHeaders } from './middleware/securityHeaders';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('此來源不允許存取 API'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', createRateLimiter(15 * 60_000, 40), authRouter);
app.use('/api/ai', createRateLimiter(60_000, 12), aiRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/trips', plansRouter);
app.use('/api/plans', daysRouter);
app.use('/api', itemsRouter);
app.use('/api', progressRouter);
app.use('/api/plans', exportRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '找不到此 API 路徑' });
});
app.use(errorHandler);

export default app;