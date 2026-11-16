import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const isProduction =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'production';
  const s = isProduction ? '' : '-dev';

  return {
    name: isProduction ? 'Caluno' : 'Caluno (Dev)',
    short_name: 'Caluno',
    start_url: '/',
    display: 'standalone',
    theme_color: '#CB4A4C',
    background_color: '#F2F6F7',
    icons: [
      { src: `/icon-192${s}.png`, type: 'image/png', sizes: '192x192' },
      { src: `/icon-512${s}.png`, type: 'image/png', sizes: '512x512' },
      {
        src: `/icon-512${s}.png`,
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
  };
}
