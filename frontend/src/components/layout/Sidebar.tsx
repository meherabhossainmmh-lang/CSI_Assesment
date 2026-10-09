import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  CheckSquare,
  AlertTriangle,
  Wifi,
  Factory,
  X,
  BarChart3,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/submit', label: 'Submit Events', icon: Send, end: false },
  { to: '/pending', label: 'Pending Acks', icon: CheckSquare, end: false },
  { to: '/exceptions', label: 'Exceptions', icon: AlertTriangle, end: false },
  { to: '/mqtt', label: 'MQTT Status', icon: Wifi, end: false },
  { to: '/lines', label: 'Production Lines', icon: Factory, end: false },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-slate-200 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="text-sm font-semibold leading-tight text-white">
              Production
              <br />
              Monitor
            </div>
          </div>
          <button
            className="rounded p-1 text-slate-300 hover:bg-navysoft lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-navysoft hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 text-xs text-slate-500">FSE-01 · Candidate 08</div>
      </aside>
    </>
  );
}
