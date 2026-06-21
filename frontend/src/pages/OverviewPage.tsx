import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Globe2,
  Network,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '@/components/dashboard/StatCard';
import { LiveEventStream } from '@/components/dashboard/LiveEventStream';
import { WorldMap } from '@/components/map/WorldMap';
import { Card, EmptyState, RiskBadge } from '@/components/ui';
import {
  useAlerts,
  useHistoryByCountry,
  useProcesses,
  useStats,
} from '@/api/queries';
import { countryFlag, timeAgo } from '@/utils/format';

export function OverviewPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useStats();
  const { data: processes } = useProcesses();
  const { data: byCountry } = useHistoryByCountry();
  const { data: alerts } = useAlerts({ acknowledged: false });

  const topProcesses = (processes ?? [])
    .slice()
    .sort((a, b) => b.active_connections - a.active_connections)
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active" value={stats?.active_connections ?? 0} icon={Network} loading={isLoading} />
        <StatCard label="Apps online" value={stats?.active_processes ?? 0} icon={Activity} accent="ok" loading={isLoading} />
        <StatCard label="Destinations" value={stats?.unique_destinations ?? 0} icon={Waypoints} loading={isLoading} />
        <StatCard label="Countries" value={stats?.countries_connected ?? 0} icon={Globe2} loading={isLoading} />
        <StatCard label="New today" value={stats?.new_destinations_today ?? 0} icon={Sparkles} accent="warn" loading={isLoading} />
        <StatCard label="Alerts" value={stats?.alerts_today ?? 0} icon={Bell} accent="danger" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Live World Map" className="xl:col-span-2" action={
          <button onClick={() => navigate('/map')} className="text-xs text-accent hover:underline">
            Open full map →
          </button>
        }>
          <WorldMap className="h-[360px]" onSelect={(ip) => navigate(`/destinations/${ip}`)} />
          <p className="mt-2 text-[11px] text-muted">
            Origin is an approximate location and does not reveal your exact position.
          </p>
        </Card>

        <LiveEventStream className="h-[420px] xl:col-span-1" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Top Active Applications">
          {topProcesses.length === 0 ? (
            <EmptyState title="No active applications yet" />
          ) : (
            <ul className="space-y-2">
              {topProcesses.map((p) => (
                <li
                  key={p.id}
                  onClick={() => navigate(`/processes/${p.pid}`)}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{p.process_name}</p>
                    <p className="text-[11px] text-muted">{p.unique_destinations} destinations · {p.countries} countries</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-text">{p.active_connections}</span>
                    <RiskBadge score={p.max_risk} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Connections by Country" className="lg:col-span-2">
          {!byCountry || byCountry.length === 0 ? (
            <EmptyState title="No geolocated destinations yet" message="Enable geolocation in Settings to populate this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCountry.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 44 56)" vertical={false} />
                <XAxis dataKey="country_code" tick={{ fill: 'rgb(138 147 163)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgb(138 147 163)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'rgb(21 26 36)', border: '1px solid rgb(38 44 56)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'rgb(233 236 242)' }}
                />
                <Bar dataKey="count" fill="rgb(78 161 255)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="Recent Alerts" action={
        <button onClick={() => navigate('/alerts')} className="text-xs text-accent hover:underline">
          View all →
        </button>
      }>
        {!alerts || alerts.length === 0 ? (
          <EmptyState title="No unacknowledged alerts" message="Unusual activity will appear here. It does not automatically mean malware." />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-text">{a.title}</span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  {a.destination_country && <span>{countryFlag(null)} {a.destination_country}</span>}
                  {timeAgo(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
