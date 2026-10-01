import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { HomeHeader } from '@/components/navigation/home-header';
import { requireAuth } from '@/lib/auth-server';
import { getDataClient } from '@/lib/data-client';

interface RootPagesLayoutProps {
  children: ReactNode;
}

export default async function RootPagesLayout({
  children,
}: RootPagesLayoutProps) {
  await requireAuth();
  const t = await getTranslations('Common');
  const me = await getDataClient().then((data) => data.user.getMe());

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 w-full">
        <HomeHeader
          title={t('greeting', { name: me.name })}
          avatarUrl={me.image ?? undefined}
          avatarName={me.name}
        />
      </div>
      <div className="mx-auto w-full max-w-4xl px-6 pt-36 pb-4">{children}</div>
    </>
  );
}
