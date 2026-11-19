'use client';

import { Button, Label } from '@repo/ui';
import { Undo2Icon } from 'lucide-react';

interface DeliveryFieldHeadingProps {
  id?: string;
  label: string;
  htmlFor?: string;
  sourceLabel: string;
  showReset: boolean;
  resetLabel: string;
  onReset: () => void;
  disabled: boolean;
}

/** Shared field title: label, inheritance note, and the explicit Reset action. */
export function DeliveryFieldHeading({
  id,
  label,
  htmlFor,
  sourceLabel,
  showReset,
  resetLabel,
  onReset,
  disabled,
}: DeliveryFieldHeadingProps) {
  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {htmlFor ? (
          <Label
            htmlFor={htmlFor}
            className="text-sm font-semibold text-card-foreground"
          >
            {label}
          </Label>
        ) : (
          <span
            id={id}
            className="text-sm font-semibold leading-none text-card-foreground"
          >
            {label}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {`· ${sourceLabel}`}
        </span>
      </div>
      {showReset && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onReset}
          disabled={disabled}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Undo2Icon size={12} className="size-3" aria-hidden="true" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
