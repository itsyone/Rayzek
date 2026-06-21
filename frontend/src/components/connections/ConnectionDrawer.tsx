import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useConnection } from '@/api/queries';
import { CopyButton, RiskBadge, Spinner, StatusDot } from '@/components/ui';
import { countryFlag, formatDateTime, riskLevel } from '@/utils/format';

const RISK_EXPLANATION: Record<string, string> = {
  low: 'Routine activity. Nothing unusual was observed for this connection.',
  review: 'Worth a glance — a new destination or minor anomaly contributed to the score.',
  elevated: 'Several signals combined (e.g. new country + uncommon port). Review recommended.',
  high: 'Multiple signals coincided. This does not necessarily mean malware — review the evidence.',
};

export function ConnectionDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: c, isLoading } = useConnection(id);

  return (
    <AnimatePresence>
      {id != null && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-text">Connection Details</h2>
              <button onClick={onClose} className="text-muted hover:text-text" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {isLoading || !c ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-text">{c.process_name ?? 'unknown'}</p>
                      <p className="font-mono text-xs text-muted">PID {c.pid ?? '—'}</p>
                    </div>
                    <RiskBadge score={c.risk_score} />
                  </div>

                  <Section title="Socket">
                    <Row label="Status" value={<StatusDot status={c.connection_status} />} />
                    <Row label="Protocol" value={c.protocol} />
                    <Row label="Local" value={`${c.local_ip}:${c.local_port}`} />
                    <Row
                      label="Remote"
                      value={
                        <span className="flex items-center gap-2">
                          <span className="font-mono">
                            {c.remote_ip ?? '—'}:{c.remote_port ?? '—'}
                          </span>
                          {c.remote_ip && <CopyButton value={c.remote_ip} />}
                        </span>
                      }
                    />
                  </Section>

                  <Section title="Destination">
                    <Row label="Hostname" value={c.hostname ?? 'Unresolved'} />
                    <Row
                      label="Location"
                      value={`${countryFlag(c.country_code)} ${c.country_name ?? 'Unknown'}${c.city ? ` · ${c.city}` : ''}`}
                    />
                    <Row label="Organization" value={c.organization ?? 'Unknown'} />
                    <Row label="ASN" value={c.asn ?? '—'} />
                  </Section>

                  <Section title="Timeline">
                    <Row label="First seen" value={formatDateTime(c.first_seen)} />
                    <Row label="Last seen" value={formatDateTime(c.last_seen)} />
                    <Row label="Observations" value={String(c.observation_count)} />
                    <Row label="New destination" value={c.is_new_destination ? 'Yes' : 'No'} />
                  </Section>

                  <Section title="Risk explanation">
                    <p className="text-xs leading-relaxed text-muted">
                      {RISK_EXPLANATION[riskLevel(c.risk_score)]}
                    </p>
                  </Section>

                  <Section title="Executable">
                    <p className="break-all font-mono text-xs text-muted">
                      {c.executable_path ?? 'Could not be resolved (may require elevated privileges).'}
                    </p>
                  </Section>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="rz-elevated space-y-2 p-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right text-text">{value}</span>
    </div>
  );
}
