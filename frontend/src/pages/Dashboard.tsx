import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  FileCheck2,
  Clock4,
  Link2,
  CopyX,
  TriangleAlert,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
} from 'recharts';
import { StatCard } from '../components/cards/StatCard';
import { Loading, ErrorState, EmptyState } from '../components/feedback/States';
import { getSummary, getAnalytics } from '../services/state';
import { listLines } from '../services/productionLines';
import type { Summary, Analytics } from '../types';

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        getSummary(source || null),
        getAnalytics(24),
      ]);
      setSummary(s);
      setAnalytics(a);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    listLines()
      .then((ls) => setLines(ls.map((l) => l.source_id)))
      .catch(() => setLines([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const hasTrendData = !!analytics && analytics.trend.some((p) => p.count_total > 0 || p.void_total > 0);
  const hasLineData = !!analytics && analytics.by_line.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Live overview of production events</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            aria-label="Filter by production line"
          >
            <option value="">All Lines</option>
            {lines.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            onClick={load}
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && !summary && <Loading label="Loading production data…" />}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Net Total" value={summary.net_total} sub="Total production" icon={TrendingUp} tone="green" />
          <StatCard label="Processed" value={summary.processed_events} sub="Accepted events" icon={FileCheck2} tone="blue" />
          <StatCard label="Pending ACK" value={summary.pending_ack} sub="Needs review" icon={Clock4} tone="orange" />
          <StatCard label="Unresolved" value={summary.unresolved} sub="Pending reference" icon={Link2} tone="purple" />
          <StatCard label="Duplicates" value={summary.duplicates} sub="Ignored submissions" icon={CopyX} tone="red" />
          <StatCard label="Conflicts" value={summary.conflicts} sub="Data mismatch" icon={TriangleAlert} tone="red" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Production Trend (Last 24 Hours)</h2>
          {hasTrendData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics!.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => h.slice(11, 16)}
                    tick={{ fontSize: 11 }}
                    interval={3}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(h) => `Hour ${h}`} />
                  <Legend />
                  <Bar dataKey="count_total" name="COUNT" fill="#10B981" />
                  <Bar dataKey="void_total" name="VOID" fill="#EF4444" />
                  <Line type="monotone" dataKey="net_total" name="Net Total" stroke="#2563EB" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No production history yet" hint="Submit events to see the trend." />
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Net Total by Line</h2>
          {hasLineData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics!.by_line}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="source_id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="net_total" name="Net Total" fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No lines with production yet" hint="Production by line appears here." />
          )}
        </div>
      </div>
    </div>
  );
}
