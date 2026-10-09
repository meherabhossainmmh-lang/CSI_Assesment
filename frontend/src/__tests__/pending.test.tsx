import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PendingAcknowledgements } from '../pages/PendingAcknowledgements';
import { mockFetch } from '../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

const PENDING = [
  { event_id: 'EV-1', source_id: 'LINE-01', event_type: 'COUNT', quantity: 5, target_event_id: null, event_time: '2025-01-01T10:00:00Z', status: 'ACCEPTED', received_at: '2025-01-01T10:00:00Z' },
  { event_id: 'EV-2', source_id: 'LINE-02', event_type: 'COUNT', quantity: 7, target_event_id: null, event_time: '2025-01-01T11:00:00Z', status: 'ACCEPTED', received_at: '2025-01-01T11:00:00Z' },
];

describe('PendingAcknowledgements', () => {
  it('renders pending events and acknowledges selection', async () => {
    const { calls } = mockFetch((url) => {
      if (url.includes('/api/state')) return { pending: PENDING };
      if (url.includes('/api/production-lines')) return { lines: [] };
      if (url.includes('/api/ack'))
        return { results: [{ event_id: 'EV-1', status: 'ACKED', message: 'Acknowledged' }] };
      return {};
    });
    render(<PendingAcknowledgements />);
    expect(await screen.findByText('EV-1')).toBeInTheDocument();
    expect(screen.getByText('EV-2')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select EV-1'));
    await userEvent.click(screen.getByRole('button', { name: /Acknowledge Selected/i }));

    await waitFor(() => {
      const ack = calls.find((c) => c.url.includes('/api/ack'));
      expect(ack).toBeTruthy();
      expect(ack!.body).toEqual({ event_ids: ['EV-1'] });
    });
    expect(await screen.findByText('ACKED')).toBeInTheDocument();
  });
});
