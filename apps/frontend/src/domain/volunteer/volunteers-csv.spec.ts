import { describe, expect, it } from 'bun:test';
import {
  serializeVolunteersToCsv,
  type VolunteerCsvColumnId,
} from './volunteers-csv';

const NOW = new Date('2026-11-04T00:00:00Z');
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const roleLabel = (role: { name: string }) =>
  role.name === 'Member' ? 'Mitglied' : role.name;

const ALL_COLUMNS: VolunteerCsvColumnId[] = [
  'name',
  'email',
  'roles',
  'dateOfBirth',
  'gender',
  'phone',
  'address',
];

const HEADERS: Record<VolunteerCsvColumnId, string> = {
  name: 'Name',
  email: 'E-Mail',
  roles: 'Rollen',
  dateOfBirth: 'Geburtsdatum',
  gender: 'Geschlecht',
  phone: 'Telefon',
  address: 'Adresse',
};

const fullRow = {
  user: {
    name: 'Anna Schmidt',
    email: 'anna@example.org',
    preferredName: null,
    birthdate: '1990-06-15',
    gender: 'female',
    phone: '+49 123 456',
    street: 'Hauptstraße 1',
    zip: '20099',
    city: 'Hamburg',
  },
  roles: [{ name: 'Member' }, { name: 'Stage Crew' }],
};

const nullRow = {
  user: {
    name: 'Bob Null',
    email: 'bob@example.org',
    preferredName: null,
    birthdate: null,
    gender: null,
    phone: null,
    street: null,
    zip: null,
    city: null,
  },
  roles: [],
};

describe('serializeVolunteersToCsv', () => {
  it('header row lists exactly the requested columns in the given order', () => {
    const csv = serializeVolunteersToCsv(
      [],
      ['name', 'email'],
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Name","E-Mail"');
  });

  it('renders a fully-populated row with expected values', () => {
    const csv = serializeVolunteersToCsv(
      [fullRow],
      ALL_COLUMNS,
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    // age: born 1990-06-15, now 2026-11-04 → 36
    expect(lines[1]).toBe(
      `"Anna Schmidt","anna@example.org","Mitglied, Stage Crew","1990-06-15 · 36","female","'+49 123 456","Hauptstraße 1, 20099 Hamburg"`,
    );
  });

  it('omitting address removes it from both header and every row (privacy invariant)', () => {
    const columnsWithoutAddress: VolunteerCsvColumnId[] = [
      'name',
      'email',
      'roles',
      'dateOfBirth',
      'gender',
      'phone',
    ];
    const csv = serializeVolunteersToCsv(
      [fullRow],
      columnsWithoutAddress,
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[0]).not.toContain('Adresse');
    expect(lines[1]).not.toContain('Hauptstraße');
    expect(lines[1]).not.toContain('Hamburg');
    // header has exactly 6 columns
    const headerCols = lines[0]?.split('","');
    expect(headerCols).toHaveLength(6);
  });

  it('renders empty cells for null birthdate/phone/address without throwing', () => {
    const csv = serializeVolunteersToCsv(
      [nullRow],
      ALL_COLUMNS,
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"Bob Null","bob@example.org","","","","",""');
  });

  it('escapes cells containing commas', () => {
    const row = {
      user: {
        name: 'Smith, John',
        email: 'john@example.org',
        preferredName: null,
        birthdate: null,
        gender: null,
        phone: null,
        street: null,
        zip: null,
        city: null,
      },
      roles: [],
    };
    const csv = serializeVolunteersToCsv(
      [row],
      ['name', 'email'],
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"Smith, John","john@example.org"');
  });

  it('escapes cells containing double-quotes', () => {
    const row = {
      user: {
        name: 'O"Brien',
        email: 'obrien@example.org',
        preferredName: null,
        birthdate: null,
        gender: null,
        phone: null,
        street: null,
        zip: null,
        city: null,
      },
      roles: [],
    };
    const csv = serializeVolunteersToCsv(
      [row],
      ['name', 'email'],
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"O""Brien","obrien@example.org"');
  });

  describe('formula-injection guard', () => {
    const makeNameRow = (name: string) => ({
      user: {
        name,
        email: 'x@example.org',
        preferredName: null,
        birthdate: null,
        gender: null,
        phone: null,
        street: null,
        zip: null,
        city: null,
      },
      roles: [],
    });

    it('prefixes = with a single quote to block formula injection', () => {
      const csv = serializeVolunteersToCsv(
        [makeNameRow('=HYPERLINK("http://x")')],
        ['name'],
        HEADERS,
        roleLabel,
        formatDate,
        NOW,
      );
      expect(csv.split('\n')[1]).toBe(`"'=HYPERLINK(""http://x"")"`);
    });

    it('prefixes + with a single quote', () => {
      const csv = serializeVolunteersToCsv(
        [makeNameRow('+1234')],
        ['name'],
        HEADERS,
        roleLabel,
        formatDate,
        NOW,
      );
      expect(csv.split('\n')[1]).toBe(`"'+1234"`);
    });

    it('does NOT prefix safe values', () => {
      const csv = serializeVolunteersToCsv(
        [makeNameRow('Hamburg')],
        ['name'],
        HEADERS,
        roleLabel,
        formatDate,
        NOW,
      );
      expect(csv.split('\n')[1]).toBe('"Hamburg"');
    });
  });

  it('address joins only present parts', () => {
    const row = {
      user: {
        name: 'Partial',
        email: 'partial@example.org',
        preferredName: null,
        birthdate: null,
        gender: null,
        phone: null,
        street: null,
        zip: '12345',
        city: 'Berlin',
      },
      roles: [],
    };
    const csv = serializeVolunteersToCsv(
      [row],
      ['address'],
      HEADERS,
      roleLabel,
      formatDate,
      NOW,
    );
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"12345 Berlin"');
  });
});
