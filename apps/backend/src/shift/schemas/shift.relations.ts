import { defineRelationsPart } from 'drizzle-orm';
import * as schema from '../../database/schema';

export const shiftsRelations = defineRelationsPart(schema, (r) => ({
  shifts: {
    organizationUnit: r.one.organizationUnits({
      from: r.shifts.organizationUnitId,
      to: r.organizationUnits.id,
      optional: false,
    }),
    createdBy: r.one.users({
      from: r.shifts.createdById,
      to: r.users.id,
      optional: false,
    }),
    instances: r.many.shiftInstances({
      from: r.shifts.id,
      to: r.shiftInstances.masterId,
    }),
    event: r.one.events({
      from: r.shifts.eventId,
      to: r.events.id,
    }),
    invites: r.many.shiftInvites({
      from: r.shifts.id,
      to: r.shiftInvites.shiftId,
    }),
    requiredForms: r.many.shiftRequiredForms({
      from: r.shifts.id,
      to: r.shiftRequiredForms.shiftId,
    }),
  },
  shiftRequiredForms: {
    shift: r.one.shifts({
      from: r.shiftRequiredForms.shiftId,
      to: r.shifts.id,
      optional: false,
    }),
    form: r.one.requirementForms({
      from: r.shiftRequiredForms.formId,
      to: r.requirementForms.id,
      optional: false,
    }),
  },
}));
