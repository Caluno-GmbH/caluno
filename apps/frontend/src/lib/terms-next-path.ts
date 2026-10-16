import { routing } from '@/i18n/routing';

export function resolveNextPath(value: string | null | undefined): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';

  const segments = value.slice(1).split('/');
  const first = segments[0] ?? '';
  const isLocale = (routing.locales as readonly string[]).includes(first);
  const stripped = isLocale ? `/${segments.slice(1).join('/')}` : value;

  if (!stripped.startsWith('/') || stripped.startsWith('//')) return '/';
  return stripped;
}
