import { RequiredFormTargetType } from '@repo/data';
import type { RequiredForm } from '@repo/data/react';
import { getTranslations } from 'next-intl/server';
import type { RequiredFormItem } from '@/domain/requirement-form/components/required-form-renderer';
import {
  buildStoredFieldValues,
  buildSubmittedFormIds,
  mergeShareFormWithRequiredForms,
} from '@/domain/requirement-form/resolve-required-forms';
import { profileFieldValues } from '@/domain/user/lib/profile-field-values';
import { redirect as redirectWithLocale } from '@/i18n/navigation';
import { getSession } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { isMember as isMemberOfOrgUnit } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';
import { ShareFormClient } from './share-form-client';

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

  const [isMember, userProfile, publicOrgUnit, existingSubmission, storedRows] =
    await Promise.all([
      isMemberOfOrgUnit(orgUId),
      data.user.getMe(),
      data.publicOrganizationUnit.findById(orgUId),
      data.requirementForm.getMyFormSubmissionByToken(token, orgUId),
      data.requirementForm.findMyStoredFormFieldValues(orgUId),
    ]);

  const profileData = profileFieldValues(userProfile);
  const storedFieldValues = buildStoredFieldValues(storedRows);
  const orgName = publicOrgUnit?.name;

  const t = await getTranslations('RequirementForm.volunteerForm');

  // Members only fill the shared form; already-submitted → done.
  if (isMember && existingSubmission) {
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

  let forms: RequiredFormItem[];
  let initialSubmittedFormIds: Set<string>;

  if (isMember) {
    forms = [{ form: form as RequiredForm, order: 0, shareToken: token }];
    initialSubmittedFormIds = new Set();
  } else {
    const [orgUnit, mySubmissions] = await Promise.all([
      data.organizationUnit.findById(orgUId),
      data.requirementForm.findMyFormSubmissions(orgUId),
    ]);

    initialSubmittedFormIds = buildSubmittedFormIds(mySubmissions);
    const requiredForms: RequiredFormItem[] = (
      orgUnit?.requiredForms ?? []
    ).map((ref) => ({
      form: ref.form as RequiredForm,
      order: ref.order,
      submitted: initialSubmittedFormIds.has(ref.form.id),
      targetType: RequiredFormTargetType.OrganizationUnit,
      targetId: orgUId,
    }));

    forms = mergeShareFormWithRequiredForms({
      sharedForm: form as RequiredForm,
      shareToken: token,
      requiredForms,
      submittedFormIds: initialSubmittedFormIds,
      targetType: RequiredFormTargetType.OrganizationUnit,
      targetId: orgUId,
    });
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-xl">
        <ShareFormClient
          forms={forms}
          isMember={isMember}
          orgUId={orgUId}
          orgName={orgName}
          formName={form.name}
          formDescription={form.description}
          profileData={profileData}
          storedFieldValues={storedFieldValues}
          initialSubmittedFormIds={initialSubmittedFormIds}
        />
      </div>
    </div>
  );
}
