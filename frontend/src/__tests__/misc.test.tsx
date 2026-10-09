import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Exceptions } from '../pages/Exceptions';
import { MqttStatus } from '../pages/MqttStatus';
import { ProductionLines } from '../pages/ProductionLines';
import { mockFetch } from '../test/fetchMock';

afterEach(() => vi.unstubAllGlobals());

describe('Exceptions', () => {
  it('filters by category', async () => {
    mockFetch((url) => {
      if (url.includes('/api/state'))
        return {
          exceptions: [
            { kind: 'attempt', event_id: 'EV-A', source_id: 'LINE-01', classification: 'REJECTED', reason: 'bad qty', received_at: '2025-01-01T10:00:00Z' },
            { kind: 'attempt', event_id: 'EV-B', source_id: 'LINE-01', classification: 'CONFLICT', reason: 'mismatch', received_at: '2025-01-01T10:00:00Z' },
          ],
        };
      return {};
    });
    render(<Exceptions />);
    expect(await screen.findByText('EV-A')).toBeInTheDocument();
    expect(screen.getByText('EV-B')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Conflicts \(1\)/i }));
    expect(screen.queryByText('EV-A')).not.toBeInTheDocument();
    expect(screen.getByText('EV-B')).toBeInTheDocument();
  });
});

describe('MqttStatus', () => {
  it('reflects backend connection and challenge history', async () => {
    mockFetch((url) => {
      if (url.includes('/api/mqtt/status'))
        return {
          enabled: true, connected: true, broker_host: '152.42.238.142', broker_port: 1883,
          candidate_id: '08', client_id: 'fse01-08-x', protocol_version: 'MQTT 3.1.1',
          last_connected_at: '2025-01-01T09:00:00Z', last_disconnected_at: null,
          last_heartbeat_at: '2025-01-01T09:15:00Z', last_challenge_id: 'CH-001',
          last_challenge_status: 'COMPLETED', last_response_at: '2025-01-01T09:05:00Z',
          reconnect_attempts: 0,
          recent_challenges: [{ challenge_id: 'CH-001', status: 'COMPLETED', error_code: null, events: 5, received_at: '2025-01-01T09:05:00Z', processed_at: '2025-01-01T09:05:00Z', response_ms: 523 }],
        };
      return {};
    });
    render(<MqttStatus />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getAllByText('CH-001').length).toBeGreaterThan(0);
    expect(screen.getByText('152.42.238.142:1883')).toBeInTheDocument();
  });
});

describe('ProductionLines', () => {
  it('renders line data from the backend', async () => {
    mockFetch((url) => {
      if (url.includes('/api/production-lines'))
        return { lines: [{ source_id: 'LINE-01', display_name: 'Cutting Line', description: 'Fabric cutting', status: 'ACTIVE', created_at: '2025-01-01T00:00:00Z' }] };
      return {};
    });
    render(<ProductionLines />);
    expect(await screen.findByText('LINE-01')).toBeInTheDocument();
    expect(screen.getByText('Cutting Line')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });
});
