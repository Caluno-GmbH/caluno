import {
  checkPasswordPolicy,
  PASSWORD_TOO_SHORT,
  PASSWORD_TOO_WEAK,
} from './password-policy';

describe('checkPasswordPolicy', () => {
  it('rejects passwords below the minimum length', () => {
    expect(checkPasswordPolicy('Ab1!')).toMatchObject({
      code: PASSWORD_TOO_SHORT,
    });
  });

  it.each(['password', 'abcd1234', 'qwertzui'])(
    'rejects the weak password %s',
    (password) => {
      expect(checkPasswordPolicy(password)).toMatchObject({
        code: PASSWORD_TOO_WEAK,
      });
    },
  );

  it('accepts a long passphrase', () => {
    expect(checkPasswordPolicy('correct-horse-battery-staple')).toBeNull();
  });

  it('rejects passwords derived from the user details', () => {
    expect(
      checkPasswordPolicy('mustermann-2026', ['mustermann', 'max@example.com']),
    ).toMatchObject({ code: PASSWORD_TOO_WEAK });
  });
});
