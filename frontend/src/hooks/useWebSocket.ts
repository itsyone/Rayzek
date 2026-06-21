import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/useAppStore';
import { useEventStore } from '@/stores/useEventStore';

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/live`;
}

/**
 * Connects to the backend live event stream with exponential-backoff
 * reconnection. Dispatches events to the event store and nudges TanStack Query
 * to refresh affected lists (throttled to avoid render storms).
 */
export function useWebSocket() {
  const qc = useQueryClient();
  const setWsStatus = useAppStore((s) => s.setWsStatus);
  const pushEvent = useEventStore((s) => s.pushEvent);
  const upsertMarker = useEventStore((s) => s.upsertMarker);
  const enrichMarker = useEventStore((s) => s.enrichMarker);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const lastInvalidate = useRef(0);
  const closedByUs = useRef(false);

  useEffect(() => {
    closedByUs.current = false;

    const invalidateThrottled = () => {
      const now = Date.now();
      if (now - lastInvalidate.current > 2500) {
        lastInvalidate.current = now;
        qc.invalidateQueries({ queryKey: ['stats'] });
        qc.invalidateQueries({ queryKey: ['connections'] });
      }
    };

    const connect = () => {
      const paused = useAppStore.getState().paused;
      const ws = new WebSocket(wsUrl());
      socketRef.current = ws;
      if (attemptRef.current === 0) setWsStatus('reconnecting');

      ws.onopen = () => {
        attemptRef.current = 0;
        setWsStatus('live');
      };

      ws.onmessage = (raw) => {
        if (useAppStore.getState().paused) return;
        let evt: { type: string; timestamp: string; data: Record<string, unknown> };
        try {
          evt = JSON.parse(raw.data);
        } catch {
          return;
        }
        const d = evt.data ?? {};

        switch (evt.type) {
          case 'connection_opened': {
            const proc = String(d.process_name ?? 'unknown');
            const ip = String(d.remote_ip ?? '');
            pushEvent({
              id: `${evt.timestamp}-${Math.random()}`,
              time: evt.timestamp,
              kind: d.is_new_destination ? 'NEW' : 'OPENED',
              process: proc,
              target: `${d.hostname ?? ip}:${d.remote_port ?? ''}`,
            });
            if (d.latitude != null && d.longitude != null) {
              upsertMarker({
                ip,
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
                count: 1,
                risk: Number(d.risk_score ?? 0),
                process: proc,
                country: (d.country_name as string) ?? null,
                hostname: (d.hostname as string) ?? null,
                lastSeen: Date.now(),
              });
            }
            invalidateThrottled();
            break;
          }
          case 'connection_closed': {
            pushEvent({
              id: `${evt.timestamp}-${Math.random()}`,
              time: evt.timestamp,
              kind: 'CLOSED',
              process: String(d.process_name ?? 'unknown'),
              target: String(d.remote_ip ?? ''),
            });
            invalidateThrottled();
            break;
          }
          case 'destination_enriched': {
            const ip = String(d.ip_address ?? '');
            if (d.latitude != null && d.longitude != null) {
              enrichMarker(ip, {
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
                country: (d.country_name as string) ?? null,
                hostname: (d.hostname as string) ?? null,
              });
            }
            break;
          }
          case 'alert_created': {
            pushEvent({
              id: `${evt.timestamp}-${Math.random()}`,
              time: evt.timestamp,
              kind: 'ALERT',
              process: String(d.process_name ?? 'unknown'),
              target: String(d.title ?? 'Alert'),
              severity: String(d.severity ?? 'low'),
            });
            qc.invalidateQueries({ queryKey: ['alerts'] });
            break;
          }
          case 'collector_status': {
            qc.invalidateQueries({ queryKey: ['collector'] });
            break;
          }
          default:
            break;
        }
        void paused;
      };

      ws.onclose = () => {
        socketRef.current = null;
        if (closedByUs.current) return;
        setWsStatus('reconnecting');
        attemptRef.current += 1;
        const delay = Math.min(1000 * 2 ** attemptRef.current, 15000);
        setWsStatus(attemptRef.current > 4 ? 'offline' : 'reconnecting');
        window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      socketRef.current?.close();
      setWsStatus('offline');
    };
  }, [qc, setWsStatus, pushEvent, upsertMarker, enrichMarker]);
}
