import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';
import { Skeleton } from '@/components/ui';

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'accent',
  loading,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: 'accent' | 'warn' | 'danger' | 'ok';
  loading?: boolean;
  hint?: string;
}) {
  const accentMap = {
    accent: 'text-accent bg-accent/10',
    warn: 'text-warn bg-warn/10',
    danger: 'text-danger bg-danger/10',
    ok: 'text-ok bg-ok/10',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rz-panel flex items-center gap-4 p-4"
    >
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', accentMap[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-text">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
        )}
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
    </motion.div>
  );
}
