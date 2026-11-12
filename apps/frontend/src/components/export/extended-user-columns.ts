import type { ExportColumnOption } from './export-column-option';

export const EXTENDED_USER_GROUP = 'extendedUserInfo';

export type ExtendedUserFieldKey =
  | 'dateOfBirth'
  | 'gender'
  | 'phone'
  | 'address';

const EXTENDED_USER_FIELDS: Array<
  Omit<ExportColumnOption, 'label' | 'description'> & {
    profileKey: ExtendedUserFieldKey;
  }
> = [
  {
    id: 'volunteerDateOfBirth',
    profileKey: 'dateOfBirth',
    optional: true,
    defaultOn: false,
    group: EXTENDED_USER_GROUP,
  },
  {
    id: 'volunteerGender',
    profileKey: 'gender',
    optional: true,
    defaultOn: false,
    group: EXTENDED_USER_GROUP,
  },
  {
    id: 'volunteerPhone',
    profileKey: 'phone',
    optional: true,
    defaultOn: false,
    group: EXTENDED_USER_GROUP,
  },
  {
    id: 'volunteerAddress',
    profileKey: 'address',
    optional: true,
    defaultOn: false,
    group: EXTENDED_USER_GROUP,
  },
];

export function extendedUserColumnMetas(
  alreadyPresent: ReadonlySet<ExtendedUserFieldKey>,
): Array<
  Omit<ExportColumnOption, 'label' | 'description'> & {
    profileKey: ExtendedUserFieldKey;
  }
> {
  return EXTENDED_USER_FIELDS.filter(
    (field) => !alreadyPresent.has(field.profileKey),
  );
}
