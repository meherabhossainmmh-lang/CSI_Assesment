import { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, HeartPulse } from 'lucide-react';
import { getMqttStatus } from '../services/mqtt';
import { StatusBadge } from '../components/status/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../components/feedback/States';
import type { MqttStatus as MqttStatusType } from '../types';

export function MqttStatus() {
  const [status, setStatus] = useState<MqttStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getMqttStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MQTT status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !status) return <Loading label="Loading MQTT status…" />;
  if (error && !status) return <ErrorState message={error} onRetry={load} />;
  if (!status) return null;

  const connected = status.connected;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">MQTT Status</h1>
        <p className="text-sm text-slate-500">Device connection, challenges and responses</p>
      </div>

      <div
        className={`card flex items-center justify-between p-4 ${
          connected ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-3">
          {connected ? <Wifi className="h-6 w-6 text-success" /> : <WifiOff className="h-6 w-6 text-danger" />}
          <span className={`text-lg font-semibold ${connected ? 'text-emerald-700' : 'text-red-700'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
            connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Connection</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Broker</dt><dd>{status.broker_host}:{status.broker_port}</dd>
            <dt className="text-slate-500">Candidate ID</dt><dd>{status.candidate_id}</dd>
            <dt className="text-slate-500">Client ID</dt><dd className="truncate">{status.client_id ?? '—'}</dd>
            <dt className="text-slate-500">Protocol</dt><dd>{status.protocol_version}</dd>
            <dt className="text-slate-500">Last Connected</dt><dd>{status.last_connected_at ? new Date(status.last_connected_at).toLocaleString() : '—'}</dd>
            <dt className="text-slate-500">Reconnect Attempts</dt><dd>{status.reconnect_attempts}</dd>
          </dl>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><HeartPulse className="h-4 w-4 text-success" /> Last Challenge &amp; Heartbeat</h2>
          {status.last_challenge_id ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Challenge ID</dt><dd>{status.last_challenge_id}</dd>
              <dt className="text-slate-500">Result</dt><dd><StatusBadge status={status.last_challenge_status ?? 'FAILED'} /></dd>
              <dt className="text-slate-500">Responded</dt><dd>{status.last_response_at ? new Date(status.last_response_at).toLocaleTimeString() : '—'}</dd>
              <dt className="text-slate-500">Last Heartbeat</dt><dd>{status.last_heartbeat_at ? new Date(status.last_heartbeat_at).toLocaleTimeString() : '—'}</dd>
            </dl>
          ) : (
            <EmptyState title="No challenge received yet" hint="Challenge activity will appear here." />
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent Challenges</h2>
        {status.recent_challenges.length === 0 ? (
          <EmptyState title="No challenges recorded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Challenge ID</th>
                  <th className="px-3 py-2">Received At</th>
                  <th className="px-3 py-2">Events</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {status.recent_challenges.map((c) => (
                  <tr key={c.challenge_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{c.challenge_id}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(c.received_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2">{c.events}</td>
                    <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-2 text-slate-500">{c.response_ms != null ? `${c.response_ms} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
