import z from 'zod';

interface TimeEntrySchemaMessages {
  organizationUnitRequired: string;
  shiftInstanceRequired: string;
  volunteerRequired: string;
  startedAtRequired: string;
  endedAtRequired: string;
  timeEntryIdRequired: string;
  reimbursementTypeRequired?: string;
  endBeforeStart: string;
  /** `start` lets the message render the shift end relative to the check-in day. */
  startAfterShiftEnd: (shiftEnd: Date, start: Date) => string;
}

export function timeEntrySchema(t: TimeEntrySchemaMessages) {
  return z.object({
    organizationUnitId: z.string().min(1, t.organizationUnitRequired),
    shiftId: z.string().optional(),
    shiftInstanceId: z.string().optional(),
    volunteerId: z.string().min(1, t.volunteerRequired),
    startedAt: z.date(t.startedAtRequired),
    endedAt: z.date().nullable().optional(),
    notes: z.string().trim().optional(),
    reimbursementTypeId: z.string().optional(),
  });
}

/** The stored entry an edit form started from. */
export interface TimeEntryEditBaseline {
  startedAt?: Date;
  shiftInstanceId?: string;
}

/**
 * `baseline` is set in edit mode. The shift-end rule is skipped while the start
 * and the shift instance still match it, mirroring the backend: legacy entries
 * that start after their shift's end (late check-in window, shift moved
 * earlier) must stay editable without falsifying the start.
 */
export function clientTimeEntrySchema(
  t: TimeEntrySchemaMessages,
  baseline?: TimeEntryEditBaseline,
) {
  return timeEntrySchema(t)
    .extend({
      hasShift: z.boolean(),
      isPaidTime: z.boolean(),
      // The selected shift instance's end. Not submitted data: it only lets the
      // form mirror the backend's "check-in cannot be later than the shift end".
      shiftInstanceEndsAt: z.date().nullable().optional(),
    })
    .superRefine((data, ctx) => {
      // Compare full date-times so overnight entries (end on the next day) work.
      if (data.endedAt && data.endedAt.getTime() <= data.startedAt.getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: ['endedAt'],
          message: t.endBeforeStart,
        });
      }
      const unchangedFromBaseline =
        !!baseline?.startedAt &&
        data.startedAt.getTime() === baseline.startedAt.getTime() &&
        (data.shiftInstanceId ?? '') === (baseline.shiftInstanceId ?? '');
      if (
        !unchangedFromBaseline &&
        data.shiftInstanceEndsAt &&
        data.startedAt.getTime() > data.shiftInstanceEndsAt.getTime()
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['startedAt'],
          message: t.startAfterShiftEnd(
            data.shiftInstanceEndsAt,
            data.startedAt,
          ),
        });
      }
      if (data.hasShift && !data.shiftInstanceId) {
        ctx.addIssue({
          code: 'custom',
          path: ['shiftInstanceId'],
          message: t.shiftInstanceRequired,
        });
      }
      if (data.isPaidTime && !data.reimbursementTypeId) {
        ctx.addIssue({
          code: 'custom',
          path: ['reimbursementTypeId'],
          message: t.reimbursementTypeRequired ?? 'Pauschale type is required',
        });
      }
    });
}

export const serverTimeEntrySchema = timeEntrySchema({
  organizationUnitRequired: 'Organization Unit is required',
  shiftInstanceRequired: 'Shift date is required',
  volunteerRequired: 'Volunteer is required',
  startedAtRequired: 'Start time is required',
  endedAtRequired: 'End time is required',
  timeEntryIdRequired: 'Time Entry ID is required',
  endBeforeStart: 'Time entry must end after it starts',
  startAfterShiftEnd: () => 'Check-in cannot be later than the shift end',
});

export type TimeEntryFormValues = z.infer<
  ReturnType<typeof clientTimeEntrySchema>
>;

export function deleteTimeEntrySchema(
  t: Pick<
    TimeEntrySchemaMessages,
    'timeEntryIdRequired' | 'organizationUnitRequired'
  >,
) {
  return z.object({
    id: z.string().min(1, t.timeEntryIdRequired),
    organizationUnitId: z.string().min(1, t.organizationUnitRequired),
  });
}

export const serverDeleteTimeEntrySchema = deleteTimeEntrySchema({
  timeEntryIdRequired: 'Time Entry ID is required',
  organizationUnitRequired: 'Organization unit ID is required',
});

export const serverConfirmTimeEntrySchema = z.object({
  organizationUnitId: z.string().min(1, 'Organization unit ID is required'),
});

export const serverCheckInVolunteerSchema = z.object({
  organizationUnitId: z.string().min(1, 'Organization Unit is required'),
  volunteerId: z.string().min(1, 'Volunteer is required'),
  shiftInstanceId: z.string().min(1).nullable(),
  startedAt: z
    .date('Start time is required')
    .refine((date) => !Number.isNaN(date.getTime()), {
      message: 'Start time is required',
    }),
});

export const serverCheckOutVolunteerSchema = z.object({
  timeEntryId: z.string().min(1, 'Time Entry ID is required'),
  organizationUnitId: z.string().min(1, 'Organization unit ID is required'),
});
