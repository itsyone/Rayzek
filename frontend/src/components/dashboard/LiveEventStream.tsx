import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eraser, Pause, Play } from 'lucide-react';
import { useEventStore, type LiveEventKind } from '@/stores/useEventStore';
import { Button, EmptyState } from '@/components/ui';
import { clockTime } from '@/utils/format';
import { cn } from '@/utils/cn';

const KIND_STYLES: Record<LiveEventKind, string> = {
  OPENED: 'text-ok',
  UPDATED: 'text-accent',
  CLOSED: 'text-muted',
  NEW: 'text-warn',
  ALERT: 'text-danger',
  ENRICHED: 'text-accent',
};

const FILTERS: (LiveEventKind | 'ALL')[] = ['ALL', 'OPENED', 'NEW', 'CLOSED', 'ALERT'];

export function LiveEventStream({ className }: { className?: string }) {
  const events = useEventStore((s) => s.events);
  const clearEvents = useEventStore((s) => s.clearEvents);
  const [filter, setFilter] = useState<LiveEventKind | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [localPaused, setLocalPaused] = useState(false);
  const frozen = useRef<typeof events>([]);

  const shown = useMemo(() => {
    const source = localPaused ? frozen.current : events;
    if (!localPaused) frozen.current = events;
    return filter === 'ALL' ? source : source.filter((e) => e.kind === filter);
  }, [events, filter, localPaused]);

  return (
    <div className={cn('rz-panel flex flex-col', className)}>
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-text">Live Event Stream</h2>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAutoScroll((v) => !v)}
            title="Toggle auto-scroll"
          >
            {autoScroll ? 'Auto' : 'Manual'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLocalPaused((v) => !v)}>
            {localPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearEvents} title="Clear visible events">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-colors',
              filter === f ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto px-3 py-2 font-mono text-xs',
          autoScroll ? '' : 'flex flex-col-reverse',
        )}
      >
        {shown.length === 0 ? (
          <EmptyState title="Waiting for activity" message="Live connection events will appear here." />
        ) : (
          <AnimatePresence initial={false}>
            {shown.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 whitespace-nowrap py-0.5"
              >
                <span className="text-muted">{clockTime(e.time)}</span>
                <span className={cn('w-16 font-semibold', KIND_STYLES[e.kind])}>{e.kind}</span>
                <span className="w-32 truncate text-text">{e.process}</span>
                <span className="text-muted">→</span>
                <span className="truncate text-muted">{e.target}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
