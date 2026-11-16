import type { Metadata, Viewport } from 'next';
import { Geologica, Merriweather, Source_Code_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from '@/components/theme-provider';
import { routing } from '@/i18n/routing';

import '../globals.css';
import { Toaster } from '@/components/toaster';

const geologica = Geologica({
  variable: '--font-geologica-sans',
  subsets: ['latin'],
});

const merriweather = Merriweather({
  variable: '--font-merriweather-serif',
  subsets: ['latin'],
});

const sourceCodePro = Source_Code_Pro({
  variable: '--font-sourcecodepro-mono',
  subsets: ['latin'],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  const isProduction =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production';
  const s = isProduction ? '' : '-dev';

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
    ),
    title: t('title'),
    description: t('description'),
    icons: {
      // sizes on the .ico makes Chrome prefer the .svg when available
      icon: [
        { url: `/favicon${s}.ico`, sizes: '32x32' },
        { url: `/icon${s}.svg`, type: 'image/svg+xml' },
      ],
      apple: `/apple-touch-icon${s}.png`,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#CB4A4C',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale segment.
  setRequestLocale(locale);

  // ship the full message catalog to the client provider.
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geologica.variable} ${merriweather.variable} ${sourceCodePro.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <NuqsAdapter>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </NuqsAdapter>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
