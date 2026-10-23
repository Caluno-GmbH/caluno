'use client';

import type { GetRequirementFormByShareTokenQuery } from '@repo/data';
import { RequiredFormTargetType } from '@repo/data';
import type { RequiredForm } from '@repo/data/react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RequiredFormRenderer } from '@/domain/requirement-form/components/required-form-renderer';
import { useRouter } from '@/i18n/navigation';

export type PublicShareForm = NonNullable<
  GetRequirementFormByShareTokenQuery['requirementFormByShareToken']
>;

interface ShareFormClientProps {
  form: PublicShareForm;
  token: string;
  orgUId: string;
  orgName?: string;
  isMember: boolean;
  profileData: Record<string, string>;
  storedFieldValues?: Record<string, string>;
}

export function ShareFormClient({
  form,
  token,
  orgUId,
  orgName,
  isMember,
  profileData,
  storedFieldValues = {},
}: ShareFormClientProps) {
  const router = useRouter();
  const t = useTranslations('RequirementForm.volunteerForm');
  const [submitted, setSubmitted] = useState(false);
  const formOrg = orgName ?? form.name;

  const handleComplete = async () => {
    if (!isMember) {
      router.push('/profile#memberships');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">{t('successTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('successMessage')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isMember && (
        <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-800">
          {t('membershipRequestNotice', { orgName: formOrg })}
        </div>
      )}

      <RequiredFormRenderer
        title={form.name}
        description={
          token
            ? t('completeRequiredFormsHint')
            : (form.description?.trim() ?? '')
        }
        targetType={RequiredFormTargetType.OrganizationUnit}
        targetId={orgUId}
        forms={[{ form: form as RequiredForm, order: 0 }]}
        profileData={profileData}
        storedFieldValues={storedFieldValues}
        orgName={formOrg}
        shareToken={token}
        initialSubmittedFormIds={new Set()}
        onComplete={handleComplete}
      />
    </div>
  );
}
