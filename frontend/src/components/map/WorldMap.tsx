import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEventStore } from '@/stores/useEventStore';
import { useClientConfig } from '@/api/queries';
import { useAppStore } from '@/stores/useAppStore';
import { arcPoints, pointAt, riskColor, type LngLat } from '@/utils/geo';

interface Props {
  className?: string;
  animate?: boolean;
  onSelect?: (ip: string) => void;
  maxArcs?: number;
}

/**
 * MapLibre map with destination markers and animated connection arcs.
 * Sources are updated imperatively via setData so React never re-creates the
 * map or its layers on every connection event.
 */
export function WorldMap({ className, animate = true, onSelect, maxArcs = 80 }: Props) {
  const { data: config } = useClientConfig();
  const markers = useEventStore((s) => s.markers);
  const paused = useAppStore((s) => s.paused);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const arcCacheRef = useRef<Record<string, LngLat[]>>({});

  const origin: LngLat = useMemo(
    () =>
      config
        ? [config.origin.longitude, config.origin.latitude]
        : [-122.4194, 37.7749],
    [config],
  );

  // Keep latest callback/origin in refs so the map is NOT torn down and
  // recreated whenever the parent re-renders (which caused blinking/crashes).
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const originRef = useRef(origin);
  originRef.current = origin;

  const styleUrl = config?.map_style_url;

  // Initialise the map exactly once, when the style URL becomes available.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !styleUrl) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: originRef.current,
      zoom: 1.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('arcs', { type: 'geojson', data: emptyFC() });
      map.addSource('markers', { type: 'geojson', data: emptyFC() });
      map.addSource('pulses', { type: 'geojson', data: emptyFC() });
      map.addSource('origin', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: originRef.current }, properties: {} }],
        },
      });

      map.addLayer({
        id: 'arc-lines',
        type: 'line',
        source: 'arcs',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.1,
          'line-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'marker-circles',
        type: 'circle',
        source: 'markers',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 4, 50, 14],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#090B10',
          'circle-stroke-width': 1,
        },
      });
      map.addLayer({
        id: 'pulse-dots',
        type: 'circle',
        source: 'pulses',
        paint: {
          'circle-radius': 3,
          'circle-color': ['get', 'color'],
          'circle-blur': 0.4,
        },
      });
      map.addLayer({
        id: 'origin-dot',
        type: 'circle',
        source: 'origin',
        paint: {
          'circle-radius': 6,
          'circle-color': '#4ea1ff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      });

      readyRef.current = true;

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.on('mouseenter', 'marker-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<strong>${p.hostname || p.ip}</strong><br/>${p.country || 'Unknown'} · risk ${p.risk}<br/><span style="color:#8a93a3">${p.process} · ${p.count} obs</span>`,
          )
          .addTo(map);
      });
      map.on('mouseleave', 'marker-circles', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('click', 'marker-circles', (e) => {
        const ip = e.features?.[0]?.properties?.ip as string | undefined;
        if (ip) onSelectRef.current?.(ip);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // Only re-create the map if the style URL itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  // Push marker + arc data when markers change — throttled so a burst of live
  // events can't thrash the GL context (which previously crashed WebView2).
  const lastDrawRef = useRef(0);
  const drawTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const draw = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const origin2 = originRef.current;
      const list = Object.values(markers)
        .filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude))
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, maxArcs);

      const markerFeatures: GeoJSON.Feature[] = list.map((m) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
        properties: {
          ip: m.ip,
          count: m.count,
          risk: m.risk,
          color: riskColor(m.risk),
          country: m.country ?? 'Unknown',
          hostname: m.hostname ?? '',
          process: m.process,
        },
      }));

      const arcFeatures: GeoJSON.Feature[] = list.map((m) => {
        const pts = arcCacheRef.current[m.ip] ?? arcPoints(origin2, [m.longitude, m.latitude]);
        arcCacheRef.current[m.ip] = pts;
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: pts },
          properties: { color: riskColor(m.risk), ip: m.ip },
        };
      });

      (map.getSource('markers') as GeoJSONSource | undefined)?.setData(fc(markerFeatures));
      (map.getSource('arcs') as GeoJSONSource | undefined)?.setData(fc(arcFeatures));
    };

    const now = Date.now();
    const elapsed = now - lastDrawRef.current;
    const MIN_INTERVAL = 1200;
    if (elapsed >= MIN_INTERVAL) {
      lastDrawRef.current = now;
      draw();
    } else if (drawTimerRef.current == null) {
      drawTimerRef.current = window.setTimeout(() => {
        drawTimerRef.current = null;
        lastDrawRef.current = Date.now();
        draw();
      }, MIN_INTERVAL - elapsed);
    }
    return () => {
      if (drawTimerRef.current != null) {
        window.clearTimeout(drawTimerRef.current);
        drawTimerRef.current = null;
      }
    };
  }, [markers, maxArcs]);

  // Animate moving pulse dots along the arcs, capped to ~12 fps and paused when
  // the window is hidden, so the GL context stays light.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !animate || paused) return;
    const start = performance.now();
    let lastFrame = 0;

    const step = (now: number) => {
      rafRef.current = requestAnimationFrame(step);
      if (document.hidden || now - lastFrame < 80) return;
      lastFrame = now;
      const t = ((now - start) / 4000) % 1;
      const list = Object.values(useEventStore.getState().markers)
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .slice(0, maxArcs);
      const features: GeoJSON.Feature[] = [];
      for (const m of list) {
        const pts = arcCacheRef.current[m.ip];
        if (!pts) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pointAt(pts, t) },
          properties: { color: riskColor(m.risk) },
        });
      }
      if (readyRef.current) {
        (map.getSource('pulses') as GeoJSONSource | undefined)?.setData(fc(features));
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, paused, maxArcs]);

  if (!config) {
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center text-sm text-muted">
          Loading map configuration…
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-xl" />
    </div>
  );
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}
