import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { ScanQrCode, ShieldAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

interface CheckInUnavailableCardProps {
  // `noPermission`: the caller holds check-in:manage in no org unit.
  reason?: 'notFound' | 'noPermission';
}

export async function CheckInUnavailableCard({
  reason = 'notFound',
}: CheckInUnavailableCardProps = {}) {
  const t = await getTranslations('CheckIn');
  const noPermission = reason === 'noPermission';

  return (
    <div className="max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {noPermission ? (
              <ShieldAlert className="size-5 text-muted-foreground" />
            ) : (
              <ScanQrCode className="size-5 text-muted-foreground" />
            )}
            {noPermission ? t('noPermissionTitle') : t('unavailableTitle')}
          </CardTitle>
          <CardDescription>
            {noPermission
              ? t('noPermissionDescription')
              : t('unavailableDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/check-in">{t('backToCheckInButton')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
