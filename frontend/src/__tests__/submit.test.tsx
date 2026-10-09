import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitEvents } from '../pages/SubmitEvents';
import { mockFetch } from '../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

function baseMock() {
  return mockFetch((url) => {
    if (url.includes('/api/production-lines')) return { lines: [{ source_id: 'LINE-01' }] };
    if (url.includes('/api/events'))
      return { results: [{ event_id: 'EV-500', status: 'ACCEPTED', message: 'Event processed' }] };
    return {};
  });
}

describe('SubmitEvents', () => {
  it('COUNT submission sends correct JSON', async () => {
    const { calls } = baseMock();
    render(<SubmitEvents />);
    await userEvent.type(await screen.findByPlaceholderText('EV-201'), 'EV-500');
    const qty = screen.getByRole('spinbutton');
    await userEvent.clear(qty);
    await userEvent.type(qty, '5');
    await userEvent.click(screen.getByRole('button', { name: /Submit Event/i }));

    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/api/events'));
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ source_id: 'LINE-01', event_id: 'EV-500', type: 'COUNT', quantity: 5 });
    });
    expect(await screen.findByText('ACCEPTED')).toBeInTheDocument();
  });

  it('VOID submission includes the target event ID', async () => {
    const { calls } = baseMock();
    render(<SubmitEvents />);
    await userEvent.type(await screen.findByPlaceholderText('EV-201'), 'EV-600');
    await userEvent.click(screen.getByLabelText('VOID'));
    await userEvent.type(screen.getByPlaceholderText('EV-101'), 'EV-101');
    await userEvent.click(screen.getByRole('button', { name: /Submit Event/i }));

    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/api/events'));
      expect(post).toBeTruthy();
      expect(post!.body).toMatchObject({ type: 'VOID', target_event_id: 'EV-101', event_id: 'EV-600' });
    });
  });

  it('shows inline validation for invalid quantity', async () => {
    baseMock();
    render(<SubmitEvents />);
    await userEvent.type(await screen.findByPlaceholderText('EV-201'), 'EV-700');
    const qty = screen.getByRole('spinbutton');
    await userEvent.clear(qty);
    await userEvent.type(qty, '-3');
    await userEvent.click(screen.getByRole('button', { name: /Submit Event/i }));
    expect(await screen.findByText(/positive integer/i)).toBeInTheDocument();
  });
});
