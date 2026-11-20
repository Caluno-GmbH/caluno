'use client';

import type { RoleListItem } from '@repo/data';
import { useOrgUId } from '@repo/data/react';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { useTranslations } from 'next-intl';
import {
  internalRoleDescriptionKey,
  internalRoleKey,
} from '@/domain/role/lib/role-label';
import { Link } from '@/i18n/navigation';
import { ActionBar } from './action-bar';

interface RolesTableProps {
  roles: RoleListItem[];
}

export function RolesTable({ roles }: RolesTableProps) {
  const orgUId = useOrgUId();
  const t = useTranslations('Role');
  const roleLabel = (role: RoleListItem) => {
    const key = internalRoleKey(role);
    return key ? t(key) : role.name;
  };
  const tCommon = useTranslations('Common');
  const roleDescription = (role: RoleListItem) => {
    const key = internalRoleDescriptionKey(role);
    return key ? t(key) : role.description || tCommon('dash');
  };

  return (
    <div className="@container rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead className="hidden @2xl:table-cell">
              {t('table.description')}
            </TableHead>
            <TableHead className="hidden @2xl:table-cell">
              {t('table.permissions')}
            </TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium whitespace-normal @2xl:min-w-48">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/${orgUId}/settings/roles/${role.id}`}
                    className="hover:underline"
                  >
                    {roleLabel(role)}
                  </Link>
                  {role.isInternal && (
                    <Badge variant="neutral">{t('table.systemBadge')}</Badge>
                  )}
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 font-normal break-words @2xl:hidden">
                  <p>{roleDescription(role)}</p>
                  <p>
                    {t('table.permissionsCount', {
                      n: role.permissions.length,
                    })}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground hidden min-w-64 whitespace-normal break-words @2xl:table-cell">
                {roleDescription(role)}
              </TableCell>
              <TableCell className="hidden @2xl:table-cell">
                {t('table.permissionsCount', { n: role.permissions.length })}
              </TableCell>
              <TableCell className="text-right">
                <ActionBar
                  id={role.id}
                  isInternal={role.isInternal}
                  organizationUnitId={orgUId}
                  size="xs"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
