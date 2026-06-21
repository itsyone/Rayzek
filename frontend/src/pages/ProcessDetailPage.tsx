import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, EmptyState, RiskBadge, Spinner } from '@/components/ui';
import { ConnectionsTable } from '@/components/connections/ConnectionsTable';
import { ConnectionDrawer } from '@/components/connections/ConnectionDrawer';
import { useAlerts, useProcess, useProcessConnections } from '@/api/queries';
import { AlertCard } from '@/components/alerts/AlertCard';
import { useAcknowledgeAlert } from '@/api/queries';
import { formatDateTime, shortPath } from '@/utils/format';

export function ProcessDetailPage() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const numericPid = Number(pid);
  const { data: proc, isLoading } = useProcess(numericPid);
  const { data: conns } = useProcessConnections(numericPid);
  const { data: alerts } = useAlerts({ process_name: proc?.process_name });
  const ack = useAcknowledgeAlert();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('last_seen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  if (isLoading) return <Spinner className="mx-auto mt-12 h-6 w-6" />;
  if (!proc) return <EmptyState title="Process not found" />;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/processes')} className="flex items-center gap-1 text-xs text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to processes
      </button>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text">{proc.process_name}</h1>
            <p className="font-mono text-xs text-muted">PID {proc.pid} · {proc.username ?? 'unknown user'}</p>
            <p className="mt-1 text-xs text-muted" title={proc.executable_path ?? ''}>
              {shortPath(proc.executable_path)}
            </p>
          </div>
          <RiskBadge score={proc.max_risk} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Active" value={proc.active_connections} />
          <Metric label="Destinations" value={proc.unique_destinations} />
          <Metric label="Countries" value={proc.countries} />
          <Metric label="Observations" value={proc.total_observations} />
          <Metric label="First seen" value={formatDateTime(proc.first_seen)} small />
        </div>
      </Card>

      <Card title="Connections">
        <ConnectionsTable
          connections={conns ?? []}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(f) => {
            if (sortBy === f) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
            else setSortBy(f);
          }}
          onOpenDetails={setSelectedId}
        />
      </Card>

      <Card title="Related Alerts">
        {!alerts || alerts.length === 0 ? (
          <EmptyState title="No alerts for this process" />
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onAcknowledge={(id) => ack.mutate(id)} />
            ))}
          </div>
        )}
      </Card>

      <ConnectionDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-elevated p-3">
      <p className={small ? 'text-xs text-text' : 'font-mono text-lg text-text'}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
