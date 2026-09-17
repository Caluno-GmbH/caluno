import { useTranslations } from 'next-intl';
import {
  type CheckInTimeEntry,
  formatCheckedOutWindows,
} from '../check-in-state';

type CheckedOutStatusTooltipProps = {
  entries: CheckInTimeEntry[];
  formatTime: (date: Date) => string;
};

export function CheckedOutStatusTooltip({
  entries,
  formatTime,
}: CheckedOutStatusTooltipProps) {
  const t = useTranslations('Shift');
  const { lines, overflowCount } = formatCheckedOutWindows(
    entries,
    formatTime,
  );

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      {overflowCount > 0 ? (
        <span>{t('checkIn.moreWindows', { count: overflowCount })}</span>
      ) : null}
    </div>
  );
}
