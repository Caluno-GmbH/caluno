import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../base/accordion';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '../base/card';
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
  actionTooltips?: VolunteeringActionLabels;
  /** Far-right icon-only actions (e.g. View profile, Check in). */
  iconActions?: VolunteeringActionLabel[];
  actionLabels?: VolunteeringActionLabels;
};

export type VolunteeringVolunteerGroup = {
  /** Stable accordion value, e.g. "coming". */
  key: string;
  /** Localized section heading, e.g. "Coming". */
  label: string;
  volunteers: VolunteeringVolunteerListItem[];
  /** Sections default to open unless this is explicitly false. */
  defaultOpen?: boolean;
};

export type VolunteeringVolunteerListProps = {
  volunteers: VolunteeringVolunteerListItem[];
  phase?: ShiftVolunteeringPhase;
  /** Card title, defaults to "Volunteers". */
  title?: string;
  /** Rendered immediately after the title, e.g. a capacity badge. */
  titleBadge?: ReactNode;
  /** Optional action rendered in the card header (e.g. Invite button). */
  headerAction?: ReactNode;
  /** Localized button labels keyed by action id. */
  actionLabels?: VolunteeringActionLabels;
  onAction?: (volunteerId: string, action: VolunteeringActionLabel) => void;
  /** Chip dropdown selection: move volunteer to the chosen status value. */
  onStatusChange?: (volunteerId: string, value: string) => void;
  className?: string;
  /** When set, renders foldable sections instead of one flat list. */
  groups?: VolunteeringVolunteerGroup[];
};

function VolunteerRows({
  volunteers,
  phase,
  actionLabels,
  onAction,
  onStatusChange,
}: {
  volunteers: VolunteeringVolunteerListItem[];
  phase?: ShiftVolunteeringPhase;
  actionLabels?: VolunteeringActionLabels;
  onAction?: (volunteerId: string, action: VolunteeringActionLabel) => void;
  onStatusChange?: (volunteerId: string, value: string) => void;
}) {
  return (
    <>
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
          actionTooltips={volunteer.actionTooltips}
          iconActions={volunteer.iconActions}
          actionLabels={
            volunteer.actionLabels
              ? { ...actionLabels, ...volunteer.actionLabels }
              : actionLabels
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
    </>
  );
}

export function VolunteeringVolunteerList({
  volunteers,
  phase,
  title = 'Volunteers',
  titleBadge,
  headerAction,
  actionLabels,
  onAction,
  onStatusChange,
  className,
  groups,
}: VolunteeringVolunteerListProps) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardHeader className="border-b py-4">
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg">
          <span>{title}</span>
          {titleBadge}
        </CardTitle>
        {headerAction ? <CardAction>{headerAction}</CardAction> : null}
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
            onAction={onAction}
            onStatusChange={onStatusChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
