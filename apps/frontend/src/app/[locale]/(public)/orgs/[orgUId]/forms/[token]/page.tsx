import { getTranslations } from 'next-intl/server';
import { VolunteerFormWrapper } from '@/domain/requirement-form/components/volunteer-form-wrapper';
import { buildStoredFieldValues } from '@/domain/requirement-form/resolve-required-forms';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect as redirectWithLocale } from '@/i18n/navigation';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { isMember as isMemberOfOrgUnit } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';

interface Props {
  params: Promise<{ locale: string; orgUId: string; token: string }>;
}

export default async function PublicFormPage({ params }: Props) {
  const { locale, orgUId, token } = await params;
  const data = await getDataClient();

  const form = await requireFound(() =>
    data.requirementForm.findFormByShareToken(token),
  );

  const session = await getSession();
  if (!session) {
    const inviteParams = new URLSearchParams({
      redirectTo: `/orgs/${orgUId}/forms/${token}`,
      orgUId,
    });
    redirectWithLocale({
      href: `/api/invite?${inviteParams}`,
      locale,
    });
  }

  const [isMember, userProfile, orgUnit, existingSubmission, storedRows] =
    await Promise.all([
      isMemberOfOrgUnit(orgUId),
      data.user.getMe(),
      data.publicOrganizationUnit.findById(orgUId),
      data.requirementForm.getMyFormSubmissionByToken(token, orgUId),
      data.requirementForm.findMyStoredFormFieldValues(orgUId),
    ]);

  const profileData = profileFieldValues(userProfile);
  const storedFieldValues = buildStoredFieldValues(storedRows);

  const t = await getTranslations('RequirementForm.volunteerForm');

  if (existingSubmission) {
    return (
      <div className="min-h-screen bg-muted/30 py-10 px-4">
        <div className="mx-auto max-w-xl rounded-lg border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">
            {t('alreadySubmittedTitle')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t('alreadySubmittedMessage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-xl">
        <VolunteerFormWrapper
          form={form}
          token={token}
          isMember={isMember}
          orgUId={orgUId}
          orgName={orgUnit?.name}
          profileData={profileData}
          storedFieldValues={storedFieldValues}
        />
      </div>
    </div>
  );
}
