import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { SourceFilterProvider } from '../hooks/useSourceFilter';
import { mockFetch, failFetch } from '../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

const renderWithProvider = (ui: React.ReactElement) =>
  render(<SourceFilterProvider>{ui}</SourceFilterProvider>);

const SUMMARY = {
  net_total: 1248,
  processed_events: 523,
  pending_ack: 12,
  unresolved: 3,
  duplicates: 8,
  conflicts: 2,
  rejected_submissions: 4,
};

function mockDashboard() {
  return mockFetch((url) => {
    if (url.includes('/api/state')) return { summary: SUMMARY };
    if (url.includes('/api/analytics'))
      return {
        hours: 24,
        trend: [{ hour: '2025-01-01T00:00:00', count_total: 5, void_total: 0, net_total: 5 }],
        by_line: [{ source_id: 'LINE-01', net_total: 5, processed_events: 1 }],
      };
    if (url.includes('/api/production-lines')) return { lines: [{ source_id: 'LINE-01' }] };
    return {};
  });
}

describe('Dashboard', () => {
  it('loads real summary values including the rejected card', async () => {
    mockDashboard();
    renderWithProvider(<Dashboard />);
    expect(await screen.findByText('Net Total')).toBeInTheDocument();
    expect(await screen.findByText('1248')).toBeInTheDocument();
    expect(screen.getByText('Rejected Submissions')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows seven summary cards', async () => {
    mockDashboard();
    renderWithProvider(<Dashboard />);
    await screen.findByText('Net Total');
    for (const label of ['Net Total', 'Processed', 'Pending ACK', 'Unresolved', 'Duplicates', 'Conflicts', 'Rejected Submissions']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('Production Source filter requests the selected source', async () => {
    const { calls } = mockDashboard();
    renderWithProvider(<Dashboard />);
    const select = await screen.findByLabelText('Production Source');
    await userEvent.selectOptions(select, 'LINE-01');
    await waitFor(() => {
      const stateCalls = calls.filter((c) => c.url.includes('/api/state'));
      expect(stateCalls.some((c) => c.url.includes('source_id=LINE-01'))).toBe(true);
    });
  });

  it('shows an error state when the API fails', async () => {
    failFetch();
    renderWithProvider(<Dashboard />);
    expect(await screen.findByText(/network down/)).toBeInTheDocument();
  });
});
