import { describe, expect, it, mock } from 'bun:test';
import { ShiftsExportCollector } from './shifts-export.collector';

const master = {
  id: 'shift-1',
  title: 'Morning shift',
  location: 'Main hall',
  visibility: 'PUBLIC',
  maxVolunteers: 5,
  originalStartsAt: new Date('2026-01-01T08:00:00.000Z'),
};

const instance = {
  id: 'instance-1',
  masterId: 'shift-1',
  actualStartsAt: new Date('2026-01-15T08:00:00.000Z'),
  actualEndsAt: new Date('2026-01-15T10:00:00.000Z'),
  overrideTitle: null,
  overrideLocation: null,
  overrideMaxVolunteers: null,
  isCancelled: false,
  master,
};

const invites = [
  { instanceId: 'instance-1', userId: 'u1' },
  { instanceId: 'instance-1', userId: 'u2' },
];

function buildCollector(overrides?: {
  instances?: unknown[];
  invites?: unknown[];
}) {
  const instances = overrides?.instances ?? [instance];
  const inviteRows = overrides?.invites ?? invites;
  const instancesById = new Map<string, unknown>(
    instances
      .filter((row): row is { id: string } => Boolean(row))
      .map((row) => [row.id, row] as const),
  );

  const shiftService = {
    findInstancesByIds: mock(async (ids: string[]) =>
      ids.map((id) => instancesById.get(id) ?? null),
    ),
    findInstanceInvitesByInstanceIds: mock(async () => inviteRows),
  };

  const collector = new ShiftsExportCollector(shiftService as never);

  return { collector, shiftService };
}

const ctx = {
  rowIds: ['instance-1'],
  unitIds: ['unit-1'],
  organizationUnitId: 'unit-1',
};

describe('ShiftsExportCollector', () => {
  it('exports one row per requested occurrence id', async () => {
    const { collector, shiftService } = buildCollector();

    const result = await collector.collect(ctx);

    expect(shiftService.findInstancesByIds).toHaveBeenCalledWith(
      ['instance-1'],
      ['unit-1'],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.technicalId).toBe('instance-1');
    expect(result.rows[0]?.cells).toEqual({
      title: 'Morning shift',
      date: '15.01.2026 09:00',
      location: 'Main hall',
      visibility: 'PUBLIC',
      staffing: '2/5',
    });
  });

  it('uses the occurrence overrides when present', async () => {
    const { collector } = buildCollector({
      instances: [
        {
          ...instance,
          overrideTitle: 'Special morning',
          overrideLocation: 'Side hall',
          overrideMaxVolunteers: 2,
        },
      ],
      invites: [{ instanceId: 'instance-1', userId: 'u1' }],
    });

    const result = await collector.collect(ctx);

    expect(result.rows[0]?.cells.title).toBe('Special morning');
    expect(result.rows[0]?.cells.location).toBe('Side hall');
    expect(result.rows[0]?.cells.staffing).toBe('1/2');
  });

  it('keeps request order and drops occurrences outside the unit tree', async () => {
    const second = {
      ...instance,
      id: 'instance-2',
      actualStartsAt: new Date('2026-02-01T08:00:00.000Z'),
    };
    const { collector } = buildCollector({
      instances: [instance, second],
      invites: [],
    });

    const result = await collector.collect({
      ...ctx,
      rowIds: ['instance-2', 'missing-id', 'instance-1', 'instance-2'],
    });

    expect(result.rows.map((row) => row.technicalId)).toEqual([
      'instance-2',
      'instance-1',
      'instance-2',
    ]);
  });

  it('reports participating invitees as subject user ids', async () => {
    const { collector } = buildCollector();

    const result = await collector.collect(ctx);

    expect(result.subjectUserIds).toEqual(['u1', 'u2']);
  });

  it('does not query invites when no occurrences survive scoping', async () => {
    const { collector, shiftService } = buildCollector({
      instances: [null],
    });

    const result = await collector.collect(ctx);

    expect(result.rows).toEqual([]);
    expect(
      shiftService.findInstanceInvitesByInstanceIds,
    ).not.toHaveBeenCalled();
  });
});
