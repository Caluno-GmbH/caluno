'use client';

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../base/avatar';
import { Badge } from '../base/badge';
import { Button } from '../base/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '../base/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import {
  getPassiveDuringShiftHint,
  getVolunteeringStatusPresentation,
  volunteeringActionIcons,
} from './config';
import type {
  ShiftVolunteeringDisplayState,
  ShiftVolunteeringPhase,
  VolunteeringActionLabel,
  VolunteeringStatusOption,
} from './types';
import {
  VolunteeringActionButtons,
  type VolunteeringActionButtonsProps,
  type VolunteeringActionLabels,
} from './volunteering-action-buttons';
import { VolunteeringStatusLabel } from './volunteering-status-label';

const PASSIVE_DURING_SHIFT: ShiftVolunteeringDisplayState[] = [
  'invited',
  'requested',
  'waitlisted',
  'declined',
  'rejected',
  'cancelled',
];

function isPassiveDuringShift(
  phase: ShiftVolunteeringPhase | undefined,
  state: ShiftVolunteeringDisplayState,
): boolean {
  return phase === 'during' && PASSIVE_DURING_SHIFT.includes(state);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export type VolunteeringVolunteerRowProps = {
  name: string;
  image?: string | null;
  state: ShiftVolunteeringDisplayState;
  phase?: ShiftVolunteeringPhase;
  completedDuration?: string;
  /** Overrides status badge label (e.g. i18n). */
  statusLabel?: string;
  /** Extra content shown in a tooltip on the status chip (e.g. check-out windows). */
  statusTooltip?: ReactNode;
  /** When set, renders the status chip as a dropdown offering these targets. */
  statusOptions?: VolunteeringStatusOption[];
  /** Accessible label for the status chip dropdown trigger. */
  statusMenuAriaLabel?: string;
  /** When set, overrides default actions from status presentation. */
  actions?: VolunteeringActionLabel[];
  disabledActions?: VolunteeringActionLabel[];
  actionTooltips?: VolunteeringActionButtonsProps['actionTooltips'];
  /** Far-right icon-only actions (e.g. View profile, Check in). */
  iconActions?: VolunteeringActionLabel[];
  /** Localized button labels keyed by action id. */
  actionLabels?: VolunteeringActionLabels;
  onAction?: (action: VolunteeringActionLabel) => void;
  onStatusChange?: (value: string) => void;
  className?: string;
  /** True while this volunteer has a mutation in flight. */
  busy?: boolean;
};

/** Volunteer row for the shift instance detail page volunteers card. */
export function VolunteeringVolunteerRow({
  name,
  image,
  state,
  phase,
  completedDuration,
  statusLabel,
  statusTooltip,
  statusOptions,
  statusMenuAriaLabel,
  actions: actionsOverride,
  disabledActions,
  actionTooltips,
  iconActions = [],
  actionLabels,
  onAction,
  onStatusChange,
  className,
  busy = false,
}: VolunteeringVolunteerRowProps) {
  const presentation = getVolunteeringStatusPresentation(state, {
    completedDuration,
    phase,
  });
  const passive = isPassiveDuringShift(phase, state);
  const actions = passive ? [] : (actionsOverride ?? presentation.actions);
  const passiveHint = passive ? getPassiveDuringShiftHint(state) : undefined;

  const statusContent = (
    <VolunteeringStatusLabel
      state={state}
      completedDuration={completedDuration}
      phase={phase}
      label={statusLabel}
    />
  );
  const tooltipContent = passiveHint ?? statusTooltip;
  const chip =
    statusOptions && statusOptions.length > 0 && onStatusChange ? (
      <Select value={state} onValueChange={onStatusChange} disabled={busy}>
        <SelectTrigger aria-label={statusMenuAriaLabel}>
          {statusContent}
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem
              value={option.value}
              key={option.value}
              className="pr-2"
            >
              <VolunteeringStatusLabel
                state={option.state}
                phase={phase}
                label={option.label}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : (
      <Badge variant="outline">{statusContent}</Badge>
    );
  const statusChip = tooltipContent ? (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  ) : (
    chip
  );

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-border py-4 last:border-b-0 sm:flex-nowrap sm:gap-4',
        busy && 'opacity-60 transition-opacity',
        className,
      )}
    >
      <div className="order-1 flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="bg-muted shrink-0">
          <AvatarImage src={image ?? ''} alt="" />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <p className="truncate text-base font-medium">{name}</p>
      </div>

      {iconActions.length > 0 ? (
        <div className="order-2 flex shrink-0 items-center gap-2 sm:order-3">
          {iconActions.map((actionLabel) => {
            const ActionIcon = volunteeringActionIcons[actionLabel];
            return (
              <Button
                key={actionLabel}
                type="button"
                variant="outline"
                size="icon-md"
                aria-label={actionLabels?.[actionLabel] ?? actionLabel}
                onClick={() => onAction?.(actionLabel)}
                disabled={busy}
              >
                {ActionIcon ? <ActionIcon aria-hidden /> : null}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="order-3 flex w-full min-w-0 flex-wrap items-center gap-2 pl-11 sm:order-2 sm:w-auto sm:shrink-0 sm:gap-3 sm:pl-0">
        {statusChip}
        <VolunteeringActionButtons
          actions={actions}
          labels={actionLabels}
          disabledActions={busy ? actions : disabledActions}
          actionTooltips={actionTooltips}
          onAction={onAction}
        />
      </div>
    </div>
  );
}
