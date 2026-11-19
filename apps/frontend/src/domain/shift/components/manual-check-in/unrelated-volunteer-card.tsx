import { Avatar, AvatarFallback } from '@repo/ui';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Stands in for `UserCard` while the volunteer is not related to any of the
 * caller's check-in units: the API returns no identity then, and this card
 * deliberately renders none (ADR 0001).
 */
export function UnrelatedVolunteerCard() {
  const t = useTranslations('CheckIn');

  return (
    <div className="flex gap-2 min-w-0">
      <Avatar size="lg" className="bg-muted">
        <AvatarFallback>
          <UserRound className="size-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="overflow-hidden">
        <div className="font-medium text-left text-sm">
          {t('unrelatedVolunteerTitle')}
        </div>
        <div className="text-xs text-left text-muted-foreground">
          {t('unrelatedVolunteerDescription')}
        </div>
      </div>
    </div>
  );
}
