import { api } from './api';
import type { EventResult } from '../types';

export interface SubmitEventInput {
  source_id: string;
  event_id: string;
  type: 'COUNT' | 'VOID';
  quantity?: number | null;
  target_event_id?: string | null;
  event_time: string;
}

/** Submit one event or a batch; returns one result per item, original order. */
export async function submitEvents(body: unknown): Promise<EventResult[]> {
  const r = await api.post<{ results: EventResult[] }>('/api/events', body);
  return r.results;
}
