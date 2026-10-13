import { FieldType } from '@repo/data';

export type SystemProfileField = {
  key: string;
  labelKey: string;
  type: FieldType;
};

export const SYSTEM_PROFILE_FIELDS: readonly SystemProfileField[] = [
  {
    key: 'preferredName',
    labelKey: 'preferredName',
    type: FieldType.Text,
  },
  { key: 'firstname', labelKey: 'firstName', type: FieldType.Name },
  {
    key: 'lastname',
    labelKey: 'lastName',
    type: FieldType.Lastname,
  },
  {
    key: 'gender',
    labelKey: 'gender',
    type: FieldType.SingleChoice,
  },

  { key: 'email', labelKey: 'email', type: FieldType.Email },
  { key: 'phone', labelKey: 'phone', type: FieldType.Phone },
  {
    key: 'birthdate',
    labelKey: 'birthDate',
    type: FieldType.Date,
  },
  {
    key: 'street',
    labelKey: 'street',
    type: FieldType.Text,
  },
  { key: 'zip', labelKey: 'zipCode', type: FieldType.Zip },
  { key: 'city', labelKey: 'city', type: FieldType.Text },
  { key: 'iban', labelKey: 'iban', type: FieldType.Iban },
  {
    key: 'accountHolder',
    labelKey: 'accountHolder',
    type: FieldType.Text,
  },
  { key: 'bic', labelKey: 'bic', type: FieldType.Text },
];
