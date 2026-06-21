import { create } from 'zustand';

export type LiveEventKind = 'OPENED' | 'UPDATED' | 'CLOSED' | 'NEW' | 'ALERT' | 'ENRICHED';

export interface LiveEvent {
  id: string;
  time: string; // ISO
  kind: LiveEventKind;
  process: string;
  target: string;
  detail?: string;
  severity?: string;
}

interface MapMarker {
  ip: string;
  latitude: number;
  longitude: number;
  count: number;
  risk: number;
  process: string;
  country?: string | null;
  hostname?: string | null;
  lastSeen: number;
}

interface EventState {
  events: LiveEvent[];
  markers: Record<string, MapMarker>;
  maxEvents: number;
  pushEvent: (e: LiveEvent) => void;
  clearEvents: () => void;
  upsertMarker: (m: MapMarker) => void;
  enrichMarker: (ip: string, patch: Partial<MapMarker>) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  markers: {},
  maxEvents: 200,
  pushEvent: (e) =>
    set((state) => {
      const events = [e, ...state.events];
      if (events.length > state.maxEvents) events.length = state.maxEvents;
      return { events };
    }),
  clearEvents: () => set({ events: [] }),
  upsertMarker: (m) =>
    set((state) => {
      const existing = state.markers[m.ip];
      return {
        markers: {
          ...state.markers,
          [m.ip]: existing
            ? {
                ...existing,
                count: existing.count + 1,
                risk: Math.max(existing.risk, m.risk),
                lastSeen: m.lastSeen,
                process: m.process,
              }
            : m,
        },
      };
    }),
  enrichMarker: (ip, patch) =>
    set((state) => {
      const existing = state.markers[ip];
      // Create the marker if enrichment arrives before any positioned event,
      // so newly geolocated destinations still appear on the map.
      if (!existing) {
        if (patch.latitude == null || patch.longitude == null) return {};
        return {
          markers: {
            ...state.markers,
            [ip]: {
              ip,
              latitude: patch.latitude,
              longitude: patch.longitude,
              count: 1,
              risk: patch.risk ?? 0,
              process: patch.process ?? 'unknown',
              country: patch.country ?? null,
              hostname: patch.hostname ?? null,
              lastSeen: Date.now(),
            },
          },
        };
      }
      return { markers: { ...state.markers, [ip]: { ...existing, ...patch } } };
    }),
}));
