import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const exportLogsRelations = defineRelationsPart(schema, (r) => ({
  exportLogs: {
    actor: r.one.users({
      from: r.exportLogs.actorUserId,
      to: r.users.id,
    }),
    organizationUnit: r.one.organizationUnits({
      from: r.exportLogs.organizationUnitId,
      to: r.organizationUnits.id,
    }),
  },
}));
