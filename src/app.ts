import express from 'express';
import cors from 'cors';
import { eventsRouter } from './modules/events/events.routes';
import { stateRouter, analyticsRouter } from './modules/state/state.routes';
import { ackRouter } from './modules/acknowledgement/ack.routes';
import { mqttRouter } from './modules/mqtt/mqtt.routes';
import { sourcesRouter } from './modules/sources/sources.routes';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler';
import { checkConnection } from './config/database';
import { env } from './config/environment';

/** Assemble the Express app. Route handlers stay thin; services do the work. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Allow the separate Vite dev server / preview origin to call the API.
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const ok = await checkConnection();
    res.status(ok ? 200 : 503).json({
      ok,
      service: 'csi-production-events-backend',
      mqtt: { enabled: env.mqtt.enabled, candidate_id: env.mqtt.candidateId },
    });
  });

  app.use('/api/events', eventsRouter);
  app.use('/api/state', stateRouter);
  app.use('/api/ack', ackRouter);
  app.use('/api/mqtt', mqttRouter);
  app.use('/api/production-lines', sourcesRouter);
  app.use('/api/analytics', analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
