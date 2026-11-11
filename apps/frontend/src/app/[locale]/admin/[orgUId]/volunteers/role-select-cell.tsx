'use client';

import { PermissionKey } from '@repo/data';
import {
  useCurrentOrg,
  useHasPermission,
  useRoles,
  useUpdateMembershipRoles,
} from '@repo/data/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui';
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  internalRoleKey,
  type TranslatableRole,
} from '@/domain/role/lib/role-label';
import { useRouter } from '@/i18n/navigation';

interface RoleSelectCellProps {
  membershipId: string;
  roles: Array<{ id: string; name: string; isInternal: boolean }>;
  orgUId: string;
}

export function RoleSelectCell({
  membershipId,
  roles,
  orgUId,
}: RoleSelectCellProps) {
  const [open, setOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<{ id: string } | null>(null);
  const router = useRouter();
  const canEdit = useHasPermission(PermissionKey.VolunteerEdit);
  // Roles are org-wide; the backend only accepts role creation from the top unit.
  const hasRoleManage = useHasPermission(PermissionKey.RoleManage);
  const { isRoot } = useCurrentOrg();
  const canCreateRole = hasRoleManage && isRoot;
  const {
    data: availableRoles,
    isPending: rolesLoading,
    refetch: refetchRoles,
  } = useRoles();
  const { mutate: updateRoles, isPending: isUpdating } =
    useUpdateMembershipRoles();

  const t = useTranslations('Role');
  const roleLabel = (role: TranslatableRole) => {
    const key = internalRoleKey(role);
    return key ? t(key) : role.name;
  };
  const tCommon = useTranslations('Common');
  const customRole = roles.find((role) => !role.isInternal);
  const currentRole = customRole || roles[0];

  // Read-only users see custom role name or nothing
  if (!canEdit) {
    return currentRole ? (
      <span className="text-sm">{roleLabel(currentRole)}</span>
    ) : (
      <span className="text-sm text-muted-foreground">{tCommon('dash')}</span>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) refetchRoles();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-40 h-auto min-h-8 px-2 py-1 justify-between"
            disabled={rolesLoading || isUpdating}
          >
            <span className="truncate">
              {currentRole ? roleLabel(currentRole) : t('noRole')}
            </span>
            <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-max min-w-[var(--radix-popover-trigger-width)] max-w-80 p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command>
            <CommandInput placeholder={t('select.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t('select.empty')}</CommandEmpty>
              <CommandGroup>
                {availableRoles?.map((role) => {
                  const isSelected = role.id === currentRole?.id;
                  return (
                    <CommandItem
                      key={role.id}
                      value={roleLabel(role)}
                      onSelect={() => {
                        if (!isSelected) {
                          setPendingRole({ id: role.id });
                        }
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      {isSelected && (
                        <CheckIcon className="mr-2 size-4 text-primary" />
                      )}
                      <span
                        className={`truncate ${isSelected ? 'font-medium' : ''}`}
                      >
                        {roleLabel(role)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {canCreateRole && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      className="cursor-pointer"
                      onSelect={() => {
                        setOpen(false);
                        router.push(`/admin/${orgUId}/settings/roles/new`);
                      }}
                    >
                      <PlusIcon className="mr-2 size-4" />
                      {t('select.addCustom')}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('select.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('select.confirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRole(null)}>
              {tCommon('no')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRole) {
                  updateRoles(
                    { membershipId, roleIds: [pendingRole.id] },
                    { onError: () => toast.error(t('select.updateFailed')) },
                  );
                }
                setPendingRole(null);
              }}
            >
              {tCommon('yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
