import { useFormatting } from '@/lib/formatting/use-formatting';
import {
  WEEK_HEADER_FROM_FORMAT,
  WEEK_HEADER_TO_FORMAT,
  type WeekGroup,
} from '../my-time-grouping';
import { MyTimeEntryRow } from './my-time-entry-row';

export const MyTimeWeekGroup = ({ week }: { week: WeekGroup }) => {
  const { formatDurationByMinutes, formatRange } = useFormatting();

  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between px-1 text-sm font-semibold text-muted-foreground">
        <span>
          {formatRange(
            week.weekStart,
            week.weekEnd,
            '',
            WEEK_HEADER_FROM_FORMAT,
            WEEK_HEADER_TO_FORMAT,
          )}
        </span>
        <span className="tabular-nums">
          {formatDurationByMinutes(week.totalMinutes)}
        </span>
      </header>
      <div className="space-y-2">
        {week.entries.map((entry) => (
          <MyTimeEntryRow key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
};
