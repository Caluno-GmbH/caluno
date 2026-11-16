'use client';

import { MembershipRequestStatus, PermissionKey } from '@repo/data';
import {
  useHasPermission,
  useMembershipRequestCount,
  useOrgUId,
} from '@repo/data/react';
import { Badge } from '@repo/ui';

/** Pending membership-request count for the Volunteers nav item. */
export function VolunteersNavCountBadge() {
  const orgUId = useOrgUId();
  const canViewVolunteers = useHasPermission(PermissionKey.VolunteerView);
  const { data: pendingCount } = useMembershipRequestCount(
    orgUId,
    MembershipRequestStatus.Pending,
    canViewVolunteers,
  );

  if (!pendingCount) return null;

  return (
    <Badge variant="neutral" size="count">
      {pendingCount}
    </Badge>
  );
}
