import type { RiskLevel, Severity } from '@/types';

/** Format a number with thousands separators (1234 -> "1,234"). */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '0';
  return value.toLocaleString('en-US');
}

/** Relative "time ago" string from an ISO timestamp. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Short clock time HH:MM:SS for the event stream. */
export function clockTime(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/** Map a 0-100 risk score to a level. Mirrors the backend thresholds. */
export function riskLevel(score: number): RiskLevel {
  if (score >= 75) return 'high';
  if (score >= 50) return 'elevated';
  if (score >= 25) return 'review';
  return 'low';
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  informational: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Convert a country code to a flag emoji ("US" -> 🇺🇸). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌐';
  const A = 0x1f1e6;
  const chars = code
    .toUpperCase()
    .split('')
    .map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...chars);
}

export function shortPath(path: string | null | undefined): string {
  if (!path) return 'Unresolved';
  const parts = path.split(/[\\/]/);
  return parts.length > 3 ? `…/${parts.slice(-2).join('/')}` : path;
}
