import { containsPattern } from './string.util';

describe('containsPattern', () => {
  it('wraps plain text in wildcards', () => {
    expect(containsPattern('reading')).toBe('%reading%');
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
    expect(containsPattern('c:\\x')).toBe('%c:\\\\x%');
  });
});
