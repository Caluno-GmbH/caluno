import { API_URL } from '@/lib/constants';

export const TERMS_PDF_URL = `${API_URL}/legal/terms/current/de`;

export function termsPdfUrl(locale: string): string {
  return `${API_URL}/legal/terms/current/${locale}`;
}

export function termsPdfVersionedUrl(version: string, locale: string): string {
  return `${API_URL}/legal/terms/${version}/${locale}`;
}
