import { JoinStatus } from '@repo/data';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EventFormsClient } from '@/app/[locale]/(public)/events/[eventId]/forms/event-forms-client';
import { EventPageHeader } from '@/domain/event/components/event-page-header';
import type { RequiredFormItem } from '@/domain/requirement-form/components/required-form-renderer';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { requireFound, requireFoundOrNull } from '@/lib/require-found';
import { getSafeRedirect } from '@/lib/safe-redirect';

interface EventFormsPageProps {
  params: Promise<{ locale: string; eventId: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}

export async function generateMetadata({ params }: EventFormsPageProps) {
  const { eventId, locale } = await params;
  const data = await getDataClient({ locale: resolveLocale(locale) });
  const event = await requireFoundOrNull(() =>
    data.publicEvent.findById(eventId),
  );
  if (!event) return { title: 'Event — Caluno' };
  const t = await getTranslations({ locale, namespace: 'EventDetail' });
  return { title: `${t('forms.title', { eventTitle: event.title })} — Caluno` };
}

export default async function EventFormsPage({
  params,
  searchParams,
}: EventFormsPageProps) {
  const { locale, eventId } = await params;
  const { redirectTo } = await searchParams;
  const data = await getDataClient({ locale: resolveLocale(locale) });

  const event = await requireFound(() => data.publicEvent.findById(eventId));

  const session = await getSession();
  if (!session) {
    const inviteParams = new URLSearchParams({
      redirectTo: redirectTo ?? `/events/${eventId}/forms`,
    });
    if (event.organizationUnit?.id) {
      inviteParams.set('orgUId', event.organizationUnit.id);
    }
    redirect({ href: `/api/invite?${inviteParams}`, locale });
  }

  const joinResult = await data.publicEvent.join(eventId).catch((error) => {
    unstable_rethrow(error);
    return null;
  });

  if (joinResult?.status === JoinStatus.Joined) {
    redirect({
      href: getSafeRedirect(redirectTo, `/events/${eventId}`),
      locale,
    });
  }

  const requiredForms =
    joinResult?.requiredForms ??
    event.requiredForms?.map((ref) => ({ ...ref, submitted: false })) ??
    [];

  const submittedFormIds = new Set<string>(
    requiredForms
      .filter((ref) => ref.submitted)
      .map((ref) => ref.form.id)
      .filter((id): id is string => Boolean(id)),
  );

  let profileData: Record<string, string> = {};
  try {
    const userProfile = await data.user.getMe();
    profileData = profileFieldValues(userProfile);
  } catch (error) {
    unstable_rethrow(error);
    // Ignore profile fetch errors; form will render without prefilled values.
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <EventPageHeader logoUrl={event.organizationUnit?.logoUrl} />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EventFormsClient
          eventId={eventId}
          eventTitle={event.title}
          requiredForms={requiredForms as RequiredFormItem[]}
          profileData={profileData}
          initialSubmittedFormIds={submittedFormIds}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
