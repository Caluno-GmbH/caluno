import { JoinStatus, RequiredFormTargetType } from '@repo/data';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShiftJoinFormsClient } from '@/app/[locale]/(public)/shifts/[shiftId]/instances/[instanceId]/join-forms/shift-join-forms-client';
import {
  getSubmittedFormIds,
  resolveRequiredForms,
} from '@/domain/requirement-form/resolve-required-forms';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { requireFound, requireFoundOrNull } from '@/lib/require-found';
import { getSafeRedirect } from '@/lib/safe-redirect';

interface ShiftJoinFormsPageProps {
  params: Promise<{ locale: string; shiftId: string; instanceId: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}

export async function generateMetadata({ params }: ShiftJoinFormsPageProps) {
  const { shiftId, locale } = await params;
  const data = await getDataClient({ locale: resolveLocale(locale) });
  const shift = await requireFoundOrNull(() => data.shift.findById(shiftId));
  if (!shift) return { title: 'Shift — Caluno' };
  const t = await getTranslations({ locale, namespace: 'ShiftDetail' });
  return {
    title: `${t('forms.title', { shiftTitle: shift.title })} — Caluno`,
  };
}

export default async function ShiftJoinFormsPage({
  params,
  searchParams,
}: ShiftJoinFormsPageProps) {
  const { locale, shiftId, instanceId } = await params;
  const { redirectTo } = await searchParams;

  const data = await getDataClient({ locale: resolveLocale(locale) });

  const shift = await requireFound(() => data.shift.findById(shiftId));
  const instance = await requireFound(() =>
    data.shift.findPublicInstance(instanceId),
  );

  const session = await getSession();
  if (!session) {
    const searchParams = new URLSearchParams({
      signup: '1',
      redirectTo:
        redirectTo ?? `/shifts/${shiftId}/instances/${instanceId}/join-forms`,
    });
    redirect({ href: `/api/invite?${searchParams}`, locale });
  }

  const membershipState =
    shift.organizationUnit?.myMembershipState ?? JoinStatus.None;
  if (membershipState === JoinStatus.Joined) {
    redirect({
      href: getSafeRedirect(redirectTo, `/shifts/${shiftId}`),
      locale,
    });
  }

  const submissionsResult = await data.requirementForm
    .findMyFormSubmissions(shift.organizationUnitId)
    .catch((error) => {
      unstable_rethrow(error);
      return [];
    });

  const submittedFormIds = getSubmittedFormIds(submissionsResult);

  const requiredForms = resolveRequiredForms(
    [
      {
        targetType: RequiredFormTargetType.ShiftInstance,
        targetId: instanceId,
        refs: instance.requiredForms,
      },
      {
        targetType: RequiredFormTargetType.Shift,
        targetId: shiftId,
        refs: shift.requiredForms,
      },
      {
        targetType: RequiredFormTargetType.OrganizationUnit,
        targetId: shift.organizationUnitId,
        refs: shift.organizationUnit?.requiredForms,
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
        <ShiftJoinFormsClient
          shiftId={shiftId}
          instanceId={instanceId}
          shiftTitle={shift.title}
          requiredForms={requiredForms}
          profileData={profileData}
          initialSubmittedFormIds={submittedFormIds}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
