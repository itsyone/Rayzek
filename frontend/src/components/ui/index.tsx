import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { riskLevel } from '@/utils/format';
import type { RiskLevel, Severity } from '@/types';
import { useToastStore } from '@/stores/useToastStore';

// --------------------------------------------------------------------------- Card
export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cn('rz-panel p-4', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-text">{title}</h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// --------------------------------------------------------------------------- Button
export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  className,
  disabled,
  type = 'button',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) {
  const variants = {
    default: 'border-border bg-elevated hover:bg-elevated/70 text-text',
    primary: 'border-accent/40 bg-accent/15 text-accent hover:bg-accent/25',
    ghost: 'border-transparent hover:bg-elevated text-muted hover:text-text',
    danger: 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// --------------------------------------------------------------------------- Badges
const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'border-ok/30 bg-ok/10 text-ok',
  review: 'border-accent/30 bg-accent/10 text-accent',
  elevated: 'border-warn/30 bg-warn/10 text-warn',
  high: 'border-danger/30 bg-danger/10 text-danger',
};

export function RiskBadge({ score }: { score: number }) {
  const level = riskLevel(score);
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return (
    <span
      className={cn('rz-chip tabular-nums', RISK_STYLES[level])}
      title={`Risk score ${score}/100 — ${label}`}
      data-testid="risk-badge"
      data-level={level}
    >
      <span className="font-mono">{score}</span>
      <span>{label}</span>
    </span>
  );
}

const SEVERITY_STYLES: Record<Severity, string> = {
  informational: 'border-muted/30 bg-muted/10 text-muted',
  low: 'border-accent/30 bg-accent/10 text-accent',
  medium: 'border-warn/30 bg-warn/10 text-warn',
  high: 'border-danger/30 bg-danger/10 text-danger',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn('rz-chip capitalize', SEVERITY_STYLES[severity])} data-testid="severity-badge">
      {severity}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const active = ['ESTABLISHED', 'live', 'running'].includes(status);
  const closing = ['CLOSE_WAIT', 'TIME_WAIT', 'FIN_WAIT1', 'FIN_WAIT2'].includes(status);
  const color = active ? 'bg-ok' : closing ? 'bg-warn' : 'bg-muted';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      <span className="font-mono">{status}</span>
    </span>
  );
}

// --------------------------------------------------------------------------- Feedback
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-muted', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-elevated', className)} />;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        {message && <p className="mt-1 max-w-sm text-xs text-muted">{message}</p>}
      </div>
      {action}
    </div>
  );
}

// --------------------------------------------------------------------------- Toaster
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const icons = {
    info: <Info className="h-4 w-4 text-accent" />,
    success: <CheckCircle2 className="h-4 w-4 text-ok" />,
    warning: <AlertTriangle className="h-4 w-4 text-warn" />,
    error: <XCircle className="h-4 w-4 text-danger" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          className="rz-elevated pointer-events-auto flex items-start gap-3 p-3 shadow-panel"
        >
          {icons[t.kind]}
          <div className="flex-1">
            <p className="text-sm font-medium text-text">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-muted">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted hover:text-text">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  return (
    <button
      title={`Copy ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        useToastStore.getState().notify({ kind: 'success', title: 'Copied', message: value });
      }}
      className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
    >
      {label}
    </button>
  );
}
