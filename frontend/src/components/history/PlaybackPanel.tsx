import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { api, buildQuery } from '@/api/client';
import { useEventStore } from '@/stores/useEventStore';
import type { Connection } from '@/types';
import { clockTime } from '@/utils/format';

const SPEEDS = [1, 2, 4, 8];

/**
 * Historical playback: fetches connections in a time range, sorts them by
 * first_seen, and emits them locally at an adjustable speed. Emitted markers
 * flow into the shared map via the event store.
 */
export function PlaybackPanel() {
  const upsertMarker = useEventStore((s) => s.upsertMarker);
  const [start, setStart] = useState(() => isoMinusHours(24));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 16));
  const [events, setEvents] = useState<Connection[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    setPlaying(false);
    setIndex(0);
    try {
      const data = await api.get<Connection[]>(
        `/history/playback${buildQuery({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
        })}`,
      );
      setEvents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearInterval(timer.current);
      return;
    }
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= events.length) {
          setPlaying(false);
          return i;
        }
        const c = events[i];
        if (c && c.latitude != null && c.longitude != null) {
          upsertMarker({
            ip: c.remote_ip ?? `unknown-${i}`,
            latitude: c.latitude,
            longitude: c.longitude,
            count: 1,
            risk: c.risk_score,
            process: c.process_name ?? 'unknown',
            country: c.country_name,
            hostname: c.hostname,
            lastSeen: Date.now(),
          });
        }
        return i + 1;
      });
    }, 600 / speed);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, speed, events, upsertMarker]);

  const progress = events.length ? Math.round((index / events.length) * 100) : 0;

  return (
    <Card title="Historical Playback">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          From
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text"
          />
        </label>
        <label className="text-xs text-muted">
          To
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text"
          />
        </label>
        <Button size="sm" variant="primary" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Load range'}
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No range loaded" message="Select a time range and load it to replay connection events on the map." />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIndex(0);
                setPlaying(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </Button>
            <div className="flex items-center gap-1 text-xs text-muted">
              Speed:
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded px-1.5 py-0.5 ${speed === s ? 'bg-accent/15 text-accent' : 'hover:text-text'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-muted">
              {index} / {events.length}
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-3 max-h-40 overflow-y-auto font-mono text-[11px]">
            {events.slice(Math.max(0, index - 8), index).reverse().map((c, i) => (
              <div key={`${c.id}-${i}`} className="flex gap-2 py-0.5 text-muted">
                <span>{clockTime(c.first_seen)}</span>
                <span className="text-text">{c.process_name}</span>
                <span>→ {c.remote_ip}</span>
                <span>{c.country_name ?? ''}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Emitted markers appear on the Live Map. Open it in another view to watch the replay.
          </p>
        </>
      )}
    </Card>
  );
}

function isoMinusHours(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString().slice(0, 16);
}
