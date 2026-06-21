import { useNavigate } from 'react-router-dom';
import { AppWindow } from 'lucide-react';
import { Card, EmptyState, RiskBadge, Skeleton } from '@/components/ui';
import { useProcesses } from '@/api/queries';
import { shortPath, timeAgo } from '@/utils/format';

export function ProcessesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useProcesses();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<AppWindow className="h-8 w-8" />}
          title="No applications observed yet"
          message="Once applications make network connections they will appear here."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/processes/${p.pid}`)}
          className="rz-panel p-4 text-left transition-colors hover:border-accent/40"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-sm font-bold uppercase text-accent">
                {p.process_name.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{p.process_name}</p>
                <p className="font-mono text-[11px] text-muted">PID {p.pid}</p>
              </div>
            </div>
            <RiskBadge score={p.max_risk} />
          </div>

          <p className="mt-3 truncate text-[11px] text-muted" title={p.executable_path ?? ''}>
            {shortPath(p.executable_path)}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Active" value={p.active_connections} />
            <Stat label="Dests" value={p.unique_destinations} />
            <Stat label="Countries" value={p.countries} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Last activity {timeAgo(p.last_seen)}</p>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-elevated py-2">
      <p className="font-mono text-base text-text">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
