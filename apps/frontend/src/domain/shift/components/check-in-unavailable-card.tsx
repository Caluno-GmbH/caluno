import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui';
import { ScanQrCode } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function CheckInUnavailableCard() {
  const t = await getTranslations('CheckIn');

  return (
    <div className="max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanQrCode className="size-5 text-muted-foreground" />
            {t('unavailableTitle')}
          </CardTitle>
          <CardDescription>{t('unavailableDescription')}</CardDescription>
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
