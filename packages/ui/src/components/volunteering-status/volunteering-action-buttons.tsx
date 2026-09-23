import { cn } from '../../lib/utils';
import { Button } from '../base/button';
import { volunteeringActionIcons } from './config';
import type { VolunteeringActionLabel } from './types';

export type VolunteeringActionLabels = Partial<
  Record<VolunteeringActionLabel, string>
>;

/**
 * What a single action button should render: either the plain visible
 * label (no accessible label configured), or a visible label hidden from
 * assistive tech alongside the full accessible phrase read instead. Kept
 * as a pure function so the "does the name leak into the visible text"
 * decision can be unit tested without rendering the component.
 */
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
  /**
   * Full accessible phrase keyed by action id (e.g. "Jo Fischer einchecken"),
   * used only when the visible label alone would not identify which
   * volunteer the button acts on. When set for an action, the visible label
   * is hidden from assistive tech and this phrase is exposed instead via a
   * sr-only span, preserving natural word order in every locale.
   */
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
