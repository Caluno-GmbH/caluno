import { FieldType } from '@repo/data';

export type SystemProfileField = {
  key: string;
  labelKey: string;
  type: FieldType;
};

export const SYSTEM_PROFILE_FIELDS: readonly SystemProfileField[] = [
  {
    key: 'preferred-name',
    labelKey: 'preferredName',
    type: FieldType.Text,
  },
  { key: 'name', labelKey: 'firstName', type: FieldType.Name },
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
    key: 'birth-date',
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
    key: 'account-holder',
    labelKey: 'accountHolder',
    type: FieldType.Text,
  },
  { key: 'bic', labelKey: 'bic', type: FieldType.Text },
  {
    key: 'tax-id',
    labelKey: 'taxId',
    type: FieldType.Text,
  },
];
