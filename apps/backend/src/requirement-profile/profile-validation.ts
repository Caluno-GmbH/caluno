import { BadRequestGraphQLError } from '../graphql/errors';
import { GENDER_OPTION_VALUES } from './constants';

/** A human label for a system key, used in validation error messages. */
export const formatProfileKeyLabel = (profileKey: string): string => {
  switch (profileKey) {
    case 'firstname':
      return 'First name';
    case 'lastname':
      return 'Last name';
    case 'preferredName':
      return 'Preferred name';
    case 'birthdate':
      return 'Birth date';
    case 'iban':
      return 'IBAN';
    case 'accountHolder':
      return 'Account holder';
    case 'bic':
      return 'BIC';
    default:
      return profileKey;
  }
};

/**
 * Per-key validation for the profile system fields, shared by the form
 * submission path and the `updateMyProfile` mutation (the volunteer's
 * identity/banking edit form). Modelled on the frontend validator so a profile
 * value accepted client-side is accepted here too, and vice versa.
 */
export const validateProfileKeyValue = (
  value: string,
  profileKey: string,
  label: string,
  minAge: number | null,
): void => {
  // Empty means "no value yet" — not an invalid value. Profile fields can be
  // left blank and are only enforced at the point they're actually needed (the
  // document sign gate), so don't reject an empty optional field here.
  if (!value) return;

  switch (profileKey) {
    case 'firstname':
    case 'lastname':
    case 'preferredName':
    case 'city':
      if (value.length > 100)
        throw new BadRequestGraphQLError(
          `"${label}": must be 100 characters or fewer`,
        );
      if (!/^[\p{L}\p{M}'\- ]+$/u.test(value))
        throw new BadRequestGraphQLError(
          `"${label}": contains invalid characters`,
        );
      break;
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)
        throw new BadRequestGraphQLError(
          `"${label}": must be a valid email address`,
        );
      break;
    case 'phone':
      if (!/^\+?[\d\s\-().]{7,20}$/.test(value))
        throw new BadRequestGraphQLError(
          `"${label}": must be a valid phone number`,
        );
      break;
    case 'street':
      if (value.length > 200)
        throw new BadRequestGraphQLError(
          `"${label}": must be 200 characters or fewer`,
        );
      break;
    case 'zip':
      if (!/^[A-Z0-9\- ]{3,10}$/i.test(value))
        throw new BadRequestGraphQLError(
          `"${label}": must be a valid postal code`,
        );
      break;
    case 'gender':
      if (!(GENDER_OPTION_VALUES as readonly string[]).includes(value))
        throw new BadRequestGraphQLError(
          `"${label}": must be one of the available gender options`,
        );
      break;
    case 'birthdate':
      if (minAge !== null && minAge !== undefined) {
        const birth = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (
          today.getMonth() < birth.getMonth() ||
          (today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate())
        ) {
          age--;
        }
        if (age < minAge)
          throw new BadRequestGraphQLError(
            `You must be at least ${minAge} years old`,
          );
      }
      break;
    case 'iban': {
      const iban = value.replace(/\s+/g, '').toUpperCase();
      if (iban.length > 34 || !isValidIban(iban))
        throw new BadRequestGraphQLError(`"${label}": must be a valid IBAN`);
      break;
    }
    case 'bic': {
      const bic = value.replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))
        throw new BadRequestGraphQLError(`"${label}": must be a valid BIC`);
      break;
    }
  }
};

/** Full IBAN mod-97 checksum — matches the frontend validator. */
const isValidIban = (iban: string): boolean => {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const numeric = [...rearranged]
    .map((ch) => (/[A-Z]/.test(ch) ? (ch.charCodeAt(0) - 55).toString() : ch))
    .join('');
  let remainder = '';
  for (const digit of numeric) {
    const n = Number.parseInt(`${remainder}${digit}`, 10);
    remainder = (n % 97).toString();
  }
  return remainder === '1';
};
