import { describe, expect, it } from 'bun:test';
import {
  SHIFT_COLUMNS,
  type ShiftExportRow,
  serializeShiftExport,
} from './shifts-export.serializer';
import {
  serializeTimesheetExport,
  TIMESHEET_COLUMNS,
  type TimesheetExportRow,
} from './timesheets-export.serializer';
import {
  serializeUserExport,
  USER_COLUMNS,
  type UserExportRow,
} from './users-export.serializer';

// Berlin UTC+1 in winter; this date is 2024-01-15 10:30 UTC = 11:30 Berlin
const BERLIN_DATE = new Date('2024-01-15T10:30:00.000Z');

describe('serializeTimesheetExport', () => {
  const baseRow: TimesheetExportRow = {
    id: 'ts-1',
    volunteerName: 'Jane Doe',
    volunteerEmail: 'jane@example.com',
    volunteerDateOfBirth: BERLIN_DATE,
    volunteerGender: 'female',
    volunteerPhone: '+49170000',
    volunteerAddress: 'Hauptstr. 1, 20095 Hamburg',
    shift: 'Morning Shift',
    assignment: 'Reception',
    location: 'Main Hall',
    startedAt: BERLIN_DATE,
    endedAt: null,
    durationMinutes: 90,
    status: 'confirmed',
    createdBy: 'Admin',
    notes: 'Some notes',
  };

  it('includes only selected columns in canonical order', () => {
    const csv = serializeTimesheetExport(
      [baseRow],
      ['shift', 'volunteerName', 'status'],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Volunteer Name,Shift,Status');
    expect(lines[1]).toBe('Jane Doe,Morning Shift,confirmed');
  });

  it('appends the ID column when includeTechnicalIds is true', () => {
    const csv = serializeTimesheetExport([baseRow], ['volunteerName'], true);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Volunteer Name,ID');
    expect(lines[1]).toBe('Jane Doe,ts-1');
  });

  it('formats startedAt in Berlin time', () => {
    const csv = serializeTimesheetExport([baseRow], ['startedAt'], false);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Started At');
    // 10:30 UTC → 11:30 Berlin (UTC+1)
    expect(lines[1]).toBe('15.01.2024 11:30');
  });

  it('exports all canonical columns when all column ids are provided', () => {
    const csv = serializeTimesheetExport([baseRow], TIMESHEET_COLUMNS, false);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(
      'Volunteer Name,Volunteer Email,Volunteer Date of Birth,Volunteer Gender,Volunteer Phone,Volunteer Address,Shift,Assignment,Location,Started At,Ended At,Duration (min),Status,Created By,Notes',
    );
  });

  it('renders selected volunteer profile columns with Volunteer-prefixed labels', () => {
    const csv = serializeTimesheetExport(
      [baseRow],
      [
        'volunteerName',
        'volunteerDateOfBirth',
        'volunteerGender',
        'volunteerPhone',
        'volunteerAddress',
      ],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(
      'Volunteer Name,Volunteer Date of Birth,Volunteer Gender,Volunteer Phone,Volunteer Address',
    );
    // DOB is date-only (no wall-clock time), phone guarded against formula injection
    expect(lines[1]).toBe(
      'Jane Doe,15.01.2024,female,\'+49170000,"Hauptstr. 1, 20095 Hamburg"',
    );
  });

  it('renders empty cells for a volunteer with no profile data', () => {
    const row = {
      ...baseRow,
      volunteerDateOfBirth: null,
      volunteerGender: null,
      volunteerPhone: null,
      volunteerAddress: null,
    };
    const csv = serializeTimesheetExport(
      [row],
      ['volunteerDateOfBirth', 'volunteerPhone', 'volunteerAddress'],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[1]).toBe(',,');
  });
});

describe('serializeUserExport', () => {
  const baseRow: UserExportRow = {
    userId: 'u-1',
    name: 'John Smith',
    email: 'john@example.com',
    roles: ['admin', 'member'],
    dateOfBirth: BERLIN_DATE,
    gender: 'male',
    phone: '+49123456',
    address: 'Some Street 1',
  };

  it('always includes name/email/roles and adds optional columns when selected', () => {
    const csv = serializeUserExport(
      [baseRow],
      ['name', 'email', 'roles', 'phone'],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Name,Email,Roles,Phone');
    // csvCell prefixes '+' with "'" to prevent formula injection
    expect(lines[1]).toBe(
      "John Smith,john@example.com,admin; member,'+49123456",
    );
  });

  it('omits DOB/address unless selected', () => {
    const csv = serializeUserExport(
      [baseRow],
      ['name', 'email', 'roles'],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).not.toContain('Date of Birth');
    expect(lines[0]).not.toContain('Address');
    expect(lines[0]).toBe('Name,Email,Roles');
  });

  it('includes dateOfBirth as a date-only value when selected', () => {
    const csv = serializeUserExport(
      [baseRow],
      ['name', 'email', 'roles', 'dateOfBirth'],
      false,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toContain('Date of Birth');
    expect(lines[1]).toContain('15.01.2024');
    expect(lines[1]).not.toContain('15.01.2024 ');
  });

  it('appends userId column when includeTechnicalIds is true', () => {
    const csv = serializeUserExport(
      [baseRow],
      ['name', 'email', 'roles'],
      true,
    );
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Name,Email,Roles,User ID');
    expect(lines[1]).toContain('u-1');
  });

  it('exports all canonical columns when all column ids are provided', () => {
    const csv = serializeUserExport([baseRow], USER_COLUMNS, false);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(
      'Name,Email,Roles,Date of Birth,Gender,Phone,Address',
    );
  });
});

describe('serializeShiftExport', () => {
  const baseRow: ShiftExportRow = {
    id: 'sh-1',
    title: 'Afternoon Shift',
    date: BERLIN_DATE,
    location: 'Room B',
    visibility: 'public',
    staffing: '3/5',
  };

  it('serializes the default shift columns', () => {
    const csv = serializeShiftExport([baseRow], SHIFT_COLUMNS, false);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Title,Date,Location,Visibility,Staffing');
    expect(lines[1]).toBe('Afternoon Shift,15.01.2024 11:30,Room B,public,3/5');
  });

  it('includes only selected columns in canonical order', () => {
    const csv = serializeShiftExport([baseRow], ['date', 'title'], false);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Title,Date');
    expect(lines[1]).toBe('Afternoon Shift,15.01.2024 11:30');
  });

  it('appends the ID column when includeTechnicalIds is true', () => {
    const csv = serializeShiftExport([baseRow], ['title'], true);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('Title,ID');
    expect(lines[1]).toBe('Afternoon Shift,sh-1');
  });
});
