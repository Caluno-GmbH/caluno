import { describe, expect, it, mock } from 'bun:test';
import { TimesheetsExportCollector } from './timesheets-export.collector';

const baseEntry = {
  id: 'te-1',
  volunteerId: 'u1',
  createdById: null,
  shiftInstanceId: null,
  startedAt: new Date('2026-01-15T08:00:00.000Z'),
  endedAt: new Date('2026-01-15T09:30:00.000Z'),
  notes: null,
  checkOut: null,
};

const baseUser = {
  id: 'u1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  birthdate: '1990-05-20',
  gender: 'female',
  phone: '+49 123 456',
  street: 'Main St 1',
  zip: '20095',
  city: 'Hamburg',
};

function buildCollector(overrides?: {
  entries?: unknown[];
  users?: unknown[];
  instances?: unknown[];
  organizationUnit?: unknown;
}) {
  const entries = overrides?.entries ?? [baseEntry];
  const users = overrides?.users ?? [baseUser];
  const instances = overrides?.instances ?? [];
  const organizationUnit = overrides?.organizationUnit ?? {
    street: 'Org St 1',
    zipCode: '10115',
    city: 'Berlin',
  };

  const timeTrackingService = {
    findManyByIdsInUnits: mock(async () => entries),
  };
  const shiftService = {
    findInstancesByIds: mock(async () => instances),
  };
  const userService = {
    findByIds: mock(async () => users),
  };
  const organizationUnitDataService = {
    findById: mock(async () => organizationUnit),
  };

  const collector = new TimesheetsExportCollector(
    timeTrackingService as never,
    shiftService as never,
    userService as never,
    organizationUnitDataService as never,
  );

  return {
    collector,
    timeTrackingService,
    shiftService,
    userService,
    organizationUnitDataService,
  };
}

const ctx = {
  rowIds: ['te-1'],
  unitIds: ['unit-1'],
  organizationUnitId: 'unit-1',
};

describe('TimesheetsExportCollector', () => {
  it('emits basic volunteer columns', async () => {
    const { collector } = buildCollector();
    const result = await collector.collect(ctx);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.cells.volunteerName).toBe('Jane Doe');
    expect(result.rows[0]?.cells.volunteerEmail).toBe('jane@example.com');
  });

  it('emits extended volunteer columns from the loaded volunteer', async () => {
    const { collector } = buildCollector();
    const result = await collector.collect(ctx);
    const cells = result.rows[0]?.cells;
    expect(cells?.volunteerGender).toBe('female');
    expect(cells?.volunteerPhone).toBe('+49 123 456');
    expect(cells?.volunteerAddress).toBe('Main St 1, 20095 Hamburg');
    expect(cells?.volunteerDateOfBirth).toBe('20.05.1990');
  });

  it('maps absent extended fields to null/empty', async () => {
    const { collector } = buildCollector({
      users: [
        {
          id: 'u1',
          name: 'Bob',
          email: 'bob@example.com',
          birthdate: null,
          gender: null,
          phone: null,
          street: null,
          zip: null,
          city: null,
        },
      ],
    });
    const result = await collector.collect(ctx);
    const cells = result.rows[0]?.cells;
    expect(cells?.volunteerGender).toBeFalsy();
    expect(cells?.volunteerPhone).toBeFalsy();
    expect(cells?.volunteerAddress).toBeFalsy();
    expect(cells?.volunteerDateOfBirth).toBe('');
  });

  it('reports subjectUserIds correctly', async () => {
    const { collector } = buildCollector();
    const result = await collector.collect(ctx);
    expect(result.subjectUserIds).toEqual(['u1']);
  });

  it('falls back to the email when the volunteer has no name', async () => {
    const { collector } = buildCollector({
      users: [{ ...baseUser, name: null }],
    });

    const result = await collector.collect(ctx);

    expect(result.rows[0]?.cells.volunteerName).toBe('jane@example.com');
  });

  it('falls back to the email when the recorder has no name', async () => {
    const { collector } = buildCollector({
      entries: [{ ...baseEntry, createdById: 'u2' }],
      users: [
        baseUser,
        { ...baseUser, id: 'u2', name: null, email: 'admin@example.com' },
      ],
    });

    const result = await collector.collect(ctx);

    expect(result.rows[0]?.cells.createdBy).toBe('admin@example.com');
  });

  it('falls back to the organisation-unit address for a shiftless entry', async () => {
    const { collector, organizationUnitDataService } = buildCollector({
      organizationUnit: {
        street: 'Org St 1',
        zipCode: '10115',
        city: 'Berlin',
      },
    });

    const result = await collector.collect(ctx);

    expect(organizationUnitDataService.findById).toHaveBeenCalledWith('unit-1');
    expect(result.rows[0]?.cells.location).toBe('Org St 1, 10115 Berlin');
  });

  it('prefers the shift-instance location over the organisation-unit address', async () => {
    const { collector, organizationUnitDataService } = buildCollector({
      entries: [{ ...baseEntry, shiftInstanceId: 'si-1' }],
      instances: [
        {
          id: 'si-1',
          overrideLocation: 'Side hall',
          master: { location: 'Main hall' },
        },
      ],
    });

    const result = await collector.collect(ctx);

    expect(result.rows[0]?.cells.location).toBe('Side hall');
    expect(organizationUnitDataService.findById).not.toHaveBeenCalled();
  });
});
