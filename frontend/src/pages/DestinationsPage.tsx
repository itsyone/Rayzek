import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Waypoints } from 'lucide-react';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { useDestinations } from '@/api/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { countryFlag, timeAgo } from '@/utils/format';

export function DestinationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isLoading } = useDestinations(debounced || undefined);

  return (
    <div className="space-y-4">
      <Card>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP, hostname, organization, country…"
            className="w-full rounded-lg border border-border bg-elevated py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted"
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Waypoints className="h-8 w-8" />}
            title="No destinations yet"
            message="Public destinations contacted by your applications will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Destination</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">ASN</th>
                  <th className="px-3 py-2 font-medium">Obs</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/destinations/${d.ip_address}`)}
                    className="cursor-pointer border-b border-border/60 hover:bg-elevated/50"
                  >
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-text">{d.ip_address}</div>
                      {d.hostname && <div className="truncate text-[11px] text-muted">{d.hostname}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {countryFlag(d.country_code)} {d.country_name ?? 'Unknown'}
                      {d.city ? ` · ${d.city}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{d.organization ?? 'Unknown'}</td>
                    <td className="px-3 py-2 text-xs text-muted">{d.asn ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{d.observation_count}</td>
                    <td className="px-3 py-2 text-xs text-muted">{timeAgo(d.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
