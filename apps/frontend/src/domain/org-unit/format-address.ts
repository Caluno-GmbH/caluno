export type OrgAddressParts = {
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
};

/**
 * Formats street + zip/city for display. Blank parts are skipped.
 * Default separator is a newline (multi-line block); pass e.g. `', '` for inline.
 */
export function formatOrgAddress(
  parts: OrgAddressParts | null | undefined,
  separator = ', ',
): string {
  if (parts == null) return '';
  const zipCity = [parts.zipCode?.trim(), parts.city?.trim()]
    .filter(Boolean)
    .join(' ');
  return [parts.address?.trim(), zipCity || undefined]
    .filter(Boolean)
    .join(separator);
}
