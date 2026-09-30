'use client';

import { useUserOrganizations } from '@repo/data/react';
import {
  Button,
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { orgUnitAdminHref, switchOrgAdminHref } from '@/lib/admin-routes';
import { getOrgUnitDisplayName } from '@/lib/org-display-name';

export function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const currentorgUId = params.orgUId as string | undefined;
  const t = useTranslations('Navigation');

  const organizations = useUserOrganizations();

  const orgHref = (orgUId: string) =>
    orgUId === currentorgUId
      ? orgUnitAdminHref(orgUId)
      : switchOrgAdminHref(orgUId, pathname);

  const currentOrg = organizations.find((org) => org.id === currentorgUId);
  const isNested = currentOrg && !currentOrg.isRoot;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between px-3!',
            isNested && 'h-auto min-h-9 py-1',
          )}
        >
          {currentOrg ? (
            <span className="flex min-w-0 items-center gap-2 text-left">
              <Building2 className="shrink-0" />
              <span className="flex min-w-0 flex-col">
                {isNested ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    {currentOrg.rootOrganizationName}
                  </span>
                ) : null}
                <span className="truncate font-medium">{currentOrg.name}</span>
              </span>
            </span>
          ) : (
            t('selectOrganization')
          )}
          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem key={org.id} value={org.id} asChild>
                  <Link href={orgHref(org.id)} onClick={() => setOpen(false)}>
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        currentorgUId === org.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span>{getOrgUnitDisplayName(org)}</span>
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
