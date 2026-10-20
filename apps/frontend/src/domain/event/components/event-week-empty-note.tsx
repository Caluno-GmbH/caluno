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
    <p className="pointer-events-auto flex flex-col items-center gap-1 rounded-lg border bg-background px-6 py-4 text-center text-sm text-muted-foreground shadow-sm">
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
