// duplicated in the backend

export type AddressParts = {
  street?: string | null | undefined;
  zipCode?: string | null | undefined;
  city?: string | null | undefined;
};

/**
 * Formats street + zip/city for display. Blank parts are skipped.
 * Default separator is a newline (multi-line block); pass e.g. `', '` for inline.
 */
export function formatAddress(
  parts: AddressParts | null | undefined,
  separator = ', ',
): string {
  if (parts == null) return '';
  const zipCity = [parts.zipCode?.trim(), parts.city?.trim()]
    .filter(Boolean)
    .join(' ');
  return [parts.street?.trim(), zipCity || undefined]
    .filter(Boolean)
    .join(separator);
}
