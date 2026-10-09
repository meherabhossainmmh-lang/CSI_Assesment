import { useEffect, useMemo, useState } from 'react';
import { Send, Plus, Trash2, Sparkles } from 'lucide-react';
import { submitEvents } from '../services/events';
import { listLines } from '../services/productionLines';
import { StatusBadge } from '../components/status/StatusBadge';
import type { EventResult } from '../types';

type Tab = 'single' | 'batch' | 'raw';

function nowLocalInputValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function genEventId(): string {
  return `EV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

export function SubmitEvents() {
  const [tab, setTab] = useState<Tab>('single');
  const [lines, setLines] = useState<string[]>([]);

  // form state
  const [sourceSel, setSourceSel] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [type, setType] = useState<'COUNT' | 'VOID'>('COUNT');
  const [eventId, setEventId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [targetId, setTargetId] = useState('');
  const [eventTime, setEventTime] = useState(nowLocalInputValue());

  const [raw, setRaw] = useState('');
  const [batch, setBatch] = useState<Record<string, unknown>[]>([]);

  const [results, setResults] = useState<EventResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listLines()
      .then((ls) => {
        setLines(ls.map((l) => l.source_id));
        if (ls.length > 0) setSourceSel((s) => s || ls[0].source_id);
      })
      .catch(() => setLines([]));
  }, []);

  const sourceId = sourceSel === '__custom__' ? customSource.trim() : sourceSel;

  const preview = useMemo(() => {
    return {
      source_id: sourceId || 'LINE-01',
      event_id: eventId || 'EV-???',
      type,
      quantity: type === 'COUNT' ? Number(quantity) || 0 : undefined,
      target_event_id: type === 'VOID' ? targetId || null : undefined,
      event_time: eventTime ? new Date(eventTime).toISOString() : undefined,
    };
  }, [sourceId, eventId, type, quantity, targetId, eventTime]);

  function buildEvent(): { ok: boolean; event?: Record<string, unknown> } {
    const errs: Record<string, string> = {};
    if (!sourceId) errs.source = 'Production line is required';
    if (!eventId.trim()) errs.eventId = 'Event ID is required';
    if (type === 'COUNT') {
      const q = Number(quantity);
      if (!Number.isInteger(q) || q <= 0) errs.quantity = 'Quantity must be a positive integer';
    } else {
      if (!targetId.trim()) errs.target = 'Target event ID is required for VOID';
    }
    if (!eventTime || Number.isNaN(new Date(eventTime).getTime())) errs.time = 'Event time is required';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return { ok: false };
    return {
      ok: true,
      event: {
        source_id: sourceId,
        event_id: eventId.trim(),
        type,
        quantity: type === 'COUNT' ? Number(quantity) : null,
        target_event_id: type === 'VOID' ? targetId.trim() : null,
        event_time: new Date(eventTime).toISOString(),
      },
    };
  }

  async function doSubmit(body: unknown) {
    setSubmitting(true);
    setFormError(null);
    setResults([]);
    try {
      const r = await submitEvents(body);
      setResults(r);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmitSingle() {
    const b = buildEvent();
    if (!b.ok || !b.event) return;
    doSubmit(b.event);
  }

  function onAddToBatch() {
    const b = buildEvent();
    if (!b.ok || !b.event) return;
    setBatch((prev) => [...prev, b.event!]);
  }

  function onSubmitBatch() {
    if (batch.length === 0) return;
    doSubmit(batch);
  }

  function onSubmitRaw() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setFormError('Raw JSON is not valid syntax');
      return;
    }
    doSubmit(parsed);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'single', label: 'Single Event' },
    { id: 'batch', label: 'Batch Submission' },
    { id: 'raw', label: 'Raw JSON' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Submit Events</h1>
        <p className="text-sm text-slate-500">Send production COUNT or VOID events to the system</p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* form / raw editor */}
        <div className="card p-4">
          {tab !== 'raw' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Production Line *</label>
                <select value={sourceSel} onChange={(e) => setSourceSel(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {lines.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                  <option value="__custom__">+ New line…</option>
                </select>
                {sourceSel === '__custom__' && (
                  <input value={customSource} onChange={(e) => setCustomSource(e.target.value)} placeholder="e.g. LINE-05" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                )}
                {fieldErrors.source && <p className="mt-1 text-xs text-danger">{fieldErrors.source}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Event Type *</label>
                <div className="flex gap-4">
                  {(['COUNT', 'VOID'] as const).map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="etype" checked={type === t} onChange={() => setType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Event ID *</label>
                <div className="flex gap-2">
                  <input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="EV-201" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  <button onClick={() => setEventId(genEventId())} title="Generate unique ID" className="flex items-center gap-1 rounded-md border border-slate-300 px-2 text-xs hover:bg-slate-50">
                    <Sparkles className="h-3.5 w-3.5" /> Gen
                  </button>
                </div>
                {fieldErrors.eventId && <p className="mt-1 text-xs text-danger">{fieldErrors.eventId}</p>}
              </div>

              {type === 'COUNT' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Quantity *</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  {fieldErrors.quantity && <p className="mt-1 text-xs text-danger">{fieldErrors.quantity}</p>}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Target Event ID *</label>
                  <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="EV-101" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  {fieldErrors.target && <p className="mt-1 text-xs text-danger">{fieldErrors.target}</p>}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Event Time *</label>
                <input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                {fieldErrors.time && <p className="mt-1 text-xs text-danger">{fieldErrors.time}</p>}
              </div>

              <div className="flex gap-2">
                {tab === 'single' ? (
                  <button onClick={onSubmitSingle} disabled={submitting} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit Event'}
                  </button>
                ) : (
                  <button onClick={onAddToBatch} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <Plus className="h-4 w-4" /> Add to Batch
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-600">Raw JSON (object or array)</label>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={14} spellCheck={false} className="w-full rounded-md border border-slate-300 p-3 font-mono text-xs" placeholder='{"source_id":"LINE-01","event_id":"EV-201","type":"COUNT","quantity":5,"event_time":"2026-10-09T10:30:00Z"}' />
              <button onClick={onSubmitRaw} disabled={submitting} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Submit JSON'}
              </button>
            </div>
          )}
        </div>

        {/* preview / batch / results */}
        <div className="space-y-4">
          {tab !== 'raw' && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{tab === 'single' ? 'Event JSON Preview' : `Batch (${batch.length})`}</h2>
              {tab === 'single' ? (
                <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-emerald-300">{JSON.stringify(preview, null, 2)}</pre>
              ) : (
                <div className="space-y-2">
                  {batch.length === 0 && <p className="text-sm text-slate-400">No events in batch yet. Use “Add to Batch”.</p>}
                  {batch.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs">
                      <code>{(ev as any).event_id} · {(ev as any).type} · {(ev as any).quantity ?? (ev as any).target_event_id}</code>
                      <button onClick={() => setBatch(batch.filter((_, j) => j !== i))} className="text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {batch.length > 0 && (
                    <button onClick={onSubmitBatch} disabled={submitting} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      <Send className="h-4 w-4" /> {submitting ? 'Submitting…' : `Submit Batch (${batch.length})`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {(formError || results.length > 0) && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Results</h2>
              {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                    <div>
                      <span className="mr-2 text-sm font-medium text-slate-700">{r.event_id ?? '(invalid)'}</span>
                      <span className="text-xs text-slate-500">{r.message}</span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
