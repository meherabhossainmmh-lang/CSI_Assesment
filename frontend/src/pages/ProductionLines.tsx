import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, X } from 'lucide-react';
import { listLines, createLine, updateLine } from '../services/productionLines';
import { StatusBadge } from '../components/status/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../components/feedback/States';
import type { ProductionLine } from '../types';

interface LineForm {
  source_id: string;
  display_name: string;
  description: string;
}

const EMPTY: LineForm = { source_id: '', display_name: '', description: '' };

export function ProductionLines() {
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<LineForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LineForm & { status: 'ACTIVE' | 'INACTIVE' }>({ ...EMPTY, status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLines(await listLines());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load production lines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd() {
    setSaving(true);
    setFormError(null);
    try {
      await createLine({ source_id: addForm.source_id.trim(), display_name: addForm.display_name.trim() || addForm.source_id.trim(), description: addForm.description.trim() || null });
      setAddOpen(false);
      setAddForm(EMPTY);
      setMessage('Production line added');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(line: ProductionLine) {
    setEditing(line.source_id);
    setEditForm({ source_id: line.source_id, display_name: line.display_name, description: line.description ?? '', status: line.status });
  }

  async function onSaveEdit() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await updateLine(editing, { display_name: editForm.display_name.trim(), description: editForm.description.trim() || null, status: editForm.status });
      setEditing(null);
      setMessage('Production line updated');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to update line');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Production Lines</h1>
          <p className="text-sm text-slate-500">Manage production line identifiers</p>
        </div>
        <button onClick={() => setAddOpen((o) => !o)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add Line
        </button>
      </div>

      {message && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

      {addOpen && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">New Production Line</h2>
            <button onClick={() => setAddOpen(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input value={addForm.source_id} onChange={(e) => setAddForm({ ...addForm, source_id: e.target.value })} placeholder="Line ID (e.g. LINE-04)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input value={addForm.display_name} onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })} placeholder="Name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="Description" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button onClick={onAdd} disabled={saving || !addForm.source_id.trim()} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Line'}
          </button>
        </div>
      )}

      <div className="card p-4">
        {error && <ErrorState message={error} onRetry={load} />}
        {loading && <Loading label="Loading production lines…" />}
        {!loading && !error && lines.length === 0 && <EmptyState title="No production lines yet" hint="Lines are created here or auto-registered from submitted events." />}

        {!loading && lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Line ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.source_id} className="border-b border-slate-100 hover:bg-slate-50">
                    {editing === l.source_id ? (
                      <>
                        <td className="px-3 py-2 font-medium text-slate-700">{l.source_id}</td>
                        <td className="px-3 py-2"><input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" /></td>
                        <td className="px-3 py-2"><input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" /></td>
                        <td className="px-3 py-2">
                          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{new Date(l.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <button onClick={onSaveEdit} disabled={saving} className="mr-2 rounded-md bg-primary px-3 py-1 text-xs text-white">Save</button>
                          <button onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-3 py-1 text-xs">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium text-slate-700">{l.source_id}</td>
                        <td className="px-3 py-2">{l.display_name}</td>
                        <td className="px-3 py-2 text-slate-500">{l.description ?? '—'}</td>
                        <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-2 text-slate-500">{new Date(l.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => startEdit(l)} className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"><Pencil className="h-3 w-3" /> Edit</button>
                        </td>
                      </>
                    )}
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
