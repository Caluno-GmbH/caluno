import { ShiftVisibility } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { updateShift } from '@/domain/shift/actions';
import { ShiftForm } from '@/domain/shift/components/shift-form';
import { getDataClient } from '@/lib/data-client';
import { requireFound } from '@/lib/require-found';

interface EditEventShiftPageProps {
  params: Promise<{
    orgUId: string;
    eventId: string;
    shiftId: string;
    locale: string;
  }>;
}

export default async function EditEventShiftPage({
  params,
}: EditEventShiftPageProps) {
  const { orgUId, eventId, shiftId, locale } = await params;
  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'Shift.sheet' });

  const [event, shift] = await Promise.all([
    requireFound(() => data.event.findById(eventId)),
    requireFound(() => data.shift.findByIdDetailed(shiftId)),
  ]);

  return (
    <ShiftForm
      title={t('editTitle')}
      description={t('editDescription')}
      orgUId={orgUId}
      mutate={updateShift.bind(null, orgUId, shift.id)}
      event={{
        title: event.title,
        startsAt: new Date(event.startsAt),
        endsAt: new Date(event.endsAt),
      }}
      imagePreviewUrl={shift.imageUrl}
      initialRequiredFormIds={shift.requiredForms.map((ref) => ref.form.id)}
      initialValues={{
        name: shift.title,
        instructions: shift.instructions ?? undefined,
        location: shift.location ?? undefined,
        startsAt: shift.startDate,
        endsAt: shift.endDate,
        openShift: shift.visibility === ShiftVisibility.AllMembers,
        joinRequiresApproval: shift.joinRequiresApproval,
        recurrenceDays: shift.recurrenceDays,
        recurrenceEndsAt: shift.recurrenceEndsAt,
        minVolunteers: shift.minVolunteers ?? undefined,
        maxVolunteers: shift.maxVolunteers ?? undefined,
        reimbursementTypeId: shift.reimbursementTypeId ?? undefined,
      }}
    />
  );
}
