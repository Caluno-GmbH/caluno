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
}) {
  const entries = overrides?.entries ?? [baseEntry];
  const users = overrides?.users ?? [baseUser];
  const instances = overrides?.instances ?? [];

  const timeTrackingService = {
    findManyByIdsInUnits: mock(async () => entries),
  };
  const shiftService = {
    findInstancesByIds: mock(async () => instances),
  };
  const userService = {
    findByIds: mock(async () => users),
  };

  const collector = new TimesheetsExportCollector(
    timeTrackingService as never,
    shiftService as never,
    userService as never,
  );

  return { collector, timeTrackingService, shiftService, userService };
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
    expect(typeof cells?.volunteerDateOfBirth).toBe('string');
    expect(cells?.volunteerDateOfBirth).toMatch(/\d{2}\.\d{2}\.\d{4}/);
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
});
