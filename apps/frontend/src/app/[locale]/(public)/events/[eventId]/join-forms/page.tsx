import { JoinStatus, RequiredFormTargetType } from '@repo/data';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EventJoinFormsClient } from '@/app/[locale]/(public)/events/[eventId]/join-forms/event-join-forms-client';
import {
  buildSubmittedFormIds,
  resolveRequiredForms,
} from '@/domain/requirement-form/resolve-required-forms';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { requireFound, requireFoundOrNull } from '@/lib/require-found';
import { getSafeRedirect } from '@/lib/safe-redirect';

interface EventJoinFormsPageProps {
  params: Promise<{ locale: string; eventId: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}

export async function generateMetadata({ params }: EventJoinFormsPageProps) {
  const { eventId, locale } = await params;
  const data = await getDataClient({ locale: resolveLocale(locale) });
  const event = await requireFoundOrNull(() =>
    data.publicEvent.findById(eventId),
  );
  if (!event) return { title: 'Event — Caluno' };
  const t = await getTranslations({ locale, namespace: 'EventDetail' });
  return {
    title: `${t('forms.title', { eventTitle: event.title })} — Caluno`,
  };
}

export default async function EventJoinFormsPage({
  params,
  searchParams,
}: EventJoinFormsPageProps) {
  const { locale, eventId } = await params;
  const { redirectTo } = await searchParams;
  const data = await getDataClient({ locale: resolveLocale(locale) });

  const event = await requireFound(() => data.publicEvent.findById(eventId));

  const session = await getSession();
  if (!session) {
    const searchParams = new URLSearchParams({
      signup: '1',
      redirectTo: redirectTo ?? `/events/${eventId}/join-forms`,
    });
    redirect({ href: `/api/invite?${searchParams}`, locale });
  }

  const membershipState =
    event.organizationUnit?.myMembershipState ?? JoinStatus.None;
  if (membershipState === JoinStatus.Joined) {
    redirect({
      href: getSafeRedirect(redirectTo, `/events/${eventId}`),
      locale,
    });
  }

  const organizationUnitId = event.organizationUnit?.id ?? '';
  const submissionsResult = await data.requirementForm
    .findMyFormSubmissions(organizationUnitId)
    .catch((error) => {
      unstable_rethrow(error);
      return [];
    });

  const submittedFormIds = buildSubmittedFormIds(submissionsResult);

  const requiredForms = resolveRequiredForms(
    [
      {
        targetType: RequiredFormTargetType.Event,
        targetId: eventId,
        refs: event.requiredForms,
      },
      {
        targetType: RequiredFormTargetType.OrganizationUnit,
        targetId: organizationUnitId,
        refs: event.organizationUnit?.requiredForms,
      },
    ],
    submittedFormIds,
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
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <EventJoinFormsClient
          eventId={eventId}
          eventTitle={event.title}
          requiredForms={requiredForms}
          profileData={profileData}
          initialSubmittedFormIds={submittedFormIds}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
