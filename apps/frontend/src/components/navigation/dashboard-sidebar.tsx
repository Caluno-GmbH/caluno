'use client';
import type { PermissionKey } from '@repo/data';
import { useCurrentOrg } from '@repo/data/react';
import {
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
import { useEffect, useMemo, useState } from 'react';
import { OrgSwitcher } from '@/domain/organization/components/org-switcher';
import type { EeNavContribution } from '@/edition/enterprise-extensions';
import { useSignOut } from '@/hooks/use-sign-out';
import { Link, useRouter } from '@/i18n/navigation';
import { buildAdminNav, mergeAdminNav, visibleAdminNav } from './admin-nav';

interface DashboardSidebarProps {
  permissions: PermissionKey[];
  /** True when `src/ee` is present; sidebar loads EE nav client-side. */
  eeEnabled?: boolean;
}

export function DashboardSidebar({
  permissions,
  eeEnabled = false,
}: DashboardSidebarProps) {
  const params = useParams();
  const router = useRouter();
  const orgUId = params.orgUId as string | undefined;
  const t = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const { accountingEnabled } = useCurrentOrg();
  const signOut = useSignOut();

  const [eeNav, setEeNav] = useState<EeNavContribution[] | undefined>();

  useEffect(() => {
    if (!eeEnabled || !orgUId) {
      setEeNav(undefined);
      return;
    }
    let cancelled = false;
    void import(/* turbopackOptional: true */ '@/ee/nav').then((mod) => {
      if (!cancelled) setEeNav(mod.eeNav({ orgUId }));
    });
    return () => {
      cancelled = true;
    };
  }, [eeEnabled, orgUId]);

  const sections = useMemo(() => {
    if (!orgUId) return [];
    const base = buildAdminNav({
      orgUId,
      accountingEnabled,
      permissionSet,
    });
    return visibleAdminNav(mergeAdminNav(base, eeNav));
  }, [orgUId, accountingEnabled, permissionSet, eeNav]);

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
                        {item.CountBadge ? (
                          <item.CountBadge />
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
