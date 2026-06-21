import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { Alert } from '@/types';
import { Button, SeverityBadge } from '@/components/ui';
import { countryFlag, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

export function AlertCard({
  alert,
  onAcknowledge,
}: {
  alert: Alert;
  onAcknowledge: (id: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rz-panel p-4',
        alert.acknowledged ? 'opacity-60' : '',
        alert.severity === 'high' && !alert.acknowledged ? 'border-danger/40' : '',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="rz-chip border-border text-muted">{alert.alert_type}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-text">{alert.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{alert.description}</p>
        </div>
        {!alert.acknowledged && (
          <Button size="sm" variant="ghost" onClick={() => onAcknowledge(alert.id)}>
            <Check className="h-3.5 w-3.5" />
            Acknowledge
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {alert.process_name && <span>Process: {alert.process_name}</span>}
        {alert.remote_ip && <span className="font-mono">{alert.remote_ip}</span>}
        {alert.destination_country && (
          <span>
            {countryFlag(null)} {alert.destination_country}
          </span>
        )}
        <span className="ml-auto">{timeAgo(alert.created_at)}</span>
      </div>

      {alert.evidence && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-medium text-accent">
            View evidence
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted">
            {JSON.stringify(alert.evidence, null, 2)}
          </pre>
        </details>
      )}
    </motion.div>
  );
}
