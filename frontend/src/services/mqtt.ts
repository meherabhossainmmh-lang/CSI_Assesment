import { api } from './api';
import type { MqttStatus } from '../types';

export async function getMqttStatus(): Promise<MqttStatus> {
  return api.get<MqttStatus>('/api/mqtt/status');
}
