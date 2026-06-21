import { useEffect, useState } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useClientConfig,
  useCollectorControl,
  useCollectorStatus,
  useSettings,
  useUpdateSettings,
} from '@/api/queries';
import { api } from '@/api/client';
import { toast } from '@/stores/useToastStore';
import { useAppStore } from '@/stores/useAppStore';

export function SettingsPage() {
  const { data: stored } = useSettings();
  const { data: config } = useClientConfig();
  const { data: collector } = useCollectorStatus();
  const update = useUpdateSettings();
  const { start, stop } = useCollectorControl();
  const resetOnboarding = useAppStore((s) => s.resetOnboarding);

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (stored) setForm((f) => ({ ...defaults, ...stored, ...f }));
  }, [stored]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    await update.mutateAsync(form);
    toast.success('Settings saved', 'Some changes apply immediately; others on restart.');
  };

  const clearHistory = async () => {
    if (!confirm('Clear all stored connection, destination, and alert history? This cannot be undone.')) return;
    await api.del('/history');
    toast.success('History cleared');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Section title="General">
        <Field label="Polling interval (seconds)">
          <input
            type="number"
            min={0.25}
            step={0.25}
            value={form.poll_interval ?? '1'}
            onChange={(e) => set('poll_interval', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Retention period (days, 0 = keep forever)">
          <input
            type="number"
            min={0}
            value={form.retention_days ?? '30'}
            onChange={(e) => set('retention_days', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Time format">
          <select value={form.time_format ?? '24h'} onChange={(e) => set('time_format', e.target.value)} className={inputCls}>
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </Field>
      </Section>

      <Section title="Collector">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Status: <span className="text-text">{collector?.running ? 'Running' : 'Stopped'}</span>
            {collector?.demo_mode && <span className="ml-2 text-warn">(Demo Mode)</span>}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => start.mutate()} disabled={collector?.running}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
            <Button size="sm" variant="danger" onClick={() => stop.mutate()} disabled={!collector?.running}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Map">
        <Field label="Map style URL">
          <input value={form.map_style_url ?? config?.map_style_url ?? ''} onChange={(e) => set('map_style_url', e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Approx. origin latitude">
            <input value={form.origin_latitude ?? String(config?.origin.latitude ?? '')} onChange={(e) => set('origin_latitude', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Approx. origin longitude">
            <input value={form.origin_longitude ?? String(config?.origin.longitude ?? '')} onChange={(e) => set('origin_longitude', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Toggle label="Show map animation" k="map_animation" form={form} set={set} def="true" />
        <Toggle label="Cluster nearby markers" k="map_cluster" form={form} set={set} def="false" />
      </Section>

      <Section title="Alerts">
        <Field label="Connection burst threshold (per 60s)">
          <input type="number" value={form.burst_threshold ?? '100'} onChange={(e) => set('burst_threshold', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Many-countries threshold">
          <input type="number" value={form.many_countries_threshold ?? '6'} onChange={(e) => set('many_countries_threshold', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Minimum severity shown">
          <select value={form.min_severity ?? 'informational'} onChange={(e) => set('min_severity', e.target.value)} className={inputCls}>
            <option value="informational">Informational</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
      </Section>

      <Section title="Privacy">
        <p className="text-xs leading-relaxed text-muted">
          Rayzek stores process names, connection metadata, and public destination IPs locally in
          SQLite. It never captures passwords, cookies, message contents, or packet payloads. Only
          public destination IPs are sent to the geolocation provider, and only when enabled.
        </p>
        <Toggle label="Disable hostname resolution" k="disable_hostname" form={form} set={set} def="false" />
        <Toggle label="Disable external geolocation" k="disable_geolocation" form={form} set={set} def="false" />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => api.download('/export/connections.csv')}>
            Export local data (CSV)
          </Button>
          <Button size="sm" variant="danger" onClick={clearHistory}>
            <Trash2 className="h-3.5 w-3.5" /> Clear history
          </Button>
          <Button size="sm" variant="ghost" onClick={resetOnboarding}>
            Show onboarding again
          </Button>
        </div>
      </Section>

      <Section title="Advanced">
        <p className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          Experimental packet capture (TShark) may require administrator or root privileges and is
          disabled by default. It only captures traffic from this machine. Enable it in the backend
          environment, not here.
        </p>
        <p className="text-xs text-muted">
          TShark mode: <span className="text-text">{config?.tshark_enabled ? 'Enabled' : 'Disabled'}</span> · Platform:{' '}
          <span className="text-text">{config?.platform}</span>
        </p>
      </Section>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-bg py-3">
        <Button variant="primary" onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}

const defaults: Record<string, string> = {
  poll_interval: '1',
  retention_days: '30',
  time_format: '24h',
  burst_threshold: '100',
  many_countries_threshold: '6',
};

const inputCls =
  'w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card title={title}>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  k,
  form,
  set,
  def,
}: {
  label: string;
  k: string;
  form: Record<string, string>;
  set: (k: string, v: string) => void;
  def: string;
}) {
  const checked = (form[k] ?? def) === 'true';
  return (
    <label className="flex items-center justify-between py-1 text-sm text-text">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => set(k, e.target.checked ? 'true' : 'false')}
        className="accent-[rgb(78,161,255)]"
      />
    </label>
  );
}
