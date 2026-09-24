import { cn } from '../../lib/utils';
import { Button } from '../base/button';
import { volunteeringActionIcons } from './config';
import type { VolunteeringActionLabel } from './types';

export type VolunteeringActionLabels = Partial<
  Record<VolunteeringActionLabel, string>
>;

/** Pure so the visible-vs-accessible-text split can be unit tested without rendering. */
export type ActionButtonContent =
  | { kind: 'plain'; text: string }
  | { kind: 'accessible'; visibleText: string; accessibleText: string };

export function resolveActionButtonContent(
  visibleLabel: string,
  accessibleLabel: string | undefined,
): ActionButtonContent {
  return accessibleLabel
    ? {
        kind: 'accessible',
        visibleText: visibleLabel,
        accessibleText: accessibleLabel,
      }
    : { kind: 'plain', text: visibleLabel };
}

export type VolunteeringActionButtonsProps = {
  actions: VolunteeringActionLabel[];
  /** Localized button labels keyed by action id (defaults to English labels). */
  labels?: VolunteeringActionLabels;
  /** Announced instead of the visible label, so word order stays natural per locale. */
  accessibleLabels?: VolunteeringActionLabels;
  disabledActions?: VolunteeringActionLabel[];
  onAction?: (action: VolunteeringActionLabel) => void;
  className?: string;
};

export function VolunteeringActionButtons({
  actions,
  labels,
  accessibleLabels,
  disabledActions,
  onAction,
  className,
}: VolunteeringActionButtonsProps) {
  if (actions.length === 0) return null;

  return (
    <div
      className={cn('flex shrink-0 flex-wrap items-center gap-2', className)}
    >
      {actions.map((actionLabel) => {
        const ActionIcon = volunteeringActionIcons[actionLabel];
        const content = resolveActionButtonContent(
          labels?.[actionLabel] ?? actionLabel,
          accessibleLabels?.[actionLabel],
        );

        return (
          <Button
            key={actionLabel}
            type="button"
            variant="outline"
            size="md"
            disabled={disabledActions?.includes(actionLabel)}
            onClick={() => onAction?.(actionLabel)}
          >
            {ActionIcon ? <ActionIcon aria-hidden /> : null}
            {content.kind === 'accessible' ? (
              <>
                <span aria-hidden="true">{content.visibleText}</span>
                <span className="sr-only">{content.accessibleText}</span>
              </>
            ) : (
              content.text
            )}
          </Button>
        );
      })}
    </div>
  );
}
