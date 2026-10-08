'use client';

import { Button, Card, CardContent } from '@repo/ui';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type BlockerCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  isActionPending?: boolean | undefined;
  isActionDone?: boolean | undefined;
  doneLabel?: string | undefined;
  /** If provided, renders the action as a link instead of calling onAction. */
  actionHref?: string | undefined;
  actionExternal?: boolean | undefined;
  className?: string | undefined;
};

/**
 * Shared shell for the readiness blocker states (Figma "blocked"
 * frame). Each caller supplies its own icon, copy, and action — the card
 * itself has no state.
 */
export function BlockerCard({
  icon,
  title,
  description,
  buttonLabel,
  onAction,
  isActionPending,
  isActionDone,
  doneLabel,
  actionHref,
  actionExternal,
  className,
}: BlockerCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actionHref && buttonLabel ? (
          <Button type="button" variant="default" asChild>
            <Link
              href={actionHref}
              target={actionExternal ? '_blank' : undefined}
              rel={actionExternal ? 'noopener noreferrer' : undefined}
            >
              {buttonLabel}
            </Link>
          </Button>
        ) : onAction && buttonLabel ? (
          <Button
            type="button"
            variant="default"
            disabled={isActionPending || isActionDone}
            onClick={onAction}
          >
            {isActionDone && doneLabel ? doneLabel : buttonLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
