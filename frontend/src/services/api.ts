// Single fetch wrapper. The backend is always addressed with relative /api
// URLs (proxied by the Vite dev server) unless VITE_API_BASE overrides it.
export const API_BASE: string =
  ((import.meta as any).env?.VITE_API_BASE as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && typeof j === 'object' && (j as any).error) message = (j as any).error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
