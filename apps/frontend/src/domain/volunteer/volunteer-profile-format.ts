export function parseBirthdate(
  birthdate: string | null | undefined,
): Date | null {
  if (!birthdate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function calculateAge(
  birthdate: string | null | undefined,
  now: Date,
): number | null {
  const parsed = parseBirthdate(birthdate);
  if (parsed === null) return null;

  const birthYear = parsed.getFullYear();
  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const nowDay = now.getDate();

  let age = nowYear - birthYear;

  const birthdayPassedThisYear =
    nowMonth > birthMonth || (nowMonth === birthMonth && nowDay >= birthDay);

  if (!birthdayPassedThisYear) age -= 1;

  if (age < 0) return null;

  return age;
}

export function formatDateOfBirthWithAge(
  birthdate: string | null | undefined,
  now: Date,
  formatDate: (d: Date) => string,
): string {
  const parsed = parseBirthdate(birthdate);
  if (parsed === null) return '';
  const age = calculateAge(birthdate, now);
  if (age === null) return '';
  return `${formatDate(parsed)} · ${age}`;
}

export function formatVolunteerAddress(address: {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
}): string {
  const parts: string[] = [];
  if (address.street) parts.push(address.street);
  const zipCity = [address.zip, address.city].filter(Boolean).join(' ');
  if (zipCity) parts.push(zipCity);
  return parts.join(', ');
}
