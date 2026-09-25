import { ShiftVisibility } from '@repo/data';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { duplicateShift } from '@/domain/shift/actions';
import { ShiftForm } from '@/domain/shift/components/shift-form';
import { getDataClient } from '@/lib/data-client';

interface DuplicateShiftPageProps {
  params: Promise<{ orgUId: string; shiftId: string; locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}

export default async function DuplicateShiftPage({
  params,
  searchParams,
}: DuplicateShiftPageProps) {
  const { orgUId, shiftId, locale } = await params;
  const { redirect } = await searchParams;
  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'Shift.sheet' });
  const shift = await data.shift.findByIdDetailed(shiftId);

  if (!shift) {
    notFound();
  }

  const event = shift.event ? await data.event.findById(shift.event.id) : null;

  return (
    <ShiftForm
      title={t('duplicateTitle')}
      description={t('duplicateDescription')}
      orgUId={orgUId}
      mutate={duplicateShift.bind(
        null,
        orgUId,
        shift.id,
        shift.event?.id ?? null,
      )}
      redirectToDetailOnCreate={redirect === 'detail'}
      event={
        event
          ? {
              title: event.title,
              startsAt: new Date(event.startsAt),
              endsAt: new Date(event.endsAt),
            }
          : undefined
      }
      imagePreviewUrl={shift.imageUrl}
      initialRequiredFormIds={shift.requiredForms.map((ref) => ref.form.id)}
      initialValues={{
        name: t('duplicateNamePrefill', { name: shift.title }),
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
