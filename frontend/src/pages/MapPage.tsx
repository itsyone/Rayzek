import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { WorldMap } from '@/components/map/WorldMap';
import { Button, Card } from '@/components/ui';
import { useEventStore } from '@/stores/useEventStore';
import { riskColor } from '@/utils/geo';

export function MapPage() {
  const navigate = useNavigate();
  const markers = useEventStore((s) => s.markers);
  const [animate, setAnimate] = useState(true);

  const markerList = Object.values(markers);
  const geolocated = markerList.filter((m) => Number.isFinite(m.latitude));

  return (
    <div className="grid h-[calc(100vh-9rem)] grid-cols-1 gap-5 xl:grid-cols-4">
      <div className="relative xl:col-span-3">
        <WorldMap
          className="h-full"
          animate={animate}
          onSelect={(ip) => navigate(`/destinations/${ip}`)}
        />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Button size="sm" variant="default" onClick={() => setAnimate((v) => !v)}>
            {animate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {animate ? 'Pause animation' : 'Play animation'}
          </Button>
        </div>
        <div className="absolute bottom-4 left-4 rz-elevated px-3 py-2 text-[11px] text-muted">
          Approximate origin — your exact location is not exposed.
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto">
        <Card title="Legend">
          <ul className="space-y-2 text-xs">
            {[
              ['Low', 0],
              ['Review', 25],
              ['Elevated', 50],
              ['High', 75],
            ].map(([label, score]) => (
              <li key={label} className="flex items-center gap-2 text-muted">
                <span className="h-3 w-3 rounded-full" style={{ background: riskColor(score as number) }} />
                {label} risk
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Marker size reflects how often a destination was observed.</p>
        </Card>

        <Card title={`Destinations (${geolocated.length})`}>
          {geolocated.length === 0 ? (
            <p className="text-xs text-muted">
              No geolocated destinations yet. Enable geolocation in Settings, or wait for the
              collector to enrich destinations.
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
              {geolocated
                .sort((a, b) => b.count - a.count)
                .map((m) => (
                  <li
                    key={m.ip}
                    onClick={() => navigate(`/destinations/${m.ip}`)}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs hover:bg-elevated"
                  >
                    <span className="truncate text-text">{m.hostname || m.ip}</span>
                    <span className="text-muted">{m.country ?? '—'}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
