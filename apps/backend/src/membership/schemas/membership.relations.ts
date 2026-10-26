import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const membershipRelations = defineRelationsPart(schema, (r) => ({
  memberships: {
    user: r.one.users({
      from: r.memberships.userId,
      to: r.users.id,
      optional: false,
    }),
    organizationUnit: r.one.organizationUnits({
      from: r.memberships.organizationUnitId,
      to: r.organizationUnits.id,
      optional: false,
    }),
    idVerifiedBy: r.one.users({
      from: r.memberships.idVerifiedById,
      to: r.users.id,
    }),
    roles: r.many.membershipRoles({
      from: r.memberships.id,
      to: r.membershipRoles.membershipId,
    }),
  },
  membershipRoles: {
    membership: r.one.memberships({
      from: r.membershipRoles.membershipId,
      to: r.memberships.id,
      optional: false,
    }),
    role: r.one.roles({
      from: r.membershipRoles.roleId,
      to: r.roles.id,
      optional: false,
    }),
  },
}));
