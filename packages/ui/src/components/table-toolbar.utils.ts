import type { ReactNode } from 'react';

export type TableToolbarActiveFilter = {
  key: string;
  label: string;
  display: string;
  onClear: () => void;
};

const MAX_ACTIONS = 2;

export function clampActions(actions: ReactNode[] | undefined): ReactNode[] {
  if (!actions) return [];
  if (actions.length > MAX_ACTIONS && process.env.NODE_ENV !== 'production') {
    console.warn(
      `TableToolbar: actions slot accepts at most ${MAX_ACTIONS} buttons; received ${actions.length}. Extra actions are ignored.`,
    );
  }
  return actions.slice(0, MAX_ACTIONS);
}

export function hasActiveFilters(filters: TableToolbarActiveFilter[] | undefined): boolean {
  return (filters?.length ?? 0) > 0;
}
