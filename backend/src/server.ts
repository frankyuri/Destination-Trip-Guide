import app from './app';
import { validateEnvironment } from './config';

validateEnvironment();
const PORT = Number.parseInt(process.env.PORT || '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`Fukuoka Trip API running on http://localhost:${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close((error) => {
    if (error) {
      console.error('Shutdown failed:', error);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));