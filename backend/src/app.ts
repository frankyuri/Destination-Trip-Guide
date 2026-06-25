/**
 * src/app.ts — Express 應用程式主入口
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { authRouter } from './routes/auth';
import { tripsRouter } from './routes/trips';
import { plansRouter } from './routes/plans';
import { daysRouter } from './routes/days';
import { itemsRouter } from './routes/items';
import { progressRouter } from './routes/progress';
import { exportRouter } from './routes/exportImport';
import { aiRouter } from './routes/ai';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// --- Middleware ---
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '5mb' }));

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/trips', plansRouter);       // /api/trips/:tripId/plans
app.use('/api/plans', daysRouter);        // /api/plans/:planId/days
app.use('/api', itemsRouter);             // /api/days/:dayId/items & /api/items/:itemId
app.use('/api', progressRouter);          // /api/trips/:tripId/progress & /api/progress/:itemId
app.use('/api/plans', exportRouter);      // /api/plans/:planId/export/*
app.use('/api/ai', aiRouter);

// --- Error Handler ---
app.use(errorHandler);

export default app;
