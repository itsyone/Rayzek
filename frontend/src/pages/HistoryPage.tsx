import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState } from '@/components/ui';
import { useHistoryByCountry, useHistoryByProcess, useHistoryTimeline } from '@/api/queries';
import { PlaybackPanel } from '@/components/history/PlaybackPanel';

const RANGES = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

const axis = { fill: 'rgb(138 147 163)', fontSize: 11 };
const tooltipStyle = {
  background: 'rgb(21 26 36)',
  border: '1px solid rgb(38 44 56)',
  borderRadius: 8,
  fontSize: 12,
};

export function HistoryPage() {
  const [hours, setHours] = useState(24);
  const { data: timeline } = useHistoryTimeline(hours);
  const { data: byCountry } = useHistoryByCountry();
  const { data: byProcess } = useHistoryByProcess();

  return (
    <div className="space-y-5">
      <Card
        title="Connection Activity"
        action={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                onClick={() => setHours(r.hours)}
                className={`rounded-md px-2 py-0.5 text-xs ${hours === r.hours ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        {!timeline || timeline.length === 0 ? (
          <EmptyState title="No activity in this range" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(78 161 255)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="rgb(78 161 255)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 44 56)" vertical={false} />
              <XAxis dataKey="bucket" tick={axis} tickFormatter={(v) => String(v).slice(11, 16)} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'rgb(233 236 242)' }} />
              <Area type="monotone" dataKey="count" stroke="rgb(78 161 255)" fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Connections by Country">
          {!byCountry || byCountry.length === 0 ? (
            <EmptyState title="No geolocated data" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byCountry.slice(0, 12)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 44 56)" horizontal={false} />
                <XAxis type="number" tick={axis} allowDecimals={false} />
                <YAxis type="category" dataKey="country_code" tick={axis} width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="rgb(245 166 35)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Connections by Process">
          {!byProcess || byProcess.length === 0 ? (
            <EmptyState title="No process data" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byProcess.slice(0, 12)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(38 44 56)" horizontal={false} />
                <XAxis type="number" tick={axis} allowDecimals={false} />
                <YAxis type="category" dataKey="process_name" tick={axis} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="rgb(70 200 140)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <PlaybackPanel />
    </div>
  );
}
