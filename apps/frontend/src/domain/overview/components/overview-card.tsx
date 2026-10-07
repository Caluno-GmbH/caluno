import { Badge } from '@repo/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shared row: identity on the left, one status badge on the right. */
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
  meta?: string;
  title?: string;
  children?: ReactNode;
}) {
  if (!meta && !title && !children) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {meta ? (
        <p className="truncate text-sm leading-none text-muted-foreground tabular-nums">
          {meta}
        </p>
      ) : null}
      {title ? (
        <p className="line-clamp-2 whitespace-normal break-words text-base font-bold leading-snug text-card-foreground">
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
  meta?: string;
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

export function OverviewStatusBadge({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Badge variant="outline" className="shrink-0">
      {Icon ? <Icon /> : null}
      {children}
    </Badge>
  );
}
