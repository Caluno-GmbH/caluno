'use client';

import type * as React from 'react';

import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

type EntityCellProps = {
  avatar?: { src?: string; alt: string; fallback: React.ReactNode };
  icon?: React.ElementType;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

function EntityCell({
  avatar,
  icon: Icon,
  title,
  subtitle,
  trailing,
  className,
}: EntityCellProps) {
  return (
    <div
      data-slot="entity-cell"
      className={cn('flex items-center gap-2 min-w-0', className)}
    >
      {avatar ? (
        <Avatar className="size-8 shrink-0">
          {avatar.src && <AvatarImage src={avatar.src} alt={avatar.alt} />}
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
        </Avatar>
      ) : Icon ? (
        <div className="size-8 shrink-0 flex items-center justify-center">
          <Icon className="size-8" />
        </div>
      ) : null}
      <div className="flex flex-col min-w-0">
        <span className="text-base text-foreground line-clamp-3 break-words">
          {title}
        </span>
        {subtitle && (
          <span className="text-sm text-muted-foreground line-clamp-1 break-words">
            {subtitle}
          </span>
        )}
      </div>
      {trailing && <div className="shrink-0 [&>svg]:size-4">{trailing}</div>}
    </div>
  );
}

type TextCellProps = { children: React.ReactNode; className?: string };

// Wraps up to 3 lines then clamps, so long values (addresses, names) stay
// fully readable within the column instead of being cut off on one line.
function TextCell({ children, className }: TextCellProps) {
  return (
    <span
      data-slot="text-cell"
      className={cn(
        'block text-base text-foreground line-clamp-3 break-words',
        className,
      )}
    >
      {children}
    </span>
  );
}

type StatusCellProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

function StatusCell({ children, trailing, className }: StatusCellProps) {
  return (
    <span
      data-slot="status-cell"
      className={cn('inline-flex flex-wrap items-center gap-1.5', className)}
    >
      {children}
      {trailing && <span className="[&>svg]:size-4">{trailing}</span>}
    </span>
  );
}

type NumberCellProps = { children: React.ReactNode; className?: string };

function NumberCell({ children, className }: NumberCellProps) {
  return (
    <span
      data-slot="number-cell"
      className={cn(
        'block text-right tabular-nums text-base text-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

type ActionsCellProps = { children: React.ReactNode; className?: string };

function ActionsCell({ children, className }: ActionsCellProps) {
  return (
    <div
      data-slot="actions-cell"
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
    >
      {children}
    </div>
  );
}

export type {
  ActionsCellProps,
  EntityCellProps,
  NumberCellProps,
  StatusCellProps,
  TextCellProps,
};
export { ActionsCell, EntityCell, NumberCell, StatusCell, TextCell };
