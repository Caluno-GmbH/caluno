import { Badge } from '@repo/ui';
import {
  CircleAlert,
  CircleCheck,
  FileWarning,
  TriangleAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VolunteerAllowanceState } from '../allowance-display';

/**
 * One row per state: never colour-only, each state has its own label and icon.
 * `labelKey` is under `Shift.transferList.allowance`.
 */
const ALLOWANCE_BADGE: Record<
  VolunteerAllowanceState,
  {
    labelKey: 'eligible' | 'nearlyExhausted' | 'wouldExceed' | 'noAgreement';
    icon: typeof CircleCheck;
    variant: 'success' | 'info' | 'destructive';
  }
> = {
  ELIGIBLE: { labelKey: 'eligible', icon: CircleCheck, variant: 'success' },
  NEARLY_EXHAUSTED: {
    labelKey: 'nearlyExhausted',
    icon: TriangleAlert,
    variant: 'info',
  },
  WOULD_EXCEED: {
    labelKey: 'wouldExceed',
    icon: CircleAlert,
    variant: 'destructive',
  },
  NO_AGREEMENT: { labelKey: 'noAgreement', icon: FileWarning, variant: 'info' },
};

export function AllowanceBadge({ state }: { state: VolunteerAllowanceState }) {
  const t = useTranslations('Shift.transferList.allowance');
  const { labelKey, icon: Icon, variant } = ALLOWANCE_BADGE[state];
  return (
    <Badge variant={variant} className="gap-1 shrink-0">
      <Icon className="size-3" />
      {t(labelKey)}
    </Badge>
  );
}
