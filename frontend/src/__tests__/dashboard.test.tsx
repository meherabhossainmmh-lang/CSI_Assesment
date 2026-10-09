import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { mockFetch, failFetch } from '../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

describe('Dashboard', () => {
  it('loads real summary values from the backend', async () => {
    mockFetch((url) => {
      if (url.includes('/api/state'))
        return { summary: { net_total: 1248, processed_events: 523, pending_ack: 12, unresolved: 3, duplicates: 8, conflicts: 2 } };
      if (url.includes('/api/analytics'))
        return { hours: 24, trend: [{ hour: '2025-01-01T00:00:00', count_total: 5, void_total: 0, net_total: 5 }], by_line: [{ source_id: 'LINE-01', net_total: 5, processed_events: 1 }] };
      if (url.includes('/api/production-lines')) return { lines: [] };
      return {};
    });
    render(<Dashboard />);
    expect(await screen.findByText('Net Total')).toBeInTheDocument();
    expect(await screen.findByText('1248')).toBeInTheDocument();
    expect(await screen.findByText('523')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    failFetch();
    render(<Dashboard />);
    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });
});
