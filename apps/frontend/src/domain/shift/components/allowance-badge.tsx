import { Badge, cn } from '@repo/ui';
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
 * Colours: eligible → --success; no agreement / nearly exhausted → --alert
 * (design-system warning); would exceed → --destructive.
 * `labelKey` is under `Shift.transferList.allowance`.
 */
const ALLOWANCE_BADGE: Record<
  VolunteerAllowanceState,
  {
    labelKey: 'eligible' | 'nearlyExhausted' | 'wouldExceed' | 'noAgreement';
    icon: typeof CircleCheck;
    variant: 'success' | 'alert' | 'destructive';
    className?: string;
  }
> = {
  ELIGIBLE: {
    labelKey: 'eligible',
    icon: CircleCheck,
    variant: 'success',
    className: 'text-success',
  },
  NEARLY_EXHAUSTED: {
    labelKey: 'nearlyExhausted',
    icon: TriangleAlert,
    variant: 'alert',
  },
  WOULD_EXCEED: {
    labelKey: 'wouldExceed',
    icon: CircleAlert,
    variant: 'destructive',
  },
  NO_AGREEMENT: {
    labelKey: 'noAgreement',
    icon: FileWarning,
    variant: 'alert',
  },
};

export function AllowanceBadge({ state }: { state: VolunteerAllowanceState }) {
  const t = useTranslations('Shift.transferList.allowance');
  const { labelKey, icon: Icon, variant, className } = ALLOWANCE_BADGE[state];
  const label = t(labelKey);
  return (
    <Badge
      variant={variant}
      title={label}
      className={cn('max-w-full min-w-0 shrink gap-1', className)}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
