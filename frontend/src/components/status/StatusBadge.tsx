const TONES: Record<string, string> = {
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACKED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DUPLICATE: 'bg-amber-50 text-amber-700 border-amber-200',
  ALREADY_ACKED: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_REFERENCE: 'bg-orange-50 text-orange-700 border-orange-200',
  'PENDING REF.': 'bg-orange-50 text-orange-700 border-orange-200',
  CONFLICT: 'bg-red-50 text-red-700 border-red-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  NOT_READY: 'bg-slate-100 text-slate-600 border-slate-200',
  NOT_FOUND: 'bg-slate-100 text-slate-600 border-slate-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}
