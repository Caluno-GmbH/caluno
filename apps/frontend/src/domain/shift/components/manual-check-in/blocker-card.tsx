'use client';

import { Button, Card, CardContent } from '@repo/ui';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type BlockerCardProps = {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  buttonLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  isActionPending?: boolean | undefined;
  isActionDone?: boolean | undefined;
  doneLabel?: string | undefined;
  /**
   * Copy shown instead of `description` once the action is done, when the
   * outcome needs its own explanation (what happens next, what to wait for).
   */
  doneDescription?: ReactNode;
  actionHref?: string | undefined;
  actionExternal?: boolean | undefined;
  className?: string | undefined;
  /**
   * Accessible name for the action button when its visible label is too terse
   * to stand on its own (e.g. "Invite" on the not-a-member card).
   */
  actionAriaLabel?: string | undefined;
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
  doneDescription,
  actionHref,
  actionExternal,
  className,
  actionAriaLabel,
}: BlockerCardProps) {
  const label = isActionDone && doneLabel ? doneLabel : buttonLabel;
  // Once the action is done the label announces the new state, so the
  // original action name stops applying.
  const ariaLabel = isActionDone ? undefined : actionAriaLabel;
  const shownDescription =
    isActionDone && doneDescription ? doneDescription : description;
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{title}</p>
          <div className="text-sm text-muted-foreground">
            {shownDescription}
          </div>
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
            title={ariaLabel}
            aria-label={ariaLabel}
          >
            {label}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
