'use client';

import { Button, cn } from '@repo/ui';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

const contentFade =
  '[mask-image:linear-gradient(to_bottom,black_0,black_calc(100%-2rem),transparent_100%)]';

interface PageActionsProps {
  /** Scrolling page content. The fade above the buttons belongs to this component. */
  children: ReactNode;
  /** Status or warning shown above the buttons. */
  notice?: ReactNode;
  contentClassName?: string;
  /** When set, this component owns the scroll region. */
  scrollLabel?: string;
  showActions?: boolean;
  saveLabel: string;
  onSave: () => void;
  saveDisabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  cancelHref?: string;
  cancelDisabled?: boolean;
}

export function PageActions({
  children,
  notice,
  contentClassName,
  scrollLabel,
  showActions = true,
  saveLabel,
  onSave,
  saveDisabled = false,
  cancelLabel,
  onCancel,
  cancelHref,
  cancelDisabled = false,
}: PageActionsProps) {
  const content = scrollLabel ? (
    <section
      className={cn(
        'min-h-0 flex-1 overflow-y-auto',
        showActions && `pb-12 ${contentFade}`,
        contentClassName,
      )}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 requires this independently-scrollable region to be keyboard-reachable (axe "scrollable-region-focusable").
      tabIndex={0}
      aria-label={scrollLabel}
    >
      {children}
    </section>
  ) : (
    <div
      className={cn(
        'min-h-0 flex-1',
        showActions && contentFade,
        contentClassName,
      )}
    >
      {children}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {content}
      {showActions && (
        <div className="flex shrink-0 flex-col items-end gap-3">
          {notice}
          <div className="flex items-center gap-2">
            {cancelLabel && cancelHref ? (
              <Button type="button" variant="outline" asChild>
                <Link href={cancelHref}>{cancelLabel}</Link>
              </Button>
            ) : cancelLabel && onCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={cancelDisabled}
              >
                {cancelLabel}
              </Button>
            ) : null}
            <Button type="button" onClick={onSave} disabled={saveDisabled}>
              {saveLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
