import type { CheckInContextData } from '@repo/data/react';
import { UserCard } from '@/components/user-card';
import { UnrelatedVolunteerCard } from './unrelated-volunteer-card';

/**
 * The volunteer's name and avatar once they are related to one of the
 * caller's check-in units; until then a placeholder that shows no identity
 * (ADR 0001).
 */
export function CheckInVolunteerIdentity({
  volunteer,
}: {
  volunteer: CheckInContextData['volunteer'];
}) {
  return volunteer ? (
    <UserCard user={volunteer} size="lg" hideEmail />
  ) : (
    <UnrelatedVolunteerCard />
  );
}
