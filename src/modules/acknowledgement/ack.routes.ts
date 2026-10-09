import { Router } from 'express';
import { postAck } from './ack.controller';

export const ackRouter = Router();

ackRouter.post('/', postAck);
