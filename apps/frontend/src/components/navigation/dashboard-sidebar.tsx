'use client';
import { MembershipRequestStatus, PermissionKey } from '@repo/data';
import {
  useCurrentOrg,
  useMembershipRequestCount,
  useMyTasks,
} from '@repo/data/react';
import {
  Badge,
  Button,
  Logo,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@repo/ui';
import { LogOutIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { OrgSwitcher } from '@/domain/organization/components/org-switcher';
import { visibleOverviewTasks } from '@/domain/overview/visible-tasks';
import type { EeNavContribution } from '@/edition/enterprise-extensions';
import { useSignOut } from '@/hooks/use-sign-out';
import { Link, useRouter } from '@/i18n/navigation';
import { buildAdminNav, mergeAdminNav, visibleAdminNav } from './admin-nav';

interface DashboardSidebarProps {
  permissions: PermissionKey[];
  /** Resolved server-side via `loadEeExtensions()`; empty/undefined in OSS. */
  eeNav?: EeNavContribution[];
}

export function DashboardSidebar({
  permissions,
  eeNav,
}: DashboardSidebarProps) {
  const params = useParams();
  const router = useRouter();
  const orgUId = params.orgUId as string | undefined;
  const t = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const canViewVolunteers = permissionSet.has(PermissionKey.VolunteerView);
  const { accountingEnabled } = useCurrentOrg();
  const signOut = useSignOut();

  const { data: pendingCount } = useMembershipRequestCount(
    orgUId ?? '',
    MembershipRequestStatus.Pending,
    canViewVolunteers,
  );
  const { data: myTasks } = useMyTasks(orgUId ?? '');
  const waitingCount = useMemo(() => {
    if (!orgUId || !myTasks) return 0;
    return visibleOverviewTasks(myTasks, {
      organizationUnitId: orgUId,
      permissions: permissionSet,
    }).length;
  }, [myTasks, orgUId, permissionSet]);

  const sections = useMemo(() => {
    if (!orgUId) return [];
    const base = buildAdminNav({
      orgUId,
      waitingCount,
      pendingCount,
      accountingEnabled,
      permissionSet,
    });
    return visibleAdminNav(mergeAdminNav(base, eeNav));
  }, [
    orgUId,
    waitingCount,
    pendingCount,
    accountingEnabled,
    permissionSet,
    eeNav,
  ]);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3 space-y-2">
        <div className="px-2">
          <Logo width={96} />
        </div>
        <OrgSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>
              {section.labelNamespace === 'Common'
                ? tCommon(section.labelKey as Parameters<typeof tCommon>[0])
                : t(section.labelKey as Parameters<typeof t>[0])}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between w-full"
                      >
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>
                            {t(item.titleKey as Parameters<typeof t>[0])}
                          </span>
                        </span>
                        {item.count ? (
                          <Badge variant="neutral" size="count">
                            {item.count}
                          </Badge>
                        ) : item.trailingIcon ? (
                          <item.trailingIcon className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOutIcon />
          {tCommon('signOut')}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
