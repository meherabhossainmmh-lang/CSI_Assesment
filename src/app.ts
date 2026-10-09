import express from 'express';
import { eventsRouter } from './modules/events/events.routes';
import { stateRouter } from './modules/state/state.routes';
import { ackRouter } from './modules/acknowledgement/ack.routes';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler';
import { checkConnection } from './config/database';
import { env } from './config/environment';

/** Assemble the Express app. Route handlers stay thin; services do the work. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
