import { JoinStatus } from '@repo/data';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { OrgPageHeader } from '@/domain/org-unit/components/org-page-header';
import {
  buildStoredFieldValues,
  getSubmittedFormIds,
} from '@/domain/requirement-form/resolve-required-forms';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect } from '@/i18n/navigation';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { getSafeRedirect } from '@/lib/safe-redirect';
import { JoinFormsClient } from './join-forms-client';

interface JoinFormsPageProps {
  params: Promise<{ locale: string; orgUId: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function JoinFormsPage({
  params,
  searchParams,
}: JoinFormsPageProps) {
  const { locale, orgUId } = await params;
  const { redirectTo } = await searchParams;
  const _t = await getTranslations('MembershipRequest');

  const session = await getSession();
  if (!session?.user) {
    const searchParams = new URLSearchParams({
      orgUId,
      redirectTo: redirectTo ?? `/join/${orgUId}/forms`,
    });
    redirect({ href: `/api/invite?${searchParams}`, locale });
  }

  const data = await getDataClient();

  const [orgUnit, userProfile, joinResult] = await Promise.all([
    // Public query — org display + requiredForms field resolvers are anonymous.
    data.publicOrganizationUnit.findByIdWithRequiredForms(orgUId),
    data.user.getMe(),
    data.membershipRequest.join(orgUId).catch((error) => {
      unstable_rethrow(error);
      return null;
    }),
  ]);

  if (!orgUnit) {
    redirect({ href: '/', locale });
    return;
  }

  if (joinResult?.status === JoinStatus.Joined) {
    redirect({
      href: getSafeRedirect(redirectTo, `/admin/${orgUId}`),
      locale,
    });
  }

  const [mySubmissions, storedRows] = await Promise.all([
    data.requirementForm.findMyFormSubmissions(orgUId),
    data.requirementForm.findMyStoredFormFieldValues(orgUId),
  ]);

  const profileData = profileFieldValues(userProfile);
  const storedFieldValues = buildStoredFieldValues(storedRows);
  const submittedFormIds = getSubmittedFormIds(mySubmissions);

  return (
    <div className="min-h-screen bg-muted/30">
      <OrgPageHeader logoUrl={orgUnit.logoUrl} />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <JoinFormsClient
          orgUId={orgUId}
          orgName={orgUnit.name}
          requiredForms={orgUnit.requiredForms}
          profileData={profileData}
          storedFieldValues={storedFieldValues}
          initialSubmittedFormIds={submittedFormIds}
          redirectTo={redirectTo}
        />
      </div>
    </div>
  );
}
