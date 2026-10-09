import { Router } from 'express';
import { getLines, createLine, updateLine } from './sources.controller';

export const sourcesRouter = Router();

sourcesRouter.get('/', getLines);
sourcesRouter.post('/', createLine);
sourcesRouter.patch('/:source_id', updateLine);
