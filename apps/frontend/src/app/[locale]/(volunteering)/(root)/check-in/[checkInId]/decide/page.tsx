import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import {
  Building2,
  Calendar,
  ChevronRight,
  LogIn,
  ScanQrCode,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { UserCard } from '@/components/user-card';
import { CheckInUnavailableCard } from '@/domain/shift/components/check-in-unavailable-card';
import { resolveDirectCheckOutEntryId } from '@/domain/shift/direct-check-out';
import { checkInPath, checkOutPath } from '@/domain/shift/routes';
import { Link, redirect } from '@/i18n/navigation';
import { getDataClient } from '@/lib/data-client';
import { getFormatting } from '@/lib/formatting/formatting-server';
import { getMyCheckInOrgUnits } from '@/lib/org-context-server';

interface DecidePageProps {
  params: Promise<{ locale: string; checkInId: string }>;
  searchParams: Promise<{ orgUId?: string }>;
}

export default async function VolunteeringDecidePage({
  params,
  searchParams,
}: DecidePageProps) {
  const { locale, checkInId } = await params;
  const { orgUId: orgUIdParam } = await searchParams;

  const checkInOrgUnits = await getMyCheckInOrgUnits();
  if (checkInOrgUnits.length === 0) {
    redirect({ href: '/check-in', locale });
  }

  const data = await getDataClient();
  const context = await data.timeEntry.getCheckInContext(checkInId);
  if (!context) {
    return <CheckInUnavailableCard />;
  }

  // The check-in page resolves its own org unit from the caller's
  // check-in:manage units; `orgUId` is forwarded only as a preference.
  const checkInHref = checkInPath(checkInId, orgUIdParam);

  // Nothing to check out -> straight to check-in.
  if (context.openTimeEntries.length === 0) {
    redirect({ href: checkInHref, locale });
  }

  // Exactly one open entry from today -> straight to check-out.
  const directEntryId = resolveDirectCheckOutEntryId(
    context.openTimeEntries,
    new Date(),
  );
  if (directEntryId) {
    redirect({
      href: checkOutPath(checkInId, directEntryId, orgUIdParam),
      locale,
    });
  }

  const t = await getTranslations('CheckIn');
  const tShiftCheckIn = await getTranslations('Shift.checkIn');
  const { formatDateTime } = await getFormatting();

  return (
    <div className="max-w-2xl px-4 py-8 space-y-6">
      <UserCard user={context.volunteer} size="lg" />

      <Card>
        <CardHeader>
          <CardTitle>{t('openEntriesTitle')}</CardTitle>
          <CardDescription>{t('openEntriesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {context.openTimeEntries.map((entry) => (
            <Link
              key={entry.id}
              href={checkOutPath(checkInId, entry.id, orgUIdParam)}
              className="flex items-center gap-2 rounded-lg border p-4 hover:bg-accent"
            >
              <ul className="flex-1 space-y-2">
                <li className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  {entry.organizationUnit.name}
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  {entry.shiftInstance
                    ? (entry.shiftInstance.overrideTitle ??
                      entry.shiftInstance.master.title)
                    : tShiftCheckIn('generalCheckIn')}
                </li>
                <li className="flex items-center gap-2">
                  <ScanQrCode className="size-4 text-muted-foreground" />
                  {tShiftCheckIn('checkedInAt', {
                    time: formatDateTime(new Date(entry.startedAt)),
                  })}
                </li>
              </ul>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('checkInSectionTitle')}</CardTitle>
          <CardDescription>{t('checkInSectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link href={checkInHref}>
              <LogIn /> {t('checkInButton')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
