import { describe, expect, it } from 'bun:test';
import { API_URL } from '../constants';
import { buildSignupPayload, PRIVACY_POLICY_PDF_URL } from '../privacy-policy';

describe('privacy policy signup payload', () => {
  it('links the stable backend privacy policy PDF', () => {
    expect(PRIVACY_POLICY_PDF_URL).toBe(`${API_URL}/legal/privacy-policy.pdf`);
  });

  it('includes name parts and synced name when accepted', () => {
    expect(
      buildSignupPayload({
        firstname: '  Ada ',
        lastname: ' Lovelace ',
        email: 'ada@example.com',
        password: 'secret1',
        privacyAccepted: true,
        termsAccepted: true,
      }),
    ).toEqual({
      firstname: 'Ada',
      lastname: 'Lovelace',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'secret1',
      privacyPolicyAccepted: true,
      termsAccepted: true,
    });
  });

  it('returns null when the privacy checkbox is not accepted', () => {
    expect(
      buildSignupPayload({
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
        password: 'secret1',
        privacyAccepted: false,
        termsAccepted: true,
      }),
    ).toBeNull();
  });

  it('returns null when the terms checkbox is not accepted', () => {
    expect(
      buildSignupPayload({
        firstname: 'Ada',
        lastname: 'Lovelace',
        email: 'ada@example.com',
        password: 'secret1',
        privacyAccepted: true,
        termsAccepted: false,
      }),
    ).toBeNull();
  });

  it('returns null when a name part is blank', () => {
    expect(
      buildSignupPayload({
        firstname: '  ',
        lastname: 'Lovelace',
        email: 'ada@example.com',
        password: 'secret1',
        privacyAccepted: true,
        termsAccepted: true,
      }),
    ).toBeNull();
  });
});
