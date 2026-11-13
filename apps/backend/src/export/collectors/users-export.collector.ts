import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '../../auth/constants';
import type { UserEntity } from '../../auth/schemas/auth.schema';
import type { RoleEntity } from '../../auth/schemas/role.schema';
import { MembershipService } from '../../membership/membership.service';
import type { MembershipEntity } from '../../membership/schemas/membership.schema';
import { ExportTable } from '../enums';
import { formatBerlinDate } from '../export-csv.util';
import type { ExportColumnDefinition } from '../serializers/export-serializer';
import type {
  CollectedExport,
  ExportCollector,
  ExportCollectorContext,
} from './export-collector';

const COLUMNS: readonly ExportColumnDefinition[] = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'roles', label: 'Roles' },
  { id: 'dateOfBirth', label: 'Date of Birth' },
  { id: 'gender', label: 'Gender' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
];

type MembershipWithRelations = MembershipEntity & {
  user: UserEntity;
  roles: Array<{ role: RoleEntity | null }>;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAddress(user: {
  street: string | null;
  zip: string | null;
  city: string | null;
}): string | null {
  const parts = [user.street, [user.zip, user.city].filter(Boolean).join(' ')]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

@Injectable()
export class UsersExportCollector implements ExportCollector {
  readonly tableKind = ExportTable.USERS;
  readonly requiredPermission = PERMISSIONS.VOLUNTEER_EDIT;
  readonly technicalIdLabel = 'User ID';
  readonly columns = COLUMNS;

  constructor(private readonly membershipService: MembershipService) {}

  async collect(context: ExportCollectorContext): Promise<CollectedExport> {
    const selected = new Set(context.rowIds);

    // Org-scoped read: foreign-unit membership ids are inherently absent.
    const memberships = (
      (await this.membershipService.getMembershipsForUnits(
        context.unitIds,
      )) as MembershipWithRelations[]
    ).filter((membership) => selected.has(membership.id));

    return {
      rows: memberships.map((membership) => {
        const user = membership.user;
        const roles = (membership.roles ?? [])
          .map((membershipRole) => membershipRole.role?.name)
          .filter((name): name is string => Boolean(name));
        return {
          technicalId: user.id,
          cells: {
            name: user.name,
            email: user.email,
            roles: roles.join('; '),
            dateOfBirth: formatBerlinDate(parseDate(user.birthdate)),
            gender: user.gender,
            phone: user.phone,
            address: formatAddress(user),
          },
        };
      }),
      subjectUserIds: [...new Set(memberships.map((m) => m.user.id))],
    };
  }
}
