import { Badge } from '@repo/ui';
import {
  CircleAlert,
  CircleCheck,
  FileWarning,
  TriangleAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  toAllowanceDisplay,
  type VolunteerAllowanceState,
} from '../allowance-display';

const ALLOWANCE_ICON: Record<VolunteerAllowanceState, typeof CircleCheck> = {
  ELIGIBLE: CircleCheck,
  NEARLY_EXHAUSTED: TriangleAlert,
  WOULD_EXCEED: CircleAlert,
  NO_AGREEMENT: FileWarning,
};

const ALLOWANCE_BADGE_VARIANT: Record<
  VolunteerAllowanceState,
  'success' | 'info' | 'destructive'
> = {
  ELIGIBLE: 'success',
  NEARLY_EXHAUSTED: 'info',
  WOULD_EXCEED: 'destructive',
  NO_AGREEMENT: 'info',
};

export function AllowanceBadge({ state }: { state: VolunteerAllowanceState }) {
  const t = useTranslations('Shift.transferList.allowance');
  const display = toAllowanceDisplay(state);
  const Icon = ALLOWANCE_ICON[state];
  return (
    <Badge variant={ALLOWANCE_BADGE_VARIANT[state]} className="gap-1 shrink-0">
      <Icon className="size-3" />
      {t(display.labelKey)}
    </Badge>
  );
}
