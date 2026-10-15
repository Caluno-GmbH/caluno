import { getTranslations } from 'next-intl/server';
import { updateEvent } from '@/domain/event/actions';
import { EventForm } from '@/domain/event/components/event-form';
import { getDataClient } from '@/lib/data-client';
import { requireFound } from '@/lib/require-found';

interface EditEventPageProps {
  params: Promise<{ orgUId: string; eventId: string; locale: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { orgUId, eventId, locale } = await params;
  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'Event.sheet' });

  const event = await requireFound(() => data.event.findById(eventId));

  return (
    <EventForm
      title={t('editTitle')}
      description={t('editDescription')}
      orgUId={orgUId}
      mutate={updateEvent.bind(null, orgUId, event.id)}
      initialValues={{
        title: event.title,
        startsAt: new Date(event.startsAt),
        endsAt: new Date(event.endsAt),
        location: event.location ?? undefined,
      }}
      initialRequiredFormIds={event.requiredForms.map((ref) => ref.form.id)}
      logoPreviewUrl={event.logoUrl}
      coverPreviewUrl={event.coverUrl}
    />
  );
}
