import { Router } from 'express';
import { postEvents } from './events.controller';

export const eventsRouter = Router();

eventsRouter.post('/', postEvents);
