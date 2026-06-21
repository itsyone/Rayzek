import { ShieldAlert, WifiOff } from 'lucide-react';
import { useCollectorStatus, useHealth } from '@/api/queries';
import { useAppStore } from '@/stores/useAppStore';

/** Surfaces important degraded states: backend offline, limited privileges. */
export function PermissionBanner() {
  const { data: health, isError } = useHealth();
  const { data: collector } = useCollectorStatus();
  const wsStatus = useAppStore((s) => s.wsStatus);

  if (isError || (health && health.status !== 'ok') || wsStatus === 'offline') {
    return (
      <Banner kind="danger" icon={<WifiOff className="h-4 w-4" />}>
        Backend is offline. Start it with{' '}
        <code className="font-mono">uvicorn app.main:app</code> in the backend folder.
      </Banner>
    );
  }

  if (collector?.permission_limited) {
    return (
      <Banner kind="warn" icon={<ShieldAlert className="h-4 w-4" />}>
        Limited privileges: some process details are hidden. Run the backend as
        Administrator (Windows) or with sudo (Linux) for full visibility.
      </Banner>
    );
  }

  if (collector && !collector.running) {
    return (
      <Banner kind="warn" icon={<ShieldAlert className="h-4 w-4" />}>
        The collector is stopped. Start it from Settings to resume monitoring.
      </Banner>
    );
  }

  return null;
}

function Banner({
  kind,
  icon,
  children,
}: {
  kind: 'warn' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles =
    kind === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-warn/30 bg-warn/10 text-warn';
  return (
    <div className={`flex items-center gap-2 border-b px-5 py-2 text-xs ${styles}`}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
