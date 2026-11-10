'use client';

import { useTranslations } from 'next-intl';
import {
  permissionDescriptionKey,
  permissionLabelKey,
  permissionTitleKey,
} from '../lib/role-label';

export function PermissionLabel({ permissionKey }: { permissionKey: string }) {
  const t = useTranslations('Role.permissions');
  return <>{t(permissionLabelKey(permissionKey))}</>;
}

export function PermissionDescription({
  permissionKey,
}: {
  permissionKey: string;
}) {
  const t = useTranslations('Role.permissions');
  return <>{t(permissionDescriptionKey(permissionKey))}</>;
}

export function PermissionGroupTitle({ groupKey }: { groupKey: string }) {
  const t = useTranslations('Role.permissions');
  return <>{t(permissionTitleKey(groupKey))}</>;
}
