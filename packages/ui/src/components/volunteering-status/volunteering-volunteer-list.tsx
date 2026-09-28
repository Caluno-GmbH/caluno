import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../base/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '../base/card';
import type {
  ShiftVolunteeringDisplayState,
  ShiftVolunteeringPhase,
  VolunteeringActionLabel,
  VolunteeringStatusOption,
} from './types';
import type { VolunteeringActionLabels } from './volunteering-action-buttons';
import { VolunteeringVolunteerRow } from './volunteering-volunteer-row';

export type VolunteeringVolunteerListItem = {
  id: string;
  name: string;
  image?: string | null;
  state: ShiftVolunteeringDisplayState;
  completedDuration?: string;
  statusLabel?: string;
  /** Extra content shown in a tooltip on the status chip (e.g. check-out windows). */
  statusTooltip?: ReactNode;
  statusOptions?: VolunteeringStatusOption[];
  statusMenuAriaLabel?: string;
  /** When set, overrides default actions from status presentation. */
  actions?: VolunteeringActionLabel[];
  disabledActions?: VolunteeringActionLabel[];
  /** Far-right icon-only actions (e.g. View profile, Check in). */
  iconActions?: VolunteeringActionLabel[];
  actionLabels?: VolunteeringActionLabels;
  accessibleActionLabels?: VolunteeringActionLabels;
  busy?: boolean;
};

export type VolunteeringVolunteerGroup = {
  /** Accordion value; must stay stable or fold state resets. */
  key: string;
  label: string;
  volunteers: VolunteeringVolunteerListItem[];
  /** Open unless explicitly false. */
  defaultOpen?: boolean;
};

export type VolunteeringVolunteerListProps = {
  volunteers: VolunteeringVolunteerListItem[];
  phase?: ShiftVolunteeringPhase;
  /** Card title, defaults to "Volunteers". */
  title?: string;
  titleBadge?: ReactNode;
  /** Optional action rendered in the card header (e.g. Invite button). */
  headerAction?: ReactNode;
  /** Localized button labels keyed by action id. */
  actionLabels?: VolunteeringActionLabels;
  accessibleActionLabels?: VolunteeringActionLabels;
  onAction?: (volunteerId: string, action: VolunteeringActionLabel) => void;
  /** Chip dropdown selection: move volunteer to the chosen status value. */
  onStatusChange?: (volunteerId: string, value: string) => void;
  className?: string;
  /** When set, replaces the flat `volunteers` list with foldable sections. */
  groups?: VolunteeringVolunteerGroup[];
};

function VolunteerRows({
  volunteers,
  phase,
  actionLabels,
  accessibleActionLabels,
  onAction,
  onStatusChange,
}: {
  volunteers: VolunteeringVolunteerListItem[];
  phase?: ShiftVolunteeringPhase;
  actionLabels?: VolunteeringActionLabels;
  accessibleActionLabels?: VolunteeringActionLabels;
  onAction?: (volunteerId: string, action: VolunteeringActionLabel) => void;
  onStatusChange?: (volunteerId: string, value: string) => void;
}) {
  // An empty <ul> still announces "list, 0 items".
  if (volunteers.length === 0) {
    return null;
  }

  return (
    <ul className="list-none">
      {volunteers.map((volunteer) => (
        <VolunteeringVolunteerRow
          key={volunteer.id}
          name={volunteer.name}
          image={volunteer.image}
          state={volunteer.state}
          phase={phase}
          completedDuration={volunteer.completedDuration}
          statusLabel={volunteer.statusLabel}
          statusTooltip={volunteer.statusTooltip}
          statusOptions={volunteer.statusOptions}
          statusMenuAriaLabel={volunteer.statusMenuAriaLabel}
          actions={volunteer.actions}
          disabledActions={volunteer.disabledActions}
          iconActions={volunteer.iconActions}
          busy={volunteer.busy}
          actionLabels={
            volunteer.actionLabels
              ? { ...actionLabels, ...volunteer.actionLabels }
              : actionLabels
          }
          accessibleActionLabels={
            volunteer.accessibleActionLabels
              ? {
                  ...accessibleActionLabels,
                  ...volunteer.accessibleActionLabels,
                }
              : accessibleActionLabels
          }
          onAction={
            onAction ? (action) => onAction(volunteer.id, action) : undefined
          }
          onStatusChange={
            onStatusChange
              ? (value) => onStatusChange(volunteer.id, value)
              : undefined
          }
        />
      ))}
    </ul>
  );
}

export function VolunteeringVolunteerList({
  volunteers,
  phase,
  title = 'Volunteers',
  titleBadge,
  headerAction,
  actionLabels,
  accessibleActionLabels,
  onAction,
  onStatusChange,
  className,
  groups,
}: VolunteeringVolunteerListProps) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      {/* grid-rows-[auto]: the unused second track costs an 8px row gap. */}
      <CardHeader className="grid-rows-[auto] border-b py-4">
        {/* Not CardAction: pinned to column 2, so it can't wrap below the title. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
            <span>{title}</span>
            {titleBadge}
          </CardTitle>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent className="px-6 py-0">
        {groups ? (
          <Accordion
            type="multiple"
            defaultValue={groups
              .filter((group) => group.defaultOpen !== false)
              .map((group) => group.key)}
          >
            {groups
              .filter((group) => group.volunteers.length > 0)
              .map((group) => (
                <AccordionItem
                  key={group.key}
                  value={group.key}
                  className="border-b last:border-b-0"
                >
                  <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <span>{group.label}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {group.volunteers.length}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <VolunteerRows
                      volunteers={group.volunteers}
                      phase={phase}
                      actionLabels={actionLabels}
                      accessibleActionLabels={accessibleActionLabels}
                      onAction={onAction}
                      onStatusChange={onStatusChange}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        ) : (
          <VolunteerRows
            volunteers={volunteers}
            phase={phase}
            actionLabels={actionLabels}
            accessibleActionLabels={accessibleActionLabels}
            onAction={onAction}
            onStatusChange={onStatusChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
