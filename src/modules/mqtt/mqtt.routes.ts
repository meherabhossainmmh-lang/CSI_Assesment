import { Router } from 'express';
import { getMqttStatus } from './mqtt.controller';

export const mqttRouter = Router();

mqttRouter.get('/status', getMqttStatus);
