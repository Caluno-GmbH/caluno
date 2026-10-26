'use client';

import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useIsMobile } from '../hooks/use-mobile';
import { cn } from '../lib/utils';
import { Badge } from './base/badge';
import { Button } from './base/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './base/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './base/select';
import { DatePickerWithRange } from './date-picker';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet';
import {
  clampActions,
  formatResultsLabel,
  hasActiveFilters,
  type TableToolbarActiveFilter,
} from './table-toolbar.utils';

export type TableToolbarProps = {
  children: ReactNode;
  /** Up to two action buttons, stacked top-to-bottom; pass the primary action first. */
  actions?: ReactNode[];
  activeFilters?: TableToolbarActiveFilter[];
  onClearAll?: () => void;
  /** Result count shown on the mobile sheet's Save button ("Show X results"). Updates live. */
  resultCount?: number;
  /** Mobile filter sheet title. Defaults to "Filters". */
  sheetTitle?: string;
  className?: string;
};

const ISLAND_CLASSNAME =
  'sticky top-0 z-30 rounded-lg border bg-card p-3 shadow-sm';

function ActiveFilterChips({
  filters,
}: {
  filters: TableToolbarActiveFilter[];
}) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      {filters.map((filter) => (
        // Chip shows the selected value only (no "Label:" prefix); the filter
        // name stays in the clear button's aria-label for accessibility.
        <Badge key={filter.key} variant="neutral" className="max-w-full gap-1">
          <span className="truncate">{filter.display}</span>
          <button
            type="button"
            aria-label={`Clear ${filter.label} filter`}
            className="ml-0.5 rounded-sm hover:text-foreground"
            onClick={filter.onClear}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

function TableToolbar({
  children,
  actions,
  activeFilters,
  onClearAll,
  resultCount,
  sheetTitle = 'Filters',
  className,
}: TableToolbarProps) {
  const isMobile = useIsMobile();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const clampedActions = clampActions(actions);
  const showFilters = hasActiveFilters(activeFilters);

  if (isMobile) {
    const activeCount = activeFilters?.length ?? 0;

    return (
      <>
        <Button
          data-slot="table-toolbar-fab"
          className={cn(
            'fixed right-4 z-40 rounded-full shadow-lg',
            // Clear the fixed bottom CTA bar, whose height grows with the button count.
            clampedActions.length === 2
              ? 'bottom-32'
              : clampedActions.length === 1
                ? 'bottom-20'
                : 'bottom-4',
          )}
          onClick={() => setFilterSheetOpen(true)}
          aria-label="Open filters"
        >
          <SlidersHorizontalIcon />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="neutral"
              size="count"
              className="bg-background text-foreground"
            >
              {activeCount}
            </Badge>
          )}
        </Button>

        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div
              className={cn(
                'flex flex-1 flex-col gap-3 overflow-y-auto px-4',
                '[&_[data-slot=input-group]]:w-full',
                '[&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0',
              )}
            >
              {children}
            </div>
            <SheetFooter>
              <Button
                className="w-full"
                onClick={() => setFilterSheetOpen(false)}
              >
                {formatResultsLabel(resultCount)}
              </Button>
              {onClearAll && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onClearAll}
                >
                  Clear all
                </Button>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {clampedActions.length > 0 && (
          <div
            data-slot="table-toolbar-mobile-actions"
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch gap-2 border-t bg-background p-3"
          >
            {clampedActions}
          </div>
        )}
      </>
    );
  }

  return (
    <div
      data-slot="table-toolbar"
      className={cn('flex flex-col gap-2', ISLAND_CLASSNAME, className)}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2 [&_[data-slot=select-trigger]]:h-10">
          {children}
        </div>
        {clampedActions.length > 0 && (
          <>
            <div aria-hidden className="w-px self-stretch bg-border" />
            <div
              data-slot="table-toolbar-actions"
              className="flex flex-col items-stretch gap-2"
            >
              {clampedActions}
            </div>
          </>
        )}
      </div>

      {showFilters && activeFilters && (
        <div
          data-slot="table-toolbar-filters"
          className="flex flex-wrap items-center gap-2 border-t pt-2"
        >
          <ActiveFilterChips filters={activeFilters} />
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function Search({ value, onChange, placeholder }: SearchProps) {
  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupAddon align="inline-start">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        placeholder={placeholder}
        aria-label={placeholder ?? 'Search'}
        onChange={(event) => onChange(event.target.value)}
      />
      {value.length > 0 && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear search"
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange('')}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export type TableToolbarSelectOption = { label: string; value: string };

type FilterSelectProps = {
  value: string | undefined;
  onChange: (value: string) => void;
  options: TableToolbarSelectOption[];
  placeholder: string;
  ariaLabel?: string;
};

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className="w-auto min-w-36"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type TableToolbarDateRangeValue = { from?: Date; to?: Date };

type DateRangeProps = {
  value: TableToolbarDateRangeValue;
  onChange: (value: TableToolbarDateRangeValue) => void;
  placeholder?: string;
};

function DateRange({ value, onChange, placeholder }: DateRangeProps) {
  return (
    <DatePickerWithRange
      value={{ start: value.from ?? null, end: value.to ?? null }}
      onChange={(start, end) =>
        onChange({ from: start ?? undefined, to: end ?? undefined })
      }
      placeholder={placeholder}
    />
  );
}

TableToolbar.Search = Search;
TableToolbar.Select = FilterSelect;
TableToolbar.DateRange = DateRange;

export type { TableToolbarActiveFilter } from './table-toolbar.utils';
export { TableToolbar };
