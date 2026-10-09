import { API_BASE } from './api';

export interface Health {
  ok: boolean;
  mqtt: { enabled: boolean; candidate_id: string };
}

export async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}
