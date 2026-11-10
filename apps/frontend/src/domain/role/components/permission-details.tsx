import type { GetPermissionGroupsQuery } from '@repo/data';
import {
  PermissionDescription,
  PermissionGroupTitle,
  PermissionLabel,
} from './permission-text';

type PermissionGroup = GetPermissionGroupsQuery['permissionGroups'][number];

export function PermissionDetails({ groups }: { groups: PermissionGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="text-sm mb-2">
            <PermissionGroupTitle groupKey={group.key} />
          </h3>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.permission.id}>
                <p className="font-medium">
                  <PermissionLabel permissionKey={item.permission.key} />
                </p>
                <p className="text-sm text-muted-foreground">
                  <PermissionDescription permissionKey={item.permission.key} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
