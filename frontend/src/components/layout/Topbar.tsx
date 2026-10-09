import { Menu } from 'lucide-react';
import type { HealthState } from '../../types';

interface Props {
  health: HealthState | null;
  onMenu: () => void;
}

function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}

export function Topbar({ health, onMenu }: Props) {
  const now = new Date();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          className="rounded p-1 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-4 sm:flex">
          <Dot ok={!!health?.backendConnected} label={health?.backendConnected ? 'Backend Connected' : 'Backend Offline'} />
          <Dot ok={!!health?.mqttConnected} label={health?.mqttConnected ? 'MQTT Online' : 'MQTT Offline'} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 md:inline">
          {now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
          {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            AD
          </span>
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">Supervisor</span>
        </div>
      </div>
    </header>
  );
}
