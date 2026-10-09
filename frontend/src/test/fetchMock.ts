import { vi } from 'vitest';

export interface CapturedCall {
  url: string;
  method: string;
  body?: unknown;
}

/**
 * Install a stub for global fetch that answers based on URL substring and
 * records every call so tests can assert request payloads.
 */
export function mockFetch(responder: (url: string, init?: RequestInit) => unknown) {
  const calls: CapturedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, body });
    const data = responder(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => data,
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

export function failFetch() {
  const fn = vi.fn(async () => {
    throw new Error('network down');
  });
  vi.stubGlobal('fetch', fn);
  return { fn };
}
