'use client';

import { cn } from '@repo/ui';
import { useTranslations } from 'next-intl';

interface CharacterCounterProps {
  length: number;
  max: number;
}

/** "{length} / {max}" under a length-limited field; turns into an error once `length` passes `max`. */
export function CharacterCounter({ length, max }: CharacterCounterProps) {
  const t = useTranslations('Accounting.characterCounter');
  const overBy = length - max;
  const isOver = overBy > 0;

  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <span
        className={cn(isOver ? 'text-destructive' : 'text-muted-foreground')}
      >
        {length} / {max}
      </span>
      {isOver && (
        <p aria-live="polite" className="text-destructive">
          {t('tooLong', { count: overBy })}
        </p>
      )}
    </div>
  );
}
