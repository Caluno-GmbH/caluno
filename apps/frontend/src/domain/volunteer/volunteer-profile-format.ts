export function calculateAge(
  birthdate: string | null | undefined,
  now: Date,
): number | null {
  if (!birthdate) return null;

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const birthYear = parsed.getUTCFullYear();
  const birthMonth = parsed.getUTCMonth();
  const birthDay = parsed.getUTCDate();

  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

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
  if (!birthdate) return '';
  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return '';
  const age = calculateAge(birthdate, now);
  if (age === null) return '';
  return `${formatDate(parsed)} · ${age}`;
}
