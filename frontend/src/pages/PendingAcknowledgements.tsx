import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, CheckCheck } from 'lucide-react';
import { getPending } from '../services/state';
import { acknowledge } from '../services/acknowledgements';
import { listLines } from '../services/productionLines';
import { StatusBadge } from '../components/status/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../components/feedback/States';
import type { PendingEvent, AckResult } from '../types';

export function PendingAcknowledgements() {
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);
  const [feedback, setFeedback] = useState<AckResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await getPending();
      setPending(p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    listLines().then((ls) => setLines(ls.map((l) => l.source_id))).catch(() => {});
  }, [load]);

  const filtered = useMemo(
    () =>
      pending.filter(
        (p) =>
          (!search || p.event_id.toLowerCase().includes(search.toLowerCase())) &&
          (!lineFilter || p.source_id === lineFilter),
      ),
    [pending, search, lineFilter],
  );

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.includes(p.event_id));

  function toggleAll() {
    if (allSelected) setSelected(selected.filter((id) => !filtered.some((p) => p.event_id === id)));
    else setSelected(Array.from(new Set([...selected, ...filtered.map((p) => p.event_id)])));
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onAcknowledge() {
    if (selected.length === 0) return;
    setAcking(true);
    setFeedback(null);
    try {
      const results = await acknowledge(selected);
      setFeedback(results);
      const done = results.filter((r) => r.status === 'ACKED' || r.status === 'ALREADY_ACKED').map((r) => r.event_id);
      setSelected((prev) => prev.filter((id) => !done.includes(id)));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Acknowledgement failed');
    } finally {
      setAcking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pending Acknowledgements</h1>
        <p className="text-sm text-slate-500">Review and acknowledge completed COUNT events</p>
      </div>

      <div className="card p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by event ID…" className="rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm" />
          </div>
          <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">All Lines</option>
            {lines.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {loading && <Loading label="Loading pending events…" />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState title="No pending acknowledgements" hint="Completed COUNT events awaiting review appear here." />
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                  <th className="px-3 py-2">Event ID</th>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Quantity</th>
                  <th className="px-3 py-2">Event Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.event_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.includes(p.event_id)} onChange={() => toggle(p.event_id)} aria-label={`Select ${p.event_id}`} /></td>
                    <td className="px-3 py-2 font-medium text-slate-700">{p.event_id}</td>
                    <td className="px-3 py-2">{p.source_id}</td>
                    <td className="px-3 py-2"><StatusBadge status={p.event_type === 'COUNT' ? 'ACCEPTED' : 'PENDING_REFERENCE'} /></td>
                    <td className="px-3 py-2">{p.quantity ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(p.event_time).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">{selected.length} selected</span>
          <button onClick={onAcknowledge} disabled={selected.length === 0 || acking} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <CheckCheck className="h-4 w-4" /> {acking ? 'Acknowledging…' : `Acknowledge Selected (${selected.length})`}
          </button>
        </div>

        {feedback && (
          <div className="mt-4 space-y-2">
            {feedback.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span>{r.event_id} — {r.message}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
