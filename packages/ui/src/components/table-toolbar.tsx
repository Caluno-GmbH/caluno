import type { ReactNode } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
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
  clampActions,
  hasActiveFilters,
  type TableToolbarActiveFilter,
} from './table-toolbar.utils';

export type TableToolbarProps = {
  children: ReactNode;
  /** Up to two action buttons, stacked top-to-bottom; pass the primary action first. */
  actions?: ReactNode[];
  activeFilters?: TableToolbarActiveFilter[];
  onClearAll?: () => void;
  className?: string;
};

function TableToolbar({
  children,
  actions,
  activeFilters,
  onClearAll,
  className,
}: TableToolbarProps) {
  const clampedActions = clampActions(actions);
  const showFilters = hasActiveFilters(activeFilters);

  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        'sticky top-0 z-30 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm',
        className,
      )}
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

      {showFilters && (
        <div
          data-slot="table-toolbar-filters"
          className="flex flex-wrap items-center gap-2 border-t pt-2"
        >
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {activeFilters?.map((filter) => (
              <Badge key={filter.key} variant="neutral" className="max-w-full gap-1">
                <span className="text-muted-foreground">{filter.label}:</span>
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

function FilterSelect({ value, onChange, options, placeholder, ariaLabel }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel ?? placeholder} className="w-auto min-w-36">
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
      onChange={(start, end) => onChange({ from: start ?? undefined, to: end ?? undefined })}
      placeholder={placeholder}
    />
  );
}

TableToolbar.Search = Search;
TableToolbar.Select = FilterSelect;
TableToolbar.DateRange = DateRange;

export { TableToolbar };
export type { TableToolbarActiveFilter } from './table-toolbar.utils';
