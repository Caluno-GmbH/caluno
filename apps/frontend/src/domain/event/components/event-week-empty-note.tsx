import { Button } from '@repo/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

interface EventWeekEmptyNoteProps {
  href: string | null;
  direction: 'next' | 'previous' | null;
}

export async function EventWeekEmptyNote({
  href,
  direction,
}: EventWeekEmptyNoteProps) {
  const t = await getTranslations('Event.detail.shiftsCard');

  return (
    <p className="text-sm text-muted-foreground">
      {t('weekEmpty')}
      {href && direction ? (
        <Button asChild variant="link" size="sm">
          <Link href={href}>
            {direction === 'next'
              ? t('nextWeekWithShifts')
              : t('previousWeekWithShifts')}
          </Link>
        </Button>
      ) : null}
    </p>
  );
}
