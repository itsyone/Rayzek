import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, CopyButton, EmptyState, RiskBadge, Spinner } from '@/components/ui';
import { useDestination, useDestinationConnections } from '@/api/queries';
import { countryFlag, formatDateTime, timeAgo } from '@/utils/format';

export function DestinationDetailPage() {
  const { ip = '' } = useParams();
  const navigate = useNavigate();
  const { data: dest, isLoading } = useDestination(ip);
  const { data: conns } = useDestinationConnections(ip);

  if (isLoading) return <Spinner className="mx-auto mt-12 h-6 w-6" />;
  if (!dest) return <EmptyState title="Destination not found" />;

  const processes = Array.from(new Set((conns ?? []).map((c) => c.process_name).filter(Boolean)));
  const ports = Array.from(new Set((conns ?? []).map((c) => c.remote_port).filter(Boolean)));

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/destinations')} className="flex items-center gap-1 text-xs text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to destinations
      </button>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-mono text-xl font-semibold text-text">
              {dest.ip_address}
              <CopyButton value={dest.ip_address} />
            </h1>
            {dest.hostname && <p className="text-sm text-muted">{dest.hostname}</p>}
          </div>
          {dest.is_private && <span className="rz-chip border-border text-muted">Private / local</span>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Info label="Location" value={`${countryFlag(dest.country_code)} ${dest.country_name ?? 'Unknown'}`} />
          <Info label="City" value={dest.city ?? '—'} />
          <Info label="Organization" value={dest.organization ?? 'Unknown'} />
          <Info label="ASN" value={dest.asn ?? '—'} />
          <Info label="First seen" value={formatDateTime(dest.first_seen)} />
          <Info label="Last seen" value={timeAgo(dest.last_seen)} />
          <Info label="Observations" value={String(dest.observation_count)} />
          <Info label="Coordinates" value={dest.latitude != null ? `${dest.latitude.toFixed(2)}, ${dest.longitude?.toFixed(2)}` : '—'} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Processes contacting this destination">
          {processes.length === 0 ? (
            <EmptyState title="No related processes" />
          ) : (
            <ul className="space-y-1 text-sm text-text">
              {processes.map((p) => (
                <li key={p} className="rounded px-2 py-1 hover:bg-elevated">{p}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Common ports">
          {ports.length === 0 ? (
            <EmptyState title="No port data" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {ports.map((p) => (
                <span key={p} className="rz-chip border-border font-mono text-muted">{p}</span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Connection history">
        {!conns || conns.length === 0 ? (
          <EmptyState title="No connection history" />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {conns.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="text-text">{c.process_name}</span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  <span className="font-mono">:{c.remote_port}</span>
                  {timeAgo(c.last_seen)}
                  <RiskBadge score={c.risk_score} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-elevated p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-text">{value}</p>
    </div>
  );
}
