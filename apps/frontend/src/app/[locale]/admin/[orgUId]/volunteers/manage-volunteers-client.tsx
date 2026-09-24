'use client';

import {
  MembershipRequestStatus,
  useMembershipRequestCount,
  useMembershipRequests,
  useMemberships,
} from '@repo/data/react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui';
import { ScanQrCode, Search, UserRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ButtonClipboard } from '@/components/button-clipboard';
import MembershipRequestCard from '@/domain/membership-requests/components/membership-request-card';
import { RemoveMembershipButton } from '@/domain/memberships/components/remove-membership-button';
import { organizationUnitUrl } from '@/domain/organization/share';
import {
  internalRoleKey,
  type TranslatableRole,
} from '@/domain/role/lib/role-label';
import { EmptyVolunteerMatches } from '@/domain/volunteer/empty-volunteer-matches';
import { EmptyVolunteers } from '@/domain/volunteer/empty-volunteers';
import { matchesVolunteerQuery } from '@/domain/volunteer/volunteer-search';
import { useSheetTrigger } from '@/hooks/use-sheet';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { CopyableEmailCell } from './copyable-email-cell';
import { VolunteerRequiredFormsPopover } from './required-forms-popover';
import { RoleSelectCell } from './role-select-cell';

const TAB_APPROVED = 'APPROVED';
const TAB_PENDING = MembershipRequestStatus.Pending;
const TAB_REJECTED = MembershipRequestStatus.Rejected;

interface Props {
  orgUId: string;
}

function ApprovedTab({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Volunteer');
  const tCommon = useTranslations('Common');
  const tRole = useTranslations('Role');
  const { data, isPending } = useMemberships(orgUId);
  const { open: openVolunteerSheet } = useSheetTrigger('volunteer-profile');
  const [search, setSearch] = useState('');

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const memberships = data ?? [];

  if (memberships.length === 0) {
    return (
      <EmptyVolunteers>
        <ButtonClipboard
          text={t('page.copyInviteLink')}
          copyText={organizationUnitUrl(orgUId)}
          toastMessage={t('page.inviteLinkCopied')}
        />
      </EmptyVolunteers>
    );
  }

  const roleLabel = (role: TranslatableRole) => {
    const key = internalRoleKey(role);
    return key ? tRole(key) : role.name;
  };

  const visible = memberships.filter((membership) =>
    matchesVolunteerQuery(membership, search, roleLabel),
  );

  return (
    <div className="space-y-2">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="pl-9"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyVolunteerMatches />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.email')}</TableHead>
                <TableHead>{t('table.roles')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((membership) => {
                const openProfile = () =>
                  openVolunteerSheet({
                    userId: membership.user.id,
                    volunteerName: membership.user.name,
                    volunteerStatus: MembershipRequestStatus.Accepted,
                    volunteerEmail: membership.user.email,
                    volunteerCheckInId: membership.user.checkInId,
                  });

                return (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={openProfile}
                        aria-label={t('table.openProfileAria', {
                          name: membership.user.name,
                        })}
                        className="flex items-center gap-2 rounded-sm text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <Avatar size="sm">
                          <AvatarImage
                            src={membership.user.image ?? undefined}
                            alt={tCommon('avatarAlt', {
                              name: membership.user.name,
                            })}
                          />
                          <AvatarFallback>
                            <UserRound className="size-3" />
                          </AvatarFallback>
                        </Avatar>
                        {membership.user.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <CopyableEmailCell
                        email={membership.user.email}
                        volunteerName={membership.user.name}
                      />
                    </TableCell>
                    <TableCell>
                      <RoleSelectCell
                        membershipId={membership.id}
                        roles={membership.roles}
                        orgUId={orgUId}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/check-in/${membership.user.checkInId}/check-in?orgUId=${orgUId}`}
                          aria-label={t('action.checkInAria')}
                        >
                          <Button
                            size="icon-md"
                            variant="outline"
                            tooltip={t('action.checkInShiftAria')}
                          >
                            <ScanQrCode />
                          </Button>
                        </Link>
                        <RemoveMembershipButton
                          membershipId={membership.id}
                          volunteerName={membership.user.name}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function RequestsTab({
  orgUId,
  status,
}: {
  orgUId: string;
  status: MembershipRequestStatus;
}) {
  const t = useTranslations('Volunteer');
  const { data, isPending } = useMembershipRequests(orgUId, status);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const requests = data?.items ?? [];

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground">
        {status === TAB_PENDING
          ? t('requests.pendingEmpty')
          : t('requests.rejectedEmpty')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((request) => (
        <MembershipRequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

export default function ManageVolunteersClient({ orgUId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('Volunteer');
  const tMembershipStatus = useTranslations('MembershipRequest.status');

  const activeTab = searchParams.get('status') ?? TAB_APPROVED;

  const { data: pendingCount } = useMembershipRequestCount(
    orgUId ?? '',
    MembershipRequestStatus.Pending,
  );

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const orgUnitUrl = organizationUnitUrl(orgUId);

  const tabs = [
    { value: TAB_APPROVED, label: tMembershipStatus('approved') },
    { value: TAB_PENDING, label: tMembershipStatus('pending') },
    { value: TAB_REJECTED, label: tMembershipStatus('rejected') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('page.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('page.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <VolunteerRequiredFormsPopover orgUId={orgUId} />
          <ButtonClipboard
            text={t('page.copyInviteLink')}
            copyText={orgUnitUrl}
            toastMessage={t('page.inviteLinkCopied')}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value === TAB_PENDING && (pendingCount ?? 0) > 0 && (
                <Badge className="h-5 min-w-5 rounded-full px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={TAB_APPROVED} className="mt-4">
          <ApprovedTab orgUId={orgUId} />
        </TabsContent>

        <TabsContent value={TAB_PENDING} className="mt-4">
          <RequestsTab orgUId={orgUId} status={TAB_PENDING} />
        </TabsContent>

        <TabsContent value={TAB_REJECTED} className="mt-4">
          <RequestsTab orgUId={orgUId} status={TAB_REJECTED} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
