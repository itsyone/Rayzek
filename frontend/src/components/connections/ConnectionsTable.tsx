import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import type { Connection } from '@/types';
import { CopyButton, EmptyState, RiskBadge, Skeleton, StatusDot } from '@/components/ui';
import { countryFlag, formatDateTime, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Props {
  connections: Connection[];
  loading?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  onOpenDetails: (id: number) => void;
}

const COLUMNS: { key: string; label: string; sortable?: boolean }[] = [
  { key: 'status', label: '' },
  { key: 'process', label: 'Process' },
  { key: 'remote', label: 'Remote' },
  { key: 'country', label: 'Country' },
  { key: 'remote_port', label: 'Port', sortable: true },
  { key: 'protocol', label: 'Proto' },
  { key: 'last_seen', label: 'Last seen', sortable: true },
  { key: 'observation_count', label: 'Obs', sortable: true },
  { key: 'risk_score', label: 'Risk', sortable: true },
];

export function ConnectionsTable({
  connections,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onOpenDetails,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="No connections match your filters"
        message="Try clearing filters, or check that the collector is running."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="w-8 px-2 py-2" />
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={cn('px-3 py-2 font-medium', c.sortable && 'cursor-pointer select-none hover:text-text')}
                onClick={() => c.sortable && onSort(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sortable && sortBy === c.key && (
                    <span className="text-accent">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {connections.map((c) => (
            <Fragment key={c.id}>
              <tr
                className="border-b border-border/60 transition-colors hover:bg-elevated/50"
                onClick={() => onOpenDetails(c.id)}
                style={{ cursor: 'pointer' }}
              >
                <td className="px-2 py-2">
                  <button
                    aria-label="Expand row"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(expanded === c.id ? null : c.id);
                    }}
                    className="text-muted hover:text-text"
                  >
                    {expanded === c.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', c.is_active ? 'bg-ok' : 'bg-muted')} />
                    <span className="font-medium text-text">{c.process_name ?? 'unknown'}</span>
                    <span className="font-mono text-xs text-muted">#{c.pid ?? '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-xs text-text">{c.remote_ip ?? '—'}</div>
                  {c.hostname && <div className="truncate text-[11px] text-muted">{c.hostname}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {countryFlag(c.country_code)} {c.country_name ?? '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{c.remote_port ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-muted">{c.protocol}</td>
                <td className="px-3 py-2 text-xs text-muted" title={formatDateTime(c.last_seen)}>
                  {timeAgo(c.last_seen)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{c.observation_count}</td>
                <td className="px-3 py-2">
                  <RiskBadge score={c.risk_score} />
                </td>
              </tr>
              {expanded === c.id && (
                <tr className="bg-elevated/30">
                  <td colSpan={COLUMNS.length + 1} className="px-6 py-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs md:grid-cols-4">
                      <Detail label="Status" value={<StatusDot status={c.connection_status} />} />
                      <Detail label="Local" value={`${c.local_ip}:${c.local_port}`} />
                      <Detail
                        label="Remote IP"
                        value={
                          <span className="flex items-center gap-2">
                            <span className="font-mono">{c.remote_ip ?? '—'}</span>
                            {c.remote_ip && <CopyButton value={c.remote_ip} />}
                          </span>
                        }
                      />
                      <Detail label="Organization" value={c.organization ?? 'Unknown'} />
                      <Detail label="ASN" value={c.asn ?? '—'} />
                      <Detail label="City" value={c.city ?? '—'} />
                      <Detail label="First seen" value={formatDateTime(c.first_seen)} />
                      <Detail label="Executable" value={c.executable_path ?? 'Unresolved'} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-text">{value}</p>
    </div>
  );
}
