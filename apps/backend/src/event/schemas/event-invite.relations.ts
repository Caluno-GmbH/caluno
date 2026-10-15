import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const eventInvitesRelations = defineRelationsPart(schema, (r) => ({
  eventInvites: {
    event: r.one.events({
      from: r.eventInvites.eventId,
      to: r.events.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.eventInvites.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}));
