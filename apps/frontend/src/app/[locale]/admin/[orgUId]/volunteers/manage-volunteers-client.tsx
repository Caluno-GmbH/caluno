'use client';

import { MembershipRequestStatus } from '@repo/data';
import {
  useMembershipRequestCount,
  useMembershipRequests,
  useMemberships,
} from '@repo/data/react';
import {
  ActionsCell,
  Badge,
  Button,
  EntityCell,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, ScanQrCode, Search, UserRound, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { ButtonClipboard } from '@/components/button-clipboard';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import {
  createFilterParsers,
  pageParser,
  pageSizeParser,
} from '@/components/data-table/table-params';
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
import { copyToClipboard } from '@/lib/clipboard';
import { CopyableEmailCell } from './copyable-email-cell';
import { VolunteerRequiredFormsPopover } from './required-forms-popover';
import { RoleSelectCell } from './role-select-cell';

const TAB_APPROVED = 'APPROVED';
const TAB_PENDING = MembershipRequestStatus.Pending;
const TAB_REJECTED = MembershipRequestStatus.Rejected;

interface Props {
  orgUId: string;
}

type Membership = NonNullable<
  ReturnType<typeof useMemberships>['data']
>[number];

function useApprovedTableParams() {
  return useQueryStates(
    {
      ...createFilterParsers(),
      page: pageParser,
      pageSize: pageSizeParser,
    },
    { shallow: false },
  );
}

function ApprovedTab({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Volunteer');
  const tRole = useTranslations('Role');
  const { data, isPending } = useMemberships(orgUId);
  const { open: openVolunteerSheet } = useSheetTrigger('volunteer-profile');

  const [{ q, page, pageSize }, setParams] = useApprovedTableParams();

  const [sorting, setSorting] = useState<
    import('@tanstack/react-table').SortingState
  >([]);

  const roleLabel = (role: TranslatableRole) => {
    const key = internalRoleKey(role);
    return key ? tRole(key) : role.name;
  };

  const columns = useMemo<ColumnDef<DataTableFeatures, Membership, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => row.user.name,
        enableSorting: true,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.name')} />
        ),
        cell: ({ row }) => {
          const membership = row.original;
          const openProfile = () =>
            openVolunteerSheet({
              userId: membership.user.id,
              volunteerName: membership.user.name,
              volunteerStatus: MembershipRequestStatus.Accepted,
              volunteerEmail: membership.user.email,
              volunteerCheckInId: membership.user.checkInId,
              canRemoveMembership: 'true',
            });
          return (
            <button
              type="button"
              onClick={openProfile}
              aria-label={t('table.openProfileAria', {
                name: membership.user.name,
              })}
              className="w-full rounded-sm text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <EntityCell
                avatar={{
                  src: membership.user.image ?? undefined,
                  alt: membership.user.name,
                  fallback: <UserRound className="size-3" />,
                }}
                title={membership.user.name}
              />
            </button>
          );
        },
      },
      {
        id: 'email',
        accessorFn: (row) => row.user.email,
        enableSorting: true,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.email')} />
        ),
        cell: ({ row }) => (
          <CopyableEmailCell
            email={row.original.user.email}
            volunteerName={row.original.user.name}
          />
        ),
      },
      {
        id: 'roles',
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.roles')} />
        ),
        cell: ({ row }) => (
          <RoleSelectCell
            membershipId={row.original.id}
            roles={row.original.roles}
            orgUId={orgUId}
          />
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const membership = row.original;
          return (
            <ActionsCell>
              <Link
                href={`/check-in/${membership.user.checkInId}/check-in?orgUId=${orgUId}`}
                aria-label={t('action.checkInAria')}
              >
                <Button
                  size="icon-sm"
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
            </ActionsCell>
          );
        },
      },
    ],
    [t, orgUId, openVolunteerSheet],
  );

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

  const visible = memberships.filter((membership) =>
    matchesVolunteerQuery(membership, q, roleLabel),
  );

  const query = q.trim();

  const handleCopyEmails = () => {
    const emails = visible.map((membership) => membership.user.email);
    copyToClipboard(
      emails.join(', '),
      t('table.emailsCopied', { count: emails.length }),
    );
  };

  const pagination = {
    pageIndex: page - 1,
    pageSize: Number(pageSize),
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            value={q}
            onChange={(e) => {
              void setParams({ q: e.target.value, page: 1 });
            }}
            placeholder={t('search.placeholder')}
            className="pl-9 pr-10"
          />
          {q && (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => void setParams({ q: '', page: 1 })}
              tooltip={t('search.clearAria')}
              className="absolute top-2 right-2"
            >
              <X />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:flex-1">
          {query && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {t('search.countFiltered', {
                count: visible.length,
                total: memberships.length,
              })}
            </p>
          )}
          {visible.length > 0 && (
            <Button
              size="md"
              variant={query ? 'secondary' : 'outline'}
              onClick={handleCopyEmails}
              className="ml-auto"
            >
              {t('table.copyEmails', { count: visible.length })}
              <Copy />
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyVolunteerMatches />
      ) : (
        <>
          <DataTable
            mode="client"
            columns={columns}
            data={visible}
            emptyMessage={t('search.noResults')}
            sorting={sorting}
            onSortingChange={setSorting}
            pagination={pagination}
            onPaginationChange={(updater) => {
              const next =
                typeof updater === 'function' ? updater(pagination) : updater;
              void setParams({
                page: next.pageIndex + 1,
                pageSize: String(next.pageSize) as '15' | '25' | '50' | '100',
              });
            }}
          />
          <DataTablePagination total={visible.length} name={t('table.name')} />
        </>
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
                <Badge size="count">{pendingCount}</Badge>
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
