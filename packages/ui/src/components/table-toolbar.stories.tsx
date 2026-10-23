import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Button } from '@/components/base/button';
import {
  TableToolbar,
  type TableToolbarActiveFilter,
} from '@/components/table-toolbar';

const meta: Meta<typeof TableToolbar> = {
  title: 'ui/TableToolbar',
  component: TableToolbar,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof meta>;

const LOCATION_OPTIONS = [
  { label: 'Hall A', value: 'hall-a' },
  { label: 'Hall B', value: 'hall-b' },
];
const VISIBILITY_OPTIONS = [
  { label: 'All members', value: 'ALL_MEMBERS' },
  { label: 'Restricted', value: 'RESTRICTED' },
];
const FILL_OPTIONS = [
  { label: 'Below min', value: 'below' },
  { label: 'OK', value: 'ok' },
  { label: 'Full', value: 'full' },
];

function labelFor(options: { label: string; value: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDateRange(range: { from?: Date; to?: Date }): string | undefined {
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
  if (range.from) return `From ${fmt(range.from)}`;
  if (range.to) return `Until ${fmt(range.to)}`;
  return undefined;
}

/** Shell with placeholder controls and no actions/filters — single row. */
export const Default: Story = {
  render: () => (
    <TableToolbar>
      <div className="h-9 w-64 rounded-md border bg-muted" />
      <div className="h-9 w-36 rounded-md border bg-muted" />
    </TableToolbar>
  ),
};

/** Search control with a clear affordance. */
export const WithSearch: Story = {
  render: () => {
    const [q, setQ] = useState('');
    return (
      <TableToolbar>
        <TableToolbar.Search value={q} onChange={setQ} placeholder="Search name or location" />
      </TableToolbar>
    );
  },
};

export const ShouldClearSearch: Story = {
  name: 'when clear is clicked, search empties',
  tags: ['!dev', '!autodocs'],
  render: () => {
    const [q, setQ] = useState('cleanup');
    return (
      <TableToolbar>
        <TableToolbar.Search value={q} onChange={setQ} placeholder="Search name or location" />
      </TableToolbar>
    );
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /clear search/i }));
    await waitFor(() =>
      expect(canvas.getByLabelText(/search name or location/i)).toHaveValue(''),
    );
  },
};

/** All filter controls composed together. */
export const AllControls: Story = {
  render: () => {
    const [q, setQ] = useState('');
    const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
    const [location, setLocation] = useState<string>();
    const [visibility, setVisibility] = useState<string>();
    const [fill, setFill] = useState<string>();
    return (
      <TableToolbar>
        <TableToolbar.Search value={q} onChange={setQ} placeholder="Search name or location" />
        <TableToolbar.DateRange value={range} onChange={setRange} placeholder="Date range" />
        <TableToolbar.Select
          value={location}
          onChange={setLocation}
          placeholder="Location"
          options={LOCATION_OPTIONS}
        />
        <TableToolbar.Select
          value={visibility}
          onChange={setVisibility}
          placeholder="Visibility"
          options={VISIBILITY_OPTIONS}
        />
        <TableToolbar.Select
          value={fill}
          onChange={setFill}
          placeholder="Fill status"
          options={FILL_OPTIONS}
        />
      </TableToolbar>
    );
  },
};

/**
 * The full component in a realistic loaded state: search filled, a date range and
 * every filter selected (reflected as clearable chips), plus two primary actions.
 */
export const FullyLoaded: Story = {
  render: function FullyLoadedStory() {
    const [q, setQ] = useState('cleanup');
    const [range, setRange] = useState<{ from?: Date; to?: Date }>({
      from: new Date(2026, 10, 1),
      to: new Date(2026, 10, 30),
    });
    const [location, setLocation] = useState<string | undefined>('hall-a');
    const [visibility, setVisibility] = useState<string | undefined>('ALL_MEMBERS');
    const [fill, setFill] = useState<string | undefined>('below');

    const rangeDisplay = formatDateRange(range);
    const activeFilters: TableToolbarActiveFilter[] = [
      q ? { key: 'q', label: 'Search', display: q, onClear: () => setQ('') } : null,
      rangeDisplay
        ? { key: 'range', label: 'Dates', display: rangeDisplay, onClear: () => setRange({}) }
        : null,
      location
        ? {
            key: 'location',
            label: 'Location',
            display: labelFor(LOCATION_OPTIONS, location),
            onClear: () => setLocation(undefined),
          }
        : null,
      visibility
        ? {
            key: 'visibility',
            label: 'Visibility',
            display: labelFor(VISIBILITY_OPTIONS, visibility),
            onClear: () => setVisibility(undefined),
          }
        : null,
      fill
        ? {
            key: 'fill',
            label: 'Fill status',
            display: labelFor(FILL_OPTIONS, fill),
            onClear: () => setFill(undefined),
          }
        : null,
    ].filter((filter): filter is TableToolbarActiveFilter => filter !== null);

    const clearAll = () => {
      setQ('');
      setRange({});
      setLocation(undefined);
      setVisibility(undefined);
      setFill(undefined);
    };

    return (
      <TableToolbar
        activeFilters={activeFilters}
        onClearAll={activeFilters.length > 0 ? clearAll : undefined}
        actions={[
          <Button key="new">New shift</Button>,
          <Button key="import" variant="outline">
            Import
          </Button>,
        ]}
      >
        <TableToolbar.Search value={q} onChange={setQ} placeholder="Search name or location" />
        <TableToolbar.DateRange value={range} onChange={setRange} placeholder="Date range" />
        <TableToolbar.Select
          value={location}
          onChange={setLocation}
          placeholder="Location"
          options={LOCATION_OPTIONS}
        />
        <TableToolbar.Select
          value={visibility}
          onChange={setVisibility}
          placeholder="Visibility"
          options={VISIBILITY_OPTIONS}
        />
        <TableToolbar.Select
          value={fill}
          onChange={setFill}
          placeholder="Fill status"
          options={FILL_OPTIONS}
        />
      </TableToolbar>
    );
  },
};

function FiltersHarness({ withClearAll }: { withClearAll: boolean }) {
  const [filters, setFilters] = useState<Record<string, string>>({
    location: 'Hall A',
    fill: 'Below min',
  });
  const activeFilters: TableToolbarActiveFilter[] = Object.entries(filters).map(([key, value]) => ({
    key,
    label: key === 'location' ? 'Location' : 'Fill status',
    display: value,
    onClear: () =>
      setFilters((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      }),
  }));
  return (
    <TableToolbar
      activeFilters={activeFilters}
      onClearAll={withClearAll ? () => setFilters({}) : undefined}
    >
      <div className="h-9 w-64 rounded-md border bg-muted" />
    </TableToolbar>
  );
}

/** Active filters render as chips with a Clear all action. */
export const FiltersActive: Story = {
  render: () => <FiltersHarness withClearAll />,
};

export const ShouldClearSingleFilter: Story = {
  name: 'clicking a chip clear removes just that filter',
  tags: ['!dev', '!autodocs'],
  render: () => <FiltersHarness withClearAll />,
  play: async ({ canvas, step }) => {
    await step('clear the Location chip', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /clear location filter/i }));
      await waitFor(() => expect(canvas.queryByText('Hall A')).not.toBeInTheDocument());
    });
    await step('Fill status chip remains', async () => {
      expect(canvas.getByText('Below min')).toBeInTheDocument();
    });
  },
};

export const FiltersActiveWithoutClearAll: Story = {
  name: 'chips stay clearable when no Clear all is provided',
  tags: ['!dev', '!autodocs'],
  render: () => <FiltersHarness withClearAll={false} />,
  play: async ({ canvas }) => {
    expect(canvas.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /clear location filter/i }));
    await waitFor(() => expect(canvas.queryByText('Hall A')).not.toBeInTheDocument());
  },
};

/** A single primary action, right-aligned. */
export const WithOneAction: Story = {
  render: () => (
    <TableToolbar actions={[<Button key="new">New shift</Button>]}>
      <div className="h-9 w-64 rounded-md border bg-muted" />
    </TableToolbar>
  ),
};

/** Two primary actions. */
export const WithTwoActions: Story = {
  render: () => (
    <TableToolbar
      actions={[
        <Button key="new">New shift</Button>,
        <Button key="import" variant="outline">
          Import
        </Button>,
      ]}
    >
      <div className="h-9 w-64 rounded-md border bg-muted" />
    </TableToolbar>
  ),
};

export const ShouldCapActionsAtTwo: Story = {
  name: 'only the first two actions render',
  tags: ['!dev', '!autodocs'],
  render: () => (
    <TableToolbar
      actions={[
        <Button key="a">A</Button>,
        <Button key="b">B</Button>,
        <Button key="c">C</Button>,
      ]}
    >
      <div className="h-9 w-64 rounded-md border bg-muted" />
    </TableToolbar>
  ),
  play: async ({ canvas }) => {
    expect(canvas.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'B' })).toBeInTheDocument();
    expect(canvas.queryByRole('button', { name: 'C' })).not.toBeInTheDocument();
  },
};

/** Controls wrap on narrow widths without overflow. */
export const NarrowWrapping: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <div className="w-80">
      <TableToolbar actions={[<Button key="new">New shift</Button>]}>
        <div className="h-9 w-64 rounded-md border bg-muted" />
        <div className="h-9 w-36 rounded-md border bg-muted" />
        <div className="h-9 w-36 rounded-md border bg-muted" />
      </TableToolbar>
    </div>
  ),
};
