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
      <div className="flex flex-col min-w-0 max-w-80">
        <span className="text-base text-foreground truncate">{title}</span>
        {subtitle && (
          <span className="text-sm text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </div>
      {trailing && <div className="shrink-0 [&>svg]:size-4">{trailing}</div>}
    </div>
  );
}

type TextCellProps = { children: React.ReactNode; className?: string };

// Columns hug their content, so the max width is what makes long text
// truncate instead of widening the table.
function TextCell({ children, className }: TextCellProps) {
  return (
    <span
      data-slot="text-cell"
      className={cn(
        'block max-w-80 text-base text-foreground truncate',
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
      className={cn('inline-flex items-center gap-1.5', className)}
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
      className={cn('flex items-center justify-end gap-2', className)}
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
