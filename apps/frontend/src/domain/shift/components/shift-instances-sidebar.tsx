import { JoinStatus, type PublicShiftInstance } from '@repo/data';
import { unstable_rethrow } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/routing';
import { getDataClient } from '@/lib/data-client';
import { logger } from '@/lib/logger';
import { ShiftActionCard } from './shift-action-card';
import type { Shift } from './shift-detail-content';

type ShiftInstancesSectionProps = {
  shift: Shift;
  isAuthenticated: boolean;
  autoJoin?: boolean;
  preselectedInstanceId?: string;
};

const orderInstances = (
  instances: PublicShiftInstance[],
  preselectedInstanceId?: string,
): PublicShiftInstance[] =>
  preselectedInstanceId
    ? [
        ...instances.filter(
          (instance) => instance.id === preselectedInstanceId,
        ),
        ...instances.filter(
          (instance) => instance.id !== preselectedInstanceId,
        ),
      ]
    : instances;

export const ShiftInstancesSidebar = async ({
  shift,
  isAuthenticated,
  autoJoin,
  preselectedInstanceId,
}: ShiftInstancesSectionProps) => {
  const locale = await getLocale();
  const data = await getDataClient({ locale: resolveLocale(locale) });

  let instances: PublicShiftInstance[];
  try {
    instances = await data.shift.findPublicInstancesByShiftId(shift.id);
  } catch (error) {
    unstable_rethrow(error);
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'ShiftInstancesSidebar: failed to load public instances',
    );
    const t = await getTranslations('ShiftDetail');
    return (
      <p className="text-sm text-muted-foreground">
        {t('instancesLoadFailed')}
      </p>
    );
  }

  return (
    <ShiftActionCard
      shiftId={shift.id}
      organizationUnitId={shift.organizationUnitId}
      instances={orderInstances(instances, preselectedInstanceId)}
      visibility={shift.visibility}
      isAuthenticated={isAuthenticated}
      autoJoin={autoJoin}
      preselectedInstanceId={preselectedInstanceId}
      masterMaxVolunteers={shift.maxVolunteers}
      masterJoinRequiresApproval={shift.joinRequiresApproval}
      membershipState={
        shift.organizationUnit?.myMembershipState ?? JoinStatus.None
      }
      shiftRequiredForms={shift.requiredForms?.map((ref) => ref.form)}
      organizationUnitRequiredForms={shift.organizationUnit?.requiredForms?.map(
        (ref) => ref.form,
      )}
    />
  );
};
