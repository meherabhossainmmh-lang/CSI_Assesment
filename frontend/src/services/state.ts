import { api } from './api';
import type { Summary, PendingEvent, ExceptionRow, Analytics } from '../types';

const src = (sourceId?: string | null) =>
  sourceId ? `source_id=${encodeURIComponent(sourceId)}&` : '';

export async function getSummary(sourceId?: string | null): Promise<Summary> {
  const r = await api.get<{ summary: Summary }>(`/api/state?${src(sourceId)}view=summary`);
  return r.summary;
}

export async function getPending(sourceId?: string | null): Promise<PendingEvent[]> {
  const r = await api.get<{ pending: PendingEvent[] }>(`/api/state?${src(sourceId)}view=pending`);
  return r.pending;
}

export async function getExceptions(sourceId?: string | null): Promise<ExceptionRow[]> {
  const r = await api.get<{ exceptions: ExceptionRow[] }>(`/api/state?${src(sourceId)}view=exceptions`);
  return r.exceptions;
}

export async function getAnalytics(hours = 24): Promise<Analytics> {
  return api.get<Analytics>(`/api/analytics?hours=${hours}`);
}
