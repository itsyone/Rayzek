import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, buildQuery } from './client';
import type {
  Alert,
  ClientConfig,
  CollectorStatus,
  Connection,
  Destination,
  Health,
  PaginatedConnections,
  ProcessStats,
  Stats,
} from '@/types';

export interface ConnectionFilters {
  active?: boolean;
  process_name?: string;
  remote_ip?: string;
  country?: string;
  protocol?: string;
  status?: string;
  min_risk?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<Health>('/health'),
    refetchInterval: 10_000,
    retry: false,
  });
}

export function useClientConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<ClientConfig>('/config'),
    staleTime: Infinity,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/stats'),
    refetchInterval: 5_000,
  });
}

export function useCollectorStatus() {
  return useQuery({
    queryKey: ['collector'],
    queryFn: () => api.get<CollectorStatus>('/collector/status'),
    refetchInterval: 5_000,
  });
}

export function useConnections(filters: ConnectionFilters) {
  return useQuery({
    queryKey: ['connections', filters],
    queryFn: () => api.get<PaginatedConnections>(`/connections${buildQuery({ ...filters })}`),
    refetchInterval: 6_000,
    placeholderData: (prev) => prev,
  });
}

export function useConnection(id: number | null) {
  return useQuery({
    queryKey: ['connection', id],
    queryFn: () => api.get<Connection>(`/connections/${id}`),
    enabled: id != null,
  });
}

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: () => api.get<ProcessStats[]>('/processes'),
    refetchInterval: 8_000,
  });
}

export function useProcess(pid: number) {
  return useQuery({
    queryKey: ['process', pid],
    queryFn: () => api.get<ProcessStats>(`/processes/${pid}`),
  });
}

export function useProcessConnections(pid: number) {
  return useQuery({
    queryKey: ['process-connections', pid],
    queryFn: () => api.get<Connection[]>(`/processes/${pid}/connections`),
  });
}

export function useDestinations(search?: string) {
  return useQuery({
    queryKey: ['destinations', search],
    queryFn: () => api.get<Destination[]>(`/destinations${buildQuery({ search })}`),
    refetchInterval: 10_000,
  });
}

export function useDestination(ip: string) {
  return useQuery({
    queryKey: ['destination', ip],
    queryFn: () => api.get<Destination>(`/destinations/${ip}`),
  });
}

export function useDestinationConnections(ip: string) {
  return useQuery({
    queryKey: ['destination-connections', ip],
    queryFn: () => api.get<Connection[]>(`/destinations/${ip}/connections`),
  });
}

export interface AlertFilters {
  severity?: string;
  alert_type?: string;
  acknowledged?: boolean;
  process_name?: string;
}

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => api.get<Alert[]>(`/alerts${buildQuery({ ...filters })}`),
    refetchInterval: 6_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch<Alert>(`/alerts/${id}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Record<string, string>>('/settings'),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, string>) =>
      api.patch<Record<string, string>>('/settings', { settings }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      // Origin/map-style changes flow through /api/config -> refresh the map.
      qc.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

export function useCollectorControl() {
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: () => api.post<CollectorStatus>('/collector/start'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collector'] }),
  });
  const stop = useMutation({
    mutationFn: () => api.post<CollectorStatus>('/collector/stop'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collector'] }),
  });
  return { start, stop };
}

// History
export function useHistoryTimeline(hours = 24) {
  return useQuery({
    queryKey: ['history-timeline', hours],
    queryFn: () => api.get<{ bucket: string; count: number }[]>(`/history/timeline?hours=${hours}`),
  });
}

export function useHistoryByCountry() {
  return useQuery({
    queryKey: ['history-country'],
    queryFn: () =>
      api.get<{ country_code: string; country_name: string; count: number }[]>(
        '/history/by-country',
      ),
    refetchInterval: 12_000,
  });
}

export function useHistoryByProcess() {
  return useQuery({
    queryKey: ['history-process'],
    queryFn: () => api.get<{ process_name: string; count: number }[]>('/history/by-process'),
    refetchInterval: 12_000,
  });
}

export function usePlayback(start?: string, end?: string) {
  return useQuery({
    queryKey: ['playback', start, end],
    queryFn: () => api.get<Connection[]>(`/history/playback${buildQuery({ start, end })}`),
    enabled: false,
  });
}
