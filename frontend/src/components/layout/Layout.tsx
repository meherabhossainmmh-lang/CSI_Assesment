import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { getHealth } from '../../services/health';
import { getMqttStatus } from '../../services/mqtt';
import type { HealthState } from '../../types';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const h = await getHealth();
      if (cancelled) return;
      if (!h) {
        setHealth({ backendConnected: false, mqttEnabled: false, mqttConnected: false });
        return;
      }
      let mqttConnected = false;
      try {
        const m = await getMqttStatus();
        mqttConnected = m.connected;
      } catch {
        mqttConnected = false;
      }
      if (!cancelled)
        setHealth({ backendConnected: h.ok, mqttEnabled: h.mqtt.enabled, mqttConnected });
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar health={health} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
