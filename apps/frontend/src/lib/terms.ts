import type { Locale } from '@repo/data';
import { API_URL } from '@/lib/constants';

export function termsPdfUrl(locale: Locale): string {
  return `${API_URL}/legal/terms/current/${locale}`;
}

export function termsPdfVersionedUrl(version: string, locale: Locale): string {
  return `${API_URL}/legal/terms/${version}/${locale}`;
}
