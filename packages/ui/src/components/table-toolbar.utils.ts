import type { ReactNode } from 'react';

export type TableToolbarActiveFilter = {
  key: string;
  label: string;
  display: string;
  onClear: () => void;
};

const MAX_ACTIONS = 2;

/** Prefer side-by-side actions until filters would need more than this many wrap rows. */
export const MAX_FILTER_ROWS_WITH_INLINE_ACTIONS = 2;

/** Extra width (px) required before unstacking after a stack, to avoid flicker. */
export const ACTIONS_UNSTACK_HYSTERESIS_PX = 48;

export function clampActions(actions: ReactNode[] | undefined): ReactNode[] {
  if (!actions) return [];
  if (actions.length > MAX_ACTIONS && process.env.NODE_ENV !== 'production') {
    console.warn(
      `TableToolbar: actions slot accepts at most ${MAX_ACTIONS} buttons; received ${actions.length}. Extra actions are ignored.`,
    );
  }
  return actions.slice(0, MAX_ACTIONS);
}

export function hasActiveFilters(
  filters: TableToolbarActiveFilter[] | undefined,
): boolean {
  return (filters?.length ?? 0) > 0;
}

export function formatResultsLabel(count: number | undefined): string {
  if (count === undefined) return 'Show results';
  return `Show ${count} ${count === 1 ? 'result' : 'results'}`;
}

/** Count wrap rows from direct children's offsetTop (1px tolerance). */
export function countFlexWrapRows(container: HTMLElement): number {
  const children = Array.from(container.children) as HTMLElement[];
  if (children.length === 0) return 0;

  const tops = children.map((el) => el.offsetTop).sort((a, b) => a - b);
  let rows = 1;
  let currentTop = tops[0] ?? 0;
  for (const top of tops) {
    if (top - currentTop > 1) {
      rows += 1;
      currentTop = top;
    }
  }
  return rows;
}

/**
 * Stack action buttons when filters exceed two wrap rows; unstack only after
 * the toolbar grows past the width that forced the stack (plus hysteresis).
 */
export function nextActionsStackState(args: {
  stacked: boolean;
  filterRows: number;
  toolbarWidth: number;
  stackedAtWidth: number | null;
}): { stacked: boolean; stackedAtWidth: number | null } {
  const { stacked, filterRows, toolbarWidth, stackedAtWidth } = args;

  if (!stacked) {
    if (filterRows > MAX_FILTER_ROWS_WITH_INLINE_ACTIONS) {
      return { stacked: true, stackedAtWidth: toolbarWidth };
    }
    return { stacked: false, stackedAtWidth };
  }

  if (
    stackedAtWidth !== null &&
    toolbarWidth > stackedAtWidth + ACTIONS_UNSTACK_HYSTERESIS_PX
  ) {
    return { stacked: false, stackedAtWidth: null };
  }

  if (
    stackedAtWidth === null &&
    filterRows <= MAX_FILTER_ROWS_WITH_INLINE_ACTIONS
  ) {
    return { stacked: false, stackedAtWidth: null };
  }

  return { stacked: true, stackedAtWidth };
}
