import { Badge } from '@repo/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Days-away chip above a grey context chip, right-aligned. */
export function OverviewChipStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">{children}</div>
  );
}

/** Shared row: identity on the left, status chips on the right. */
export function OverviewCardLayout({
  children,
  badge,
}: {
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      {badge}
    </div>
  );
}

/** Muted context line, then the bold title used by every overview card. */
export function OverviewCardCopy({
  meta,
  title,
  children,
}: {
  meta?: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  if (!meta && !title && !children) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {meta ? (
        <p className="truncate text-sm leading-snug whitespace-nowrap text-muted-foreground tabular-nums">
          {meta}
        </p>
      ) : null}
      {title ? (
        <p className="truncate text-base font-bold leading-snug text-card-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function OverviewCardIdentity({
  leading,
  meta,
  title,
  children,
}: {
  leading?: ReactNode;
  meta?: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {leading}
      <OverviewCardCopy meta={meta} title={title}>
        {children}
      </OverviewCardCopy>
    </div>
  );
}

export function OverviewTypeIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2} />
    </div>
  );
}

const TONE_VARIANT = {
  danger: 'error',
  warning: 'alert',
  neutral: 'outline',
} as const;

export function OverviewStatusBadge({
  icon: Icon,
  children,
  tone = 'neutral',
  label,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  /** Danger and warning are outline chips: transparent fill, role-coloured border and text. */
  tone?: keyof typeof TONE_VARIANT;
  /** Accessible name when the visible text is abbreviated. */
  label?: string;
}) {
  return (
    <Badge variant={TONE_VARIANT[tone]} aria-label={label} className="shrink-0">
      {Icon ? <Icon /> : null}
      {children}
    </Badge>
  );
}
