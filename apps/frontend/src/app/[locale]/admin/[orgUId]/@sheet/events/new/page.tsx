import { getTranslations } from 'next-intl/server';
import { createEvent } from '@/domain/event/actions';
import { EventForm } from '@/domain/event/components/event-form';
import { formatAddress } from '@/domain/org-unit/format-address';
import { getDataClient } from '@/lib/data-client';

interface CreateEventPageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export default async function CreateEventPage({
  params,
}: CreateEventPageProps) {
  const { orgUId, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Event.sheet' });
  const data = await getDataClient({ orgUId });
  const unit = await data.organizationUnit.findById(orgUId);

  return (
    <EventForm
      title={t('createTitle')}
      description={t('createDescription')}
      orgUId={orgUId}
      mutate={createEvent.bind(null, orgUId)}
      redirectToInviteOnCreate
      initialValues={{
        location: formatAddress(unit),
      }}
    />
  );
}
