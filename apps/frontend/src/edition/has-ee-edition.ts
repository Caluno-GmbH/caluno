/**
 * Hosted / private builds set NEXT_PUBLIC_CALUNO_EDITION=ee.
 * OSS mirrors leave it unset — EE UI stays hidden.
 */
export function hasEeEdition(): boolean {
  return process.env.NEXT_PUBLIC_CALUNO_EDITION === 'ee';
}
