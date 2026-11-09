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
  Skeleton,
  TableToolbar,
  type TableToolbarActiveFilter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextCell,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import type {
  ColumnDef,
  ColumnVisibilityState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table';
import {
  Copy,
  MapPin,
  ScanQrCode,
  Shield,
  UserRound,
  VenusAndMars,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { debounce, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { ButtonClipboard } from '@/components/button-clipboard';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableFeatures } from '@/components/data-table/features';
import { SEARCH_DEBOUNCE_MS } from '@/components/data-table/table-params';
import { readSort, toSorting } from '@/components/data-table/table-sort';
import MembershipRequestCard from '@/domain/membership-requests/components/membership-request-card';
import { RemoveMembershipButton } from '@/domain/memberships/components/remove-membership-button';
import { organizationUnitUrl } from '@/domain/organization/share';
import {
  internalRoleKey,
  type TranslatableRole,
} from '@/domain/role/lib/role-label';
import { EmptyVolunteerMatches } from '@/domain/volunteer/empty-volunteer-matches';
import { EmptyVolunteers } from '@/domain/volunteer/empty-volunteers';
import {
  collectVolunteerEmails,
  deriveCityOptions,
  deriveGenderOptions,
  matchesVolunteerFilters,
  UNSET,
} from '@/domain/volunteer/volunteer-filters';
import {
  formatDateOfBirthWithAge,
  formatVolunteerAddress,
} from '@/domain/volunteer/volunteer-profile-format';
import { matchesVolunteerQuery } from '@/domain/volunteer/volunteer-search';
import { useQueryParamTab } from '@/hooks/use-query-param-tab';
import { useSheetTrigger } from '@/hooks/use-sheet';
import { Link } from '@/i18n/navigation';
import { copyToClipboard } from '@/lib/clipboard';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { ConfigureViewButton } from './configure-view-button';
import { CopyableEmailCell } from './copyable-email-cell';
import { DownloadVolunteersCsvButton } from './download-volunteers-csv-button';
import { VolunteerRequiredFormsPopover } from './required-forms-popover';
import { RoleSelectCell } from './role-select-cell';
import {
  columnVisibilityFromParam,
  OPTIONAL_COLUMN_IDS,
  volunteersSearchParams,
} from './volunteers-search-params';

const TAB_APPROVED = 'APPROVED';
const TAB_PENDING = MembershipRequestStatus.Pending;
const TAB_REJECTED = MembershipRequestStatus.Rejected;
const TAB_VALUES = [TAB_APPROVED, TAB_PENDING, TAB_REJECTED] as const;

interface Props {
  orgUId: string;
}

type Membership = NonNullable<
  ReturnType<typeof useMemberships>['data']
>[number];

// All rows are loaded client-side, so URL writes stay shallow (no server
// round trip). `sort` has no default: unset keeps the API's natural order.
function useApprovedTableParams() {
  return useQueryStates(volunteersSearchParams, { shallow: true });
}

function ApprovedTab({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Volunteer');
  const tRole = useTranslations('Role');
  const { data, isPending } = useMemberships(orgUId);
  const { open: openVolunteerSheet } = useSheetTrigger('volunteer-profile');

  const [
    { q, sort, dir, page, pageSize, roles, gender, city, verified, cols },
    setParams,
  ] = useApprovedTableParams();

  const { formatDate } = useFormatting();

  const sorting = useMemo(
    () => (sort ? toSorting(sort, dir) : []),
    [sort, dir],
  );

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const resolved = readSort(next, { sort: sort ?? 'name', dir });
    void setParams({ ...resolved, page: 1 });
  };

  const columnVisibility = useMemo(
    () => columnVisibilityFromParam(cols),
    [cols],
  );

  const onColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> = (
    updater,
  ) => {
    const next =
      typeof updater === 'function' ? updater(columnVisibility) : updater;
    const enabledIds = OPTIONAL_COLUMN_IDS.filter((id) => next[id] !== false);
    void setParams({ cols: enabledIds });
  };

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
        enableHiding: false,
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
                subtitle={membership.user.preferredName ?? undefined}
              />
            </button>
          );
        },
      },
      {
        id: 'email',
        accessorFn: (row) => row.user.email,
        enableSorting: true,
        enableHiding: false,
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
        enableHiding: false,
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
        id: 'dateOfBirth',
        enableSorting: true,
        enableHiding: true,
        accessorFn: (row) => row.user.birthdate ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('table.dateOfBirth')}
          />
        ),
        cell: ({ row }) => {
          const value = formatDateOfBirthWithAge(
            row.original.user.birthdate,
            new Date(),
            formatDate,
          );
          return <TextCell>{value}</TextCell>;
        },
      },
      {
        id: 'gender',
        enableSorting: false,
        enableHiding: true,
        accessorFn: (row) => row.user.gender ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.gender')} />
        ),
        cell: ({ row }) => (
          <TextCell>{row.original.user.gender ?? ''}</TextCell>
        ),
      },
      {
        id: 'phone',
        enableSorting: false,
        enableHiding: true,
        accessorFn: (row) => row.user.phone ?? '',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.phone')} />
        ),
        cell: ({ row }) => <TextCell>{row.original.user.phone ?? ''}</TextCell>,
      },
      {
        id: 'address',
        enableSorting: false,
        enableHiding: true,
        accessorFn: (row) => formatVolunteerAddress(row.user),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.address')} />
        ),
        cell: ({ row }) => (
          <TextCell>{formatVolunteerAddress(row.original.user)}</TextCell>
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
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
    [t, orgUId, openVolunteerSheet, formatDate],
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

  // Derive filter options from full membership list
  const genderOptions = deriveGenderOptions(memberships).map((opt) => ({
    label: opt.value === UNSET ? t('filter.notSet') : opt.label,
    value: opt.value,
  }));
  const cityOptions = deriveCityOptions(memberships).map((val) =>
    val === UNSET ? t('filter.notSet') : val,
  );

  // Build role options from unique roles across all memberships
  const roleMap = new Map<string, { id: string; label: string }>();
  for (const m of memberships) {
    for (const role of m.roles) {
      if (!roleMap.has(role.id)) {
        roleMap.set(role.id, { id: role.id, label: roleLabel(role) });
      }
    }
  }
  const roleOptions = [...roleMap.values()].map((r) => ({
    value: r.id,
    label: r.label,
  }));

  const visible = memberships.filter(
    (membership) =>
      matchesVolunteerQuery(membership, q, roleLabel) &&
      matchesVolunteerFilters(membership, {
        roleIds: roles,
        gender: gender ?? null,
        city: city ?? null,
        verified,
      }),
  );

  // Build active filter chips
  const activeFilters: TableToolbarActiveFilter[] = [];

  if (roles.length > 0) {
    const roleNames = roles
      .map((id) => roleMap.get(id)?.label ?? id)
      .join(', ');
    activeFilters.push({
      key: 'roles',
      label: t('filter.activeRole'),
      display: roleNames,
      onClear: () => void setParams({ roles: [], page: 1 }),
    });
  }

  if (gender !== null && gender !== undefined) {
    const genderDisplay =
      gender === UNSET
        ? t('filter.notSet')
        : (genderOptions.find((o) => o.value === gender)?.label ?? gender);
    activeFilters.push({
      key: 'gender',
      label: t('filter.activeGender'),
      display: genderDisplay,
      onClear: () => void setParams({ gender: null, page: 1 }),
    });
  }

  if (city !== null && city !== undefined) {
    const cityDisplay = city === UNSET ? t('filter.notSet') : city;
    activeFilters.push({
      key: 'city',
      label: t('filter.activeCity'),
      display: cityDisplay,
      onClear: () => void setParams({ city: null, page: 1 }),
    });
  }

  if (verified !== 'all') {
    const verifiedDisplay =
      verified === 'verified'
        ? t('filter.verifiedVerified')
        : t('filter.verifiedUnverified');
    activeFilters.push({
      key: 'verified',
      label: t('filter.activeVerified'),
      display: verifiedDisplay,
      onClear: () => void setParams({ verified: 'all', page: 1 }),
    });
  }

  const onClearAll = () =>
    void setParams({
      roles: [],
      gender: null,
      city: null,
      verified: 'all',
      page: 1,
    });

  const handleCopyEmails = () => {
    const emails = collectVolunteerEmails(visible);
    copyToClipboard(
      emails.join(', '),
      t('table.emailsCopied', { count: emails.length }),
    );
  };

  const size = Number(pageSize);
  // Clamp locally so the table never renders an out-of-range empty page;
  // DataTablePagination writes the clamped page back to the URL.
  const lastPage = Math.max(1, Math.ceil(visible.length / size));
  const pagination = {
    pageIndex: Math.min(page, lastPage) - 1,
    pageSize: size,
  };

  const columnLabels: Record<string, string> = {
    dateOfBirth: t('table.dateOfBirth'),
    gender: t('table.gender'),
    phone: t('table.phone'),
    address: t('table.address'),
  };

  return (
    <div className="space-y-2">
      <TableToolbar
        activeFilters={activeFilters}
        onClearAll={onClearAll}
        sheetTitle={t('filter.sheetTitle')}
        resultCount={visible.length}
        actions={[
          <Button
            key="copy-emails"
            variant="outline"
            size="sm"
            onClick={handleCopyEmails}
            disabled={visible.length === 0}
          >
            {t('table.copyEmails', { count: visible.length })}
            <Copy className="size-4" />
          </Button>,
          <DownloadVolunteersCsvButton
            key="download-csv"
            orgUId={orgUId}
            rows={visible}
            visibleColumnIds={cols}
          />,
        ]}
      >
        <TableToolbar.Search
          value={q}
          onChange={(value) =>
            void setParams(
              { q: value, page: 1 },
              value === ''
                ? undefined
                : { limitUrlUpdates: debounce(SEARCH_DEBOUNCE_MS) },
            )
          }
          placeholder={t('search.placeholder')}
          className="sm:w-80"
        />
        <TableToolbar.MultiSelect
          value={roles}
          onChange={(v) => void setParams({ roles: v, page: 1 })}
          options={roleOptions}
          placeholder={t('filter.rolePlaceholder')}
          ariaLabel={t('filter.activeRole')}
          icon={<Shield className="size-4" />}
        />
        <TableToolbar.Select
          value={gender ?? undefined}
          onChange={(v) => void setParams({ gender: v, page: 1 })}
          options={genderOptions}
          placeholder={t('filter.genderPlaceholder')}
          ariaLabel={t('filter.activeGender')}
          icon={<VenusAndMars className="size-4" />}
        />
        <TableToolbar.Combobox
          value={
            city !== null && city !== undefined
              ? city === UNSET
                ? t('filter.notSet')
                : city
              : undefined
          }
          onChange={(v) => {
            const raw = v === t('filter.notSet') ? UNSET : v;
            void setParams({ city: raw || null, page: 1 });
          }}
          options={cityOptions}
          placeholder={t('filter.cityPlaceholder')}
          emptyText={t('filter.cityEmpty')}
          ariaLabel={t('filter.activeCity')}
          icon={<MapPin className="size-4" />}
          className="min-w-28"
        />
        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          value={verified}
          onValueChange={(v) => {
            if (v === 'all' || v === 'verified' || v === 'unverified') {
              void setParams({ verified: v, page: 1 });
            }
          }}
        >
          <ToggleGroupItem value="all">
            {t('filter.verifiedAll')}
          </ToggleGroupItem>
          <ToggleGroupItem value="verified">
            {t('filter.verifiedVerified')}
          </ToggleGroupItem>
          <ToggleGroupItem value="unverified">
            {t('filter.verifiedUnverified')}
          </ToggleGroupItem>
        </ToggleGroup>
        <ConfigureViewButton
          enabled={cols}
          onChange={(ids) => void setParams({ cols: ids, page: 1 })}
          labels={columnLabels}
        />
      </TableToolbar>

      {visible.length === 0 ? (
        <EmptyVolunteerMatches />
      ) : (
        <>
          <DataTable
            mode="client"
            columns={columns}
            data={visible}
            emptyMessage={t('search.emptyTitle')}
            sorting={sorting}
            onSortingChange={onSortingChange}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
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
          <DataTablePagination
            total={visible.length}
            name={t('page.paginationName')}
            shallow
          />
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
  const t = useTranslations('Volunteer');
  const tMembershipStatus = useTranslations('MembershipRequest.status');
  const { value: activeTab, onValueChange: handleTabChange } = useQueryParamTab(
    {
      values: TAB_VALUES,
      defaultValue: TAB_APPROVED,
      param: 'status',
    },
  );

  const { data: pendingCount } = useMembershipRequestCount(
    orgUId ?? '',
    MembershipRequestStatus.Pending,
  );

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
