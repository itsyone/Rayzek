import { useEffect, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { ConnectionsTable } from '@/components/connections/ConnectionsTable';
import { ConnectionDrawer } from '@/components/connections/ConnectionDrawer';
import { Button, Card } from '@/components/ui';
import { useConnections, type ConnectionFilters } from '@/api/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppStore } from '@/stores/useAppStore';
import { api, buildQuery } from '@/api/client';

const PAGE_SIZE = 50;

export function ConnectionsPage() {
  const globalSearch = useAppStore((s) => s.globalSearch);
  const [search, setSearch] = useState(globalSearch);
  const [activeOnly, setActiveOnly] = useState(false);
  const [protocol, setProtocol] = useState('');
  const [minRisk, setMinRisk] = useState(0);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState('last_seen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => setSearch(globalSearch), [globalSearch]);
  const debouncedSearch = useDebounce(search, 300);
  useEffect(() => setPage(0), [debouncedSearch, activeOnly, protocol, minRisk]);

  const filters: ConnectionFilters = {
    search: debouncedSearch || undefined,
    active: activeOnly || undefined,
    protocol: protocol || undefined,
    min_risk: minRisk || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, isFetching } = useConnections(filters);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportCurrent = () => {
    api.download(`/export/connections.csv${buildQuery({ ...filters, limit: undefined, offset: undefined })}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search process, IP, hostname, country…"
              className="w-full rounded-lg border border-border bg-elevated py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="accent-[rgb(78,161,255)]"
            />
            Active only
          </label>

          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            className="rounded-lg border border-border bg-elevated px-2 py-2 text-xs text-text"
          >
            <option value="">All protocols</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-muted">
            <Filter className="h-3.5 w-3.5" />
            Min risk {minRisk}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="accent-[rgb(78,161,255)]"
            />
          </label>

          <Button size="sm" variant="ghost" onClick={exportCurrent}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </Card>

      <Card>
        <ConnectionsTable
          connections={data?.items ?? []}
          loading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onOpenDetails={setSelectedId}
        />

        <footer className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <span>
            {total.toLocaleString()} connection{total === 1 ? '' : 's'}
            {isFetching && ' · updating…'}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span>
              Page {page + 1} / {pages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </footer>
      </Card>

      <ConnectionDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
