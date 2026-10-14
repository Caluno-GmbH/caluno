import { describe, expect, it } from 'bun:test';
import { buildFieldSchema } from '../../requirement-form/components/field-renderer';
import {
  completeProfileDefaultValues,
  missingFieldsToRenderable,
} from './complete-profile-fields';

const labelFor = (labelKey: string) => `label:${labelKey}`;

const msgs = {
  fieldRequired: (l: string) => `${l} required`,
  mustBeNumber: (l: string) => `${l} number`,
  mustBeValidDate: (l: string) => `${l} date`,
  mustBeValidEmail: (l: string) => `${l} email`,
  mustBeValidPhone: (l: string) => `${l} phone`,
  invalidOptions: (l: string) => `${l} options`,
  maxChars: (l: string, m: number) => `${l} max ${m}`,
  invalidCharacters: (l: string) => `${l} chars`,
  validPostalCode: (l: string) => `${l} zip`,
  minAge: (a: number) => `min ${a}`,
  invalidIban: (l: string) => `${l} iban`,
  invalidBic: (l: string) => `${l} bic`,
  dateNotFuture: (l: string) => `${l} not future`,
};

describe('missingFieldsToRenderable', () => {
  it('renders exactly the missing fields, in SYSTEM_PROFILE_FIELDS order, all required', () => {
    const fields = missingFieldsToRenderable(
      ['iban', 'street', 'zip'],
      labelFor,
    );
    expect(fields.map((f) => f.id)).toEqual(['street', 'zip', 'iban']);
    expect(fields.every((f) => f.required)).toBe(true);
    expect(fields.map((f) => f.label)).toEqual([
      'label:street',
      'label:zipCode',
      'label:iban',
    ]);
  });

  it('rejects an invalid IBAN and zip, accepts valid ones', () => {
    // SYSTEM_PROFILE_FIELDS orders zip before iban regardless of input order.
    const fields = missingFieldsToRenderable(['iban', 'zip'], labelFor);
    expect(fields.map((f) => f.id)).toEqual(['zip', 'iban']);
    const [zipField, ibanField] = fields;
    if (!zipField || !ibanField) throw new Error('expected zip and iban');
    const zip = buildFieldSchema(zipField, true, msgs);
    const iban = buildFieldSchema(ibanField, true, msgs);
    expect(zip.safeParse('!!!').success).toBe(false);
    expect(zip.safeParse('10115').success).toBe(true);
    expect(iban.safeParse('DE00 0000 0000 0000 0000 00').success).toBe(false);
    expect(iban.safeParse('DE89 3704 0044 0532 0130 00').success).toBe(true);
  });

  it('rejects empty values — every field is required', () => {
    const [city] = missingFieldsToRenderable(['city'], labelFor);
    if (!city) throw new Error('expected city field');
    expect(buildFieldSchema(city, true, msgs).safeParse('').success).toBe(
      false,
    );
  });
});

describe('completeProfileDefaultValues', () => {
  it('prefills the account holder from the names, everything else empty', () => {
    expect(
      completeProfileDefaultValues(['street', 'accountHolder'], {
        firstname: 'Erika',
        lastname: 'Musterfrau',
      }),
    ).toEqual({ street: '', accountHolder: 'Erika Musterfrau' });
  });

  it('leaves the account holder empty when the names are unknown', () => {
    expect(
      completeProfileDefaultValues(['accountHolder'], {
        firstname: null,
        lastname: null,
      }),
    ).toEqual({ accountHolder: '' });
  });
});
