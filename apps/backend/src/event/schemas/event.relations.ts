import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const eventsRelations = defineRelationsPart(schema, (r) => ({
  events: {
    organizationUnit: r.one.organizationUnits({
      from: r.events.organizationUnitId,
      to: r.organizationUnits.id,
      optional: false,
    }),
    createdBy: r.one.users({
      from: r.events.createdById,
      to: r.users.id,
      optional: false,
    }),
    invites: r.many.eventInvites({
      from: r.events.id,
      to: r.eventInvites.eventId,
    }),
    shifts: r.many.shifts({
      from: r.events.id,
      to: r.shifts.eventId,
    }),
    requiredForms: r.many.eventRequiredForms({
      from: r.events.id,
      to: r.eventRequiredForms.eventId,
    }),
  },
  eventRequiredForms: {
    event: r.one.events({
      from: r.eventRequiredForms.eventId,
      to: r.events.id,
      optional: false,
    }),
    form: r.one.requirementForms({
      from: r.eventRequiredForms.formId,
      to: r.requirementForms.id,
      optional: false,
    }),
  },
}));
