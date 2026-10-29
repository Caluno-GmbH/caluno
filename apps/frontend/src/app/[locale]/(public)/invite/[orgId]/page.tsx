import { type JoinOrganizationMutation, JoinStatus } from '@repo/data';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { redirect as redirectWithLocale } from '@/i18n/navigation';
import { isAuthenticated } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';
import { requireFound } from '@/lib/require-found';
import { getSafeRedirect } from '@/lib/safe-redirect';
import { JoinError } from './components/join-error';
import { RequestPending } from './components/request-pending';
import { RequestRejected } from './components/request-rejected';

interface InvitePageProps {
  params: Promise<{ locale: string; orgId: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { locale, orgId } = await params;
  const organizationUnitId = orgId;
  const t = await getTranslations('MembershipRequest');

  if (!(await isAuthenticated())) {
    const searchParams = new URLSearchParams({ orgUId: organizationUnitId });
    redirectWithLocale({ href: `/api/invite?${searchParams}`, locale });
  }

  const data = await getDataClient();
  const orgUnit = await requireFound(() =>
    data.organization.findUnitWithOrg(organizationUnitId),
  );

  let result: JoinOrganizationMutation['joinOrganization'];
  try {
    result = await data.membershipRequest.join(organizationUnitId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t('invite.joinErrorFallback');
    return <JoinError message={message} />;
  }

  if (result.status === JoinStatus.Joined) {
    const cookieStore = await cookies();
    const pendingRedirect = cookieStore.get('pending_redirect')?.value;
    redirect(getSafeRedirect(pendingRedirect, `/admin/${organizationUnitId}`));
  }

  if (result.status === JoinStatus.PendingMembership) {
    return <RequestPending orgName={orgUnit.name} />;
  }

  if (result.status === JoinStatus.Rejected) {
    return <RequestRejected orgName={orgUnit.name} />;
  }

  if (result.status === JoinStatus.RequirementsNeeded) {
    redirect(`/join/${organizationUnitId}/forms`);
  }

  return <JoinError message={t('invite.unexpectedError')} />;
}
