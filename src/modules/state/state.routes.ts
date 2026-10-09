import { Router } from 'express';
import { getState, getAnalyticsView } from './state.controller';

export const stateRouter = Router();
stateRouter.get('/', getState);

export const analyticsRouter = Router();
analyticsRouter.get('/', getAnalyticsView);
