import { api } from './api';
import type { ProductionLine } from '../types';

export async function listLines(): Promise<ProductionLine[]> {
  const r = await api.get<{ lines: ProductionLine[] }>('/api/production-lines');
  return r.lines;
}

export async function createLine(input: {
  source_id: string;
  display_name: string;
  description?: string | null;
}): Promise<ProductionLine> {
  const r = await api.post<{ line: ProductionLine }>('/api/production-lines', input);
  return r.line;
}

export async function updateLine(
  sourceId: string,
  patch: Partial<{ display_name: string; description: string | null; status: 'ACTIVE' | 'INACTIVE' }>,
): Promise<ProductionLine> {
  const r = await api.patch<{ line: ProductionLine }>(
    `/api/production-lines/${encodeURIComponent(sourceId)}`,
    patch,
  );
  return r.line;
}
