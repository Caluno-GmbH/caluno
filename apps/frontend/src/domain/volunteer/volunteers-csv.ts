import { formatDateOfBirthWithAge } from './volunteer-profile-format';

export type VolunteerCsvColumnId =
  | 'name'
  | 'email'
  | 'roles'
  | 'dateOfBirth'
  | 'gender'
  | 'phone'
  | 'address';

type CsvMembership = {
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    preferredName: string | null | undefined;
    birthdate: string | null | undefined;
    gender: string | null | undefined;
    phone: string | null | undefined;
    street: string | null | undefined;
    zip: string | null | undefined;
    city: string | null | undefined;
  };
  roles: Array<{ name: string }>;
};

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function resolveAddress(user: CsvMembership['user']): string {
  const parts: string[] = [];
  if (user.street) parts.push(user.street);
  const zipCity = [user.zip, user.city].filter(Boolean).join(' ');
  if (zipCity) parts.push(zipCity);
  return parts.join(', ');
}

function membershipToRow(
  membership: CsvMembership,
  columnIds: VolunteerCsvColumnId[],
  roleLabel: (role: { name: string }) => string,
  formatDate: (d: Date) => string,
  now: Date,
): string {
  const cells = columnIds.map((col) => {
    switch (col) {
      case 'name':
        return membership.user.name ?? '';
      case 'email':
        return membership.user.email ?? '';
      case 'roles':
        return membership.roles.map(roleLabel).join(', ');
      case 'dateOfBirth':
        return formatDateOfBirthWithAge(
          membership.user.birthdate,
          now,
          formatDate,
        );
      case 'gender':
        return membership.user.gender ?? '';
      case 'phone':
        return membership.user.phone ?? '';
      case 'address':
        return resolveAddress(membership.user);
      default:
        return '';
    }
  });
  return cells.map(escapeCell).join(',');
}

export function serializeVolunteersToCsv(
  rows: CsvMembership[],
  columnIds: VolunteerCsvColumnId[],
  headers: Record<VolunteerCsvColumnId, string>,
  roleLabel: (role: { name: string }) => string,
  formatDate: (d: Date) => string,
  now: Date,
): string {
  const header = columnIds.map((col) => escapeCell(headers[col])).join(',');
  const dataRows = rows.map((row) =>
    membershipToRow(row, columnIds, roleLabel, formatDate, now),
  );
  return [header, ...dataRows].join('\n');
}
