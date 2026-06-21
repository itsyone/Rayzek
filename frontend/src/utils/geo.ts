// Helpers to build great-circle-ish arc geometry between two lon/lat points.

export type LngLat = [number, number];

/** Interpolate a gently curved arc between origin and destination.
 * Uses a simple quadratic curve lifted toward the antipodal midpoint so arcs
 * bow outward like flight paths. Returns `steps`+1 points. */
export function arcPoints(origin: LngLat, dest: LngLat, steps = 48): LngLat[] {
  const [lon1, lat1] = origin;
  const [lon2, lat2] = dest;

  // Handle antimeridian by unwrapping longitude.
  let dLon = lon2 - lon1;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;

  const points: LngLat[] = [];
  const dist = Math.hypot(dLon, lat2 - lat1);
  const lift = Math.min(dist * 0.18, 28); // curve height in degrees, capped

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = lon1 + dLon * t;
    const lat = lat1 + (lat2 - lat1) * t;
    // Parabolic lift, peaking at the midpoint.
    const bump = Math.sin(Math.PI * t) * lift;
    points.push([lon, lat + bump]);
  }
  return points;
}

/** Point at parameter t (0..1) along a precomputed arc point list. */
export function pointAt(points: LngLat[], t: number): LngLat {
  const clamped = Math.max(0, Math.min(0.999, t));
  const idx = clamped * (points.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(points.length - 1, lo + 1);
  const frac = idx - lo;
  const [x0, y0] = points[lo];
  const [x1, y1] = points[hi];
  return [x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac];
}

/** Risk score (0-100) to a CSS color used for markers/arcs. */
export function riskColor(score: number): string {
  if (score >= 75) return '#f05a5a';
  if (score >= 50) return '#f5a623';
  if (score >= 25) return '#4ea1ff';
  return '#46c88c';
}
