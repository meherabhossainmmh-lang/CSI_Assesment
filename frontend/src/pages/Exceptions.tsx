import { useCallback, useEffect, useMemo, useState } from 'react';
import { getExceptions } from '../services/state';
import { StatusBadge } from '../components/status/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../components/feedback/States';
import type { ExceptionRow } from '../types';

type Filter = 'all' | 'unresolved' | 'rejected' | 'conflicts';

export function Exceptions() {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getExceptions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load exceptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'unresolved') return rows.filter((r) => r.classification === 'PENDING_REFERENCE');
    if (filter === 'rejected') return rows.filter((r) => r.classification === 'REJECTED');
    if (filter === 'conflicts') return rows.filter((r) => r.classification === 'CONFLICT');
    return rows;
  }, [rows, filter]);

  const counts = {
    all: rows.length,
    unresolved: rows.filter((r) => r.classification === 'PENDING_REFERENCE').length,
    rejected: rows.filter((r) => r.classification === 'REJECTED').length,
    conflicts: rows.filter((r) => r.classification === 'CONFLICT').length,
  };

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'unresolved', label: `Unresolved (${counts.unresolved})` },
    { id: 'rejected', label: `Rejected (${counts.rejected})` },
    { id: 'conflicts', label: `Conflicts (${counts.conflicts})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Exceptions &amp; Issues</h1>
        <p className="text-sm text-slate-500">Unresolved references, rejected events and conflicts</p>
      </div>

      <div className="card p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)} className={`rounded-lg px-3 py-1.5 text-sm ${filter === t.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {loading && <Loading label="Loading exceptions…" />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState title="No exceptions in this view" hint="Rejected, conflicting or unresolved items appear here." />
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Event ID</th>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Problem</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{r.event_id}</td>
                    <td className="px-3 py-2">{r.source_id}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.classification} /></td>
                    <td className="px-3 py-2 text-slate-500">{r.reason}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(r.received_at).toLocaleTimeString()}</td>
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
