'use client';

import type { GetPermissionGroupsQuery } from '@repo/data';
import { Card, Label, Separator, Switch } from '@repo/ui';
import { useTranslations } from 'next-intl';
import {
  permissionDescriptionKey,
  permissionLabelKey,
  permissionTitleKey,
} from '../lib/role-label';

type PermissionGroup = GetPermissionGroupsQuery['permissionGroups'][number];

interface PermissionPickerProps {
  groups?: PermissionGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function PermissionPicker({
  groups = [],
  selectedIds,
  onChange,
  disabled = false,
}: PermissionPickerProps) {
  const t = useTranslations('Role.permissions');
  const togglePermission = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const toggleGroup = (group: PermissionGroup) => {
    const groupIds = group.items.map((item) => item.permission.id);
    const allSelected = groupIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      onChange(selectedIds.filter((id) => !groupIds.includes(id)));
    } else {
      const newIds = new Set([...selectedIds, ...groupIds]);
      onChange([...newIds]);
    }
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupIds = group.items.map((item) => item.permission.id);
        const allSelected = groupIds.every((id) => selectedIds.includes(id));
        const someSelected =
          !allSelected && groupIds.some((id) => selectedIds.includes(id));

        return (
          <Card key={group.key} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-lg font-semibold">
                {t(permissionTitleKey(group.key))}
              </Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  {allSelected
                    ? t('all')
                    : someSelected
                      ? t('partial')
                      : t('none')}
                </Label>
                <Switch
                  size="sm"
                  checked={allSelected}
                  onCheckedChange={() => toggleGroup(group)}
                  disabled={disabled}
                />
              </div>
            </div>
            <Separator className="mb-3" />
            <div
              className={`grid gap-2 ${
                group.items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {group.items.map((item) => (
                <div
                  key={item.permission.id}
                  className="rounded-md px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold cursor-pointer">
                      {t(permissionLabelKey(item.permission.key))}
                    </Label>
                    <Switch
                      size="sm"
                      checked={selectedIds.includes(item.permission.id)}
                      onCheckedChange={() =>
                        togglePermission(item.permission.id)
                      }
                      disabled={disabled}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(permissionDescriptionKey(item.permission.key))}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
