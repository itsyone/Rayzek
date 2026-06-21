import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Pause, Play, Search, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppStore } from '@/stores/useAppStore';
import { useClientConfig } from '@/api/queries';
import { api } from '@/api/client';
import { cn } from '@/utils/cn';

const TITLES: Record<string, string> = {
  '/': 'Overview',
  '/map': 'Live Map',
  '/connections': 'Connections',
  '/processes': 'Processes',
  '/destinations': 'Destinations',
  '/alerts': 'Alerts',
  '/history': 'History',
  '/settings': 'Settings',
};

export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const paused = useAppStore((s) => s.paused);
  const togglePaused = useAppStore((s) => s.togglePaused);
  const wsStatus = useAppStore((s) => s.wsStatus);
  const search = useAppStore((s) => s.globalSearch);
  const setSearch = useAppStore((s) => s.setGlobalSearch);
  const { data: config } = useClientConfig();

  const title =
    TITLES[pathname] ??
    (pathname.startsWith('/processes')
      ? 'Process Detail'
      : pathname.startsWith('/destinations')
        ? 'Destination Detail'
        : 'Rayzek');

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-panel px-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {config?.demo_mode && (
          <span className="rz-chip border-warn/40 bg-warn/10 text-warn">Demo Mode</span>
        )}
      </div>

      <div className="relative ml-4 hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate('/connections');
          }}
          placeholder="Search processes, IPs, hosts, countries…"
          aria-label="Global search"
          className="w-full max-w-md rounded-lg border border-border bg-elevated py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:border-accent/50"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LiveIndicator status={wsStatus} />
        <Button size="sm" variant={paused ? 'primary' : 'ghost'} onClick={togglePaused}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => api.download('/export/connections.csv')}
          title="Export connections to CSV"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate('/settings')}>
          <SettingsIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}

function LiveIndicator({ status }: { status: string }) {
  const map = {
    live: { label: 'Live', color: 'text-ok', dot: 'bg-ok' },
    reconnecting: { label: 'Reconnecting', color: 'text-warn', dot: 'bg-warn' },
    offline: { label: 'Offline', color: 'text-danger', dot: 'bg-danger' },
  } as const;
  const s = map[status as keyof typeof map] ?? map.offline;
  return (
    <span className={cn('rz-chip border-border', s.color)}>
      <span className="relative flex h-2 w-2">
        {status === 'live' && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-ring', s.dot)} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', s.dot)} />
      </span>
      {s.label}
    </span>
  );
}
