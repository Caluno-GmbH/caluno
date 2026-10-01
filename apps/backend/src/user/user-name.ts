/**
 * User display name is always `firstname + " " + lastname`.
 * Better Auth `users.name` is dual-written to that value.
 */
import { isBlank } from '../utils';

export function formatUserName(firstname: string, lastname: string): string {
  return `${firstname} ${lastname}`;
}

/**
 * Migration / backfill: derive mandatory firstname + lastname from existing
 * columns, then sync `name` to the concatenation.
 */
export function resolveNamesForBackfill(input: {
  name: string;
  firstname: string | null | undefined;
  lastname: string | null | undefined;
}): { firstname: string; lastname: string; name: string } {
  const name = input.name.trim();
  const hasFirst = !isBlank(input.firstname);
  const hasLast = !isBlank(input.lastname);

  let firstname: string;
  let lastname: string;

  if (hasFirst && hasLast) {
    firstname = input.firstname!.trim();
    lastname = input.lastname!.trim();
  } else if (hasFirst) {
    firstname = input.firstname!.trim();
    lastname = name;
  } else if (hasLast) {
    firstname = name;
    lastname = input.lastname!.trim();
  } else {
    const spaceIdx = name.indexOf(' ');
    if (spaceIdx === -1) {
      firstname = name;
      lastname = 'Lastname';
    } else {
      firstname = name.slice(0, spaceIdx);
      const rest = name.slice(spaceIdx + 1).trim();
      lastname = rest.length > 0 ? rest : 'Lastname';
    }
  }

  return {
    firstname,
    lastname,
    name: formatUserName(firstname, lastname),
  };
}
