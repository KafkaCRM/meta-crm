import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Phone, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, type buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VariantProps } from 'class-variance-authority';

export type OperationalStatus =
  | 'new'
  | 'active'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'won'
  | 'lost'
  | 'overdue'
  | 'due_today'
  | 'scheduled'
  | 'pending'
  | 'cold'
  | 'error';

const STATUS_STYLES: Record<OperationalStatus, string> = {
  new: 'border-blue-200 bg-blue-50 text-blue-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  contacted: 'border-sky-200 bg-sky-50 text-sky-700',
  qualified: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  converted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  won: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lost: 'border-rose-200 bg-rose-50 text-rose-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  due_today: 'border-amber-200 bg-amber-50 text-amber-700',
  scheduled: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  pending: 'border-slate-200 bg-slate-50 text-slate-700',
  cold: 'border-slate-200 bg-slate-50 text-slate-500',
  error: 'border-red-200 bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<OperationalStatus, string> = {
  new: 'New',
  active: 'Active',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  won: 'Won',
  lost: 'Lost',
  overdue: 'Overdue',
  due_today: 'Due today',
  scheduled: 'Scheduled',
  pending: 'Pending',
  cold: 'Cold',
  error: 'Error',
};

export function OperationalStatusBadge({
  status,
  label,
  className,
}: {
  status: OperationalStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-normal',
        STATUS_STYLES[status],
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </Badge>
  );
}

export function SourceBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const normalized = source.toLowerCase();
  const style =
    normalized.includes('whatsapp')
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized.includes('justdial') || normalized.includes('indiamart')
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : normalized.includes('facebook')
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : normalized.includes('walk')
            ? 'border-purple-200 bg-purple-50 text-purple-700'
            : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <Badge
      variant="outline"
      className={cn('h-5 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-normal', style, className)}
    >
      {source.replace(/_/g, ' ')}
    </Badge>
  );
}

export interface OperationalAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>['variant'];
}

export function ActionToolbar({
  actions,
  className,
}: {
  actions: OperationalAction[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.variant ?? 'outline'}
          size="sm"
          disabled={action.disabled}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick?.();
          }}
          className="h-7 rounded-md px-2 text-xs font-semibold"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export interface CompactRecordRowProps {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  status?: ReactNode;
  source?: ReactNode;
  actions?: OperationalAction[];
  avatar?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function CompactRecordRow({
  title,
  subtitle,
  meta,
  status,
  source,
  actions,
  avatar,
  onClick,
  className,
}: CompactRecordRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/45',
        className,
      )}
    >
      <span className="flex min-w-0 items-start gap-3">
        {avatar ?? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-muted-foreground">
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
            {status}
            {source}
          </span>
          {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
          {meta && <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</span>}
        </span>
      </span>

      {actions && actions.length > 0 && (
        <ActionToolbar actions={actions} className="flex flex-col sm:flex-row" />
      )}
    </button>
  );
}

export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 flex items-center justify-between gap-2 border-t border-border bg-card/95 px-3 py-2 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const DEFAULT_RECORD_ACTIONS = {
  call: (onClick?: () => void): OperationalAction => ({
    id: 'call',
    label: 'Call',
    icon: <Phone className="h-3.5 w-3.5" />,
    onClick,
  }),
  whatsapp: (onClick?: () => void): OperationalAction => ({
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    onClick,
    variant: 'outline',
  }),
  followUp: (onClick?: () => void): OperationalAction => ({
    id: 'follow-up',
    label: 'Follow-up',
    icon: <Clock className="h-3.5 w-3.5" />,
    onClick,
  }),
  assign: (onClick?: () => void): OperationalAction => ({
    id: 'assign',
    label: 'Assign',
    icon: <UserPlus className="h-3.5 w-3.5" />,
    onClick,
  }),
  warn: (label: string, onClick?: () => void): OperationalAction => ({
    id: 'warn',
    label,
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    onClick,
    variant: 'outline',
  }),
  done: (label: string, onClick?: () => void): OperationalAction => ({
    id: 'done',
    label,
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    onClick,
    variant: 'outline',
  }),
};
