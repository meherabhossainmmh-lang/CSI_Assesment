import { api } from './api';
import type { AckResult } from '../types';

export async function acknowledge(eventIds: string[]): Promise<AckResult[]> {
  const r = await api.post<{ results: AckResult[] }>('/api/ack', { event_ids: eventIds });
  return r.results;
}
