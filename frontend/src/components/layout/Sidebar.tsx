import { NavLink } from 'react-router-dom';
import {
  Activity,
  AppWindow,
  Bell,
  Globe2,
  History,
  LayoutDashboard,
  Network,
  Settings,
  Waypoints,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useCollectorStatus, useHealth } from '@/api/queries';
import { useAppStore } from '@/stores/useAppStore';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Live Map', icon: Globe2 },
  { to: '/connections', label: 'Connections', icon: Network },
  { to: '/processes', label: 'Processes', icon: AppWindow },
  { to: '/destinations', label: 'Destinations', icon: Waypoints },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { data: health } = useHealth();
  const { data: collector } = useCollectorStatus();
  const wsStatus = useAppStore((s) => s.wsStatus);

  const collectorRunning = collector?.running ?? false;
  const backendOnline = health?.status === 'ok';

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/rayzek.svg" alt="" className="h-8 w-8" />
        <div>
          <p className="text-base font-bold leading-none tracking-tight text-text">RAYZEK</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
            Network Visibility
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted hover:bg-elevated hover:text-text',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border px-4 py-4 text-xs">
        <FooterRow
          label="Collector"
          ok={collectorRunning}
          value={collectorRunning ? 'Running' : 'Stopped'}
        />
        <FooterRow
          label="Backend"
          ok={backendOnline}
          value={backendOnline ? 'Online' : 'Offline'}
        />
        <FooterRow
          label="Live feed"
          ok={wsStatus === 'live'}
          warn={wsStatus === 'reconnecting'}
          value={wsStatus === 'live' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
        />
        <div className="flex items-center justify-between pt-1 text-muted">
          <span>Version</span>
          <span className="font-mono">{health?.version ?? '—'}</span>
        </div>
      </div>
    </aside>
  );
}

function FooterRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-text">
        <Activity
          className={cn(
            'h-3 w-3',
            ok ? 'text-ok' : warn ? 'text-warn' : 'text-danger',
          )}
        />
        {value}
      </span>
    </div>
  );
}
