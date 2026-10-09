import { Router } from 'express';
import { getState } from './state.controller';

export const stateRouter = Router();

stateRouter.get('/', getState);
