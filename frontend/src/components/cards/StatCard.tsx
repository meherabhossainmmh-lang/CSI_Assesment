import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  tone: 'green' | 'blue' | 'orange' | 'purple' | 'red';
}

const TONES: Record<Props['tone'], { bg: string; text: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  orange: { bg: 'bg-amber-50', text: 'text-amber-600' },
  purple: { bg: 'bg-violet-50', text: 'text-violet-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600' },
};

export function StatCard({ label, value, sub, icon: Icon, tone }: Props) {
  const t = TONES[tone];
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className={`rounded-lg p-2.5 ${t.bg}`}>
        <Icon className={`h-5 w-5 ${t.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
