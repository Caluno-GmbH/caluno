/**
 * Map a User (or profile-shaped object) to the systemKey → value bag used by
 * requirement forms and personal-information UI.
 */
export function toProfileDataMap(
  user:
    | {
        firstname?: string | null;
        lastname?: string | null;
        preferredName?: string | null;
        gender?: string | null;
        email?: string | null;
        phone?: string | null;
        street?: string | null;
        zip?: string | null;
        city?: string | null;
        birthdate?: string | null;
        iban?: string | null;
        accountHolder?: string | null;
        bic?: string | null;
      }
    | null
    | undefined,
): Record<string, unknown> {
  if (!user) return {};
  const entries: Array<[string, string | null | undefined]> = [
    ['firstname', user.firstname],
    ['lastname', user.lastname],
    ['preferred-name', user.preferredName],
    ['gender', user.gender],
    ['email', user.email],
    ['phone', user.phone],
    ['street', user.street],
    ['zip', user.zip],
    ['city', user.city],
    ['birthdate', user.birthdate],
    ['iban', user.iban],
    ['account-holder', user.accountHolder],
    ['bic', user.bic],
  ];
  const data: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.trim() !== '') {
      data[key] = value;
    }
  }
  return data;
}

/** Convert a systemKey bag into UpdateMyProfileInput fields (no email). */
export function profileDataToUpdateInput(data: Record<string, unknown>): {
  firstname?: string | null;
  lastname?: string | null;
  preferredName?: string | null;
  gender?: string | null;
  phone?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthdate?: string | null;
  iban?: string | null;
  accountHolder?: string | null;
  bic?: string | null;
} {
  const str = (key: string): string | null | undefined => {
    if (!Object.hasOwn(data, key)) return undefined;
    const value = data[key];
    if (value === null) return null;
    return typeof value === 'string' ? value : undefined;
  };
  return {
    firstname: str('firstname'),
    lastname: str('lastname'),
    preferredName: str('preferred-name'),
    gender: str('gender'),
    phone: str('phone'),
    street: str('street'),
    zip: str('zip'),
    city: str('city'),
    birthdate: str('birthdate'),
    iban: str('iban'),
    accountHolder: str('account-holder'),
    bic: str('bic'),
  };
}
