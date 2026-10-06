import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const termsRelations = defineRelationsPart(schema, (r) => ({
  termsAcceptances: {
    user: r.one.users({
      from: r.termsAcceptances.userId,
      to: r.users.id,
    }),
  },
  termsNotifications: {
    user: r.one.users({
      from: r.termsNotifications.userId,
      to: r.users.id,
    }),
  },
}));
