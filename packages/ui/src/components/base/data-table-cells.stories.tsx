import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AlertTriangle,
  ArrowUpDown,
  Edit,
  ListFilter,
  MoreHorizontal,
  Trash2,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/base/badge';
import { Button } from '@/components/base/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/base/table';

import {
  ActionsCell,
  EntityCell,
  NumberCell,
  StatusCell,
  TextCell,
} from './data-table-cells';

const meta = {
  title: 'ui/radix/DataTableCells',
  component: EntityCell,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Sample',
  },
} satisfies Meta<typeof EntityCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EntityWithAvatar: Story = {
  render: () => (
    <EntityCell
      avatar={{ alt: 'Sample Volunteer', fallback: 'SV' }}
      title="Sample Volunteer"
      subtitle="a@example.com"
    />
  ),
};

export const EntityWithIconAndTrailing: Story = {
  render: () => (
    <EntityCell
      icon={Users}
      title="Morning Shift"
      subtitle="08:00 – 12:00"
      trailing={<AlertTriangle className="text-alert" />}
    />
  ),
};

export const Text: Story = {
  render: () => <TextCell>Participant</TextCell>,
};

export const TextLongAddressWraps: Story = {
  render: () => (
    <div className="w-64 border p-2">
      <TextCell>
        Musterstraße 47, 3. Hinterhof links, 10115 Berlin-Mitte, Deutschland
      </TextCell>
    </div>
  ),
};

export const StatusWithBadge: Story = {
  render: () => (
    <StatusCell>
      <Badge variant="success">Confirmed</Badge>
    </StatusCell>
  ),
};

export const StatusWithBadgeAndTrailing: Story = {
  render: () => (
    <StatusCell trailing={<AlertTriangle className="text-alert" />}>
      <Badge variant="alert">Pending</Badge>
    </StatusCell>
  ),
};

export const Number: Story = {
  render: () => <NumberCell>42</NumberCell>,
};

export const Actions: Story = {
  render: () => (
    <ActionsCell>
      <Button variant="outline" size="icon-sm" tooltip="Edit">
        <Edit />
      </Button>
      <Button variant="outline" size="icon-sm" tooltip="Delete">
        <Trash2 />
      </Button>
      <Button variant="outline" size="icon-sm" tooltip="More">
        <MoreHorizontal />
      </Button>
    </ActionsCell>
  ),
};

const rows = [
  {
    id: '1',
    name: 'Sample Volunteer',
    email: 'a@example.com',
    shift: 'Morning Shift',
    hours: 8,
    status: 'Confirmed' as const,
  },
  {
    id: '2',
    name: 'Another Person',
    email: 'b@example.com',
    shift: 'Evening Shift',
    hours: 4,
    status: 'Pending' as const,
  },
  {
    id: '3',
    name: 'Third Volunteer',
    email: 'c@example.com',
    shift: 'Weekend Duty',
    hours: 12,
    status: 'Confirmed' as const,
  },
];

const statusVariant = {
  Confirmed: 'success',
  Pending: 'alert',
} as const;

export const CombinedTable: Story = {
  render: () => (
    <div className="w-[700px]">
      <Table>
        <TableHeader>
          <TableRow>
            {[
              { label: 'Volunteer', sortable: true, filterable: true },
              { label: 'Shift', sortable: true, filterable: true },
              { label: 'Hours', sortable: true, filterable: false },
              { label: 'Status', sortable: false, filterable: true },
              { label: '', sortable: false, filterable: false },
            ].map((col) => (
              <TableHead
                key={col.label || 'actions'}
                className="bg-muted h-8 px-2 text-xs text-muted-foreground font-normal [&:not(:last-child)]:border-r border-border"
              >
                <div className="flex items-center gap-1">
                  <span className="truncate min-w-0">{col.label}</span>
                  {(col.sortable || col.filterable) && (
                    <span className="ml-auto flex items-center">
                      {col.sortable && (
                        <Button variant="ghost" size="icon-sm" tooltip="Sort">
                          <ArrowUpDown />
                        </Button>
                      )}
                      {col.filterable && (
                        <Button variant="ghost" size="icon-sm" tooltip="Filter">
                          <ListFilter />
                        </Button>
                      )}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="py-2 px-3 border-r border-border">
                <EntityCell
                  avatar={{
                    alt: row.name,
                    fallback: row.name.slice(0, 2).toUpperCase(),
                  }}
                  title={row.name}
                  subtitle={row.email}
                />
              </TableCell>
              <TableCell className="py-2 px-3 border-r border-border">
                <TextCell>{row.shift}</TextCell>
              </TableCell>
              <TableCell className="py-2 px-3 border-r border-border">
                <NumberCell>{row.hours}</NumberCell>
              </TableCell>
              <TableCell className="py-2 px-3 border-r border-border">
                <StatusCell>
                  <Badge variant={statusVariant[row.status]}>
                    {row.status}
                  </Badge>
                </StatusCell>
              </TableCell>
              <TableCell className="py-2 px-3">
                <ActionsCell>
                  <Button variant="outline" size="icon-sm" tooltip="Edit">
                    <Edit />
                  </Button>
                  <Button variant="outline" size="icon-sm" tooltip="Delete">
                    <Trash2 />
                  </Button>
                </ActionsCell>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
