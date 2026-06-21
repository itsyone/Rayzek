import { useState } from 'react';
import { BellOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { AlertCard } from '@/components/alerts/AlertCard';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { useAcknowledgeAlert, useAlerts, type AlertFilters } from '@/api/queries';
import { cn } from '@/utils/cn';
import type { Severity } from '@/types';

const SEVERITIES: (Severity | 'all')[] = ['all', 'informational', 'low', 'medium', 'high'];

export function AlertsPage() {
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [ackFilter, setAckFilter] = useState<'all' | 'open' | 'acknowledged'>('open');
  const [search, setSearch] = useState('');

  const filters: AlertFilters = {
    severity: severity === 'all' ? undefined : severity,
    acknowledged: ackFilter === 'all' ? undefined : ackFilter === 'acknowledged',
    process_name: search || undefined,
  };
  const { data, isLoading } = useAlerts(filters);
  const ack = useAcknowledgeAlert();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  severity === s ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value as typeof ackFilter)}
              className="rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text"
            >
              <option value="open">Unacknowledged</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="all">All</option>
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by process…"
              className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs text-text placeholder:text-muted"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellOff className="h-8 w-8" />}
            title="No alerts match these filters"
            message="Alerts use neutral language and always include evidence. They do not automatically mean malware."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {data.map((a) => (
              <AlertCard key={a.id} alert={a} onAcknowledge={(id) => ack.mutate(id)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
