// Shared API types mirroring the backend Pydantic schemas.

export type Severity = 'informational' | 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'review' | 'elevated' | 'high';

export interface Connection {
  id: number;
  pid: number | null;
  process_name: string | null;
  executable_path: string | null;
  local_ip: string;
  local_port: number;
  remote_ip: string | null;
  remote_port: number | null;
  protocol: string;
  connection_status: string;
  hostname: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  organization: string | null;
  asn: string | null;
  is_new_destination: boolean;
  first_seen: string;
  last_seen: string;
  observation_count: number;
  is_active: boolean;
  risk_score: number;
}

export interface PaginatedConnections {
  items: Connection[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProcessStats {
  id: number;
  pid: number;
  process_name: string;
  executable_path: string | null;
  username: string | null;
  first_seen: string;
  last_seen: string;
  active_connections: number;
  unique_destinations: number;
  countries: number;
  total_observations: number;
  max_risk: number;
}

export interface Destination {
  id: number;
  ip_address: string;
  hostname: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  organization: string | null;
  asn: string | null;
  is_private: boolean;
  first_seen: string;
  last_seen: string;
  observation_count: number;
}

export interface Alert {
  id: number;
  alert_type: string;
  severity: Severity;
  title: string;
  description: string;
  process_name: string | null;
  remote_ip: string | null;
  destination_country: string | null;
  evidence: Record<string, unknown> | null;
  created_at: string;
  acknowledged: boolean;
}

export interface Stats {
  active_connections: number;
  active_processes: number;
  unique_destinations: number;
  countries_connected: number;
  new_destinations_today: number;
  alerts_today: number;
  total_connections: number;
  collector_status: string;
}

export interface Health {
  status: string;
  database: string;
  collector: string;
  demo_mode: boolean;
  platform: string;
  version: string;
  uptime_seconds: number;
}

export interface CollectorStatus {
  status: string;
  running: boolean;
  demo_mode: boolean;
  poll_interval: number;
  last_poll: string | null;
  permission_limited: boolean;
}

export interface ClientConfig {
  map_style_url: string;
  origin: { latitude: number; longitude: number };
  geolocation_enabled: boolean;
  hostname_resolution_enabled: boolean;
  demo_mode: boolean;
  platform: string;
  version: string;
  tshark_enabled: boolean;
}

// WebSocket event envelope
export interface WSEvent<T = Record<string, unknown>> {
  type: WSEventType;
  timestamp: string;
  data: T;
}

export type WSEventType =
  | 'connection_snapshot'
  | 'connection_opened'
  | 'connection_updated'
  | 'connection_closed'
  | 'destination_enriched'
  | 'alert_created'
  | 'statistics_updated'
  | 'collector_status';

export type WSStatus = 'live' | 'reconnecting' | 'offline';
