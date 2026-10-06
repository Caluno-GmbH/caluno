import { describe, expect, it } from 'bun:test';
import { API_URL } from '../constants';
import { buildSignupPayload } from '../privacy-policy';
import { termsPdfUrl } from '../terms';

const base = {
  firstname: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.com',
  password: 'abcd1234',
};

describe('buildSignupPayload terms acceptance', () => {
  it('returns null when terms are not accepted', () => {
    expect(
      buildSignupPayload({
        ...base,
        privacyAccepted: true,
        termsAccepted: false,
      }),
    ).toBeNull();
  });

  it('includes termsAccepted when both are accepted', () => {
    expect(
      buildSignupPayload({
        ...base,
        privacyAccepted: true,
        termsAccepted: true,
      }),
    ).toMatchObject({ termsAccepted: true });
  });
});

describe('termsPdfUrl', () => {
  it('builds the backend terms URL for a locale', () => {
    expect(termsPdfUrl('en')).toBe(`${API_URL}/legal/terms/current/en`);
  });

  it('builds the source-locale URL', () => {
    expect(termsPdfUrl('de')).toBe(`${API_URL}/legal/terms/current/de`);
  });
});
