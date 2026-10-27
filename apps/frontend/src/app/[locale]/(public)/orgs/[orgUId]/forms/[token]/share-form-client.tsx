'use client';

import { JoinStatus, RequiredFormTargetType } from '@repo/data';
import { useJoinOrganization } from '@repo/data/react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  type RequiredFormItem,
  RequiredFormRenderer,
} from '@/domain/requirement-form/components/required-form-renderer';
import { useRouter } from '@/i18n/navigation';

interface ShareFormClientProps {
  forms: RequiredFormItem[];
  orgUId: string;
  orgName?: string;
  formName: string;
  formDescription?: string | null;
  isMember: boolean;
  profileData: Record<string, string>;
  storedFieldValues?: Record<string, string>;
  initialSubmittedFormIds: Set<string>;
}

export function ShareFormClient({
  forms,
  orgUId,
  orgName,
  formName,
  formDescription,
  isMember,
  profileData,
  storedFieldValues = {},
  initialSubmittedFormIds,
}: ShareFormClientProps) {
  const router = useRouter();
  const t = useTranslations('RequirementForm.volunteerForm');
  const tJoin = useTranslations('MembershipRequest.joinForms');
  const joinOrganization = useJoinOrganization();
  const [submitted, setSubmitted] = useState(false);
  const displayOrgName = orgName ?? formName;

  const handleComplete = async () => {
    if (!isMember) {
      try {
        const result = await joinOrganization.mutateAsync(orgUId);

        if (result.status === JoinStatus.Joined) {
          toast.success(tJoin('joined'));
          router.push(`/orgs/${orgUId}`);
        } else if (result.status === JoinStatus.PendingMembership) {
          toast.success(tJoin('requestPending'));
          router.push('/profile#memberships');
        } else if (result.status === JoinStatus.Rejected) {
          toast.error(tJoin('rejected'));
          router.push(`/invite/${orgUId}`);
        } else if (result.status === JoinStatus.RequirementsNeeded) {
          toast.error(tJoin('requirementsNeeded'));
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tJoin('requestFailed'),
        );
      }
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
          {t('membershipRequestNotice', { orgName: displayOrgName })}
        </div>
      )}

      <RequiredFormRenderer
        title={
          isMember ? formName : tJoin('title', { orgName: displayOrgName })
        }
        description={
          isMember
            ? (formDescription?.trim() ?? '')
            : t('completeRequiredFormsHint')
        }
        emptyMessage={tJoin('noForms')}
        targetType={RequiredFormTargetType.OrganizationUnit}
        targetId={orgUId}
        forms={forms}
        profileData={profileData}
        storedFieldValues={storedFieldValues}
        orgName={displayOrgName}
        initialSubmittedFormIds={initialSubmittedFormIds}
        onComplete={handleComplete}
      />
    </div>
  );
}
