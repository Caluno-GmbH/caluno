import { describe, expect, it } from 'bun:test';
import { resolveNextPath } from '../terms-next-path';

describe('resolveNextPath', () => {
  it('falls back to the root for missing values', () => {
    expect(resolveNextPath(null)).toBe('/');
    expect(resolveNextPath(undefined)).toBe('/');
    expect(resolveNextPath('')).toBe('/');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(resolveNextPath('https://evil.com')).toBe('/');
    expect(resolveNextPath('//evil.com')).toBe('/');
  });

  it('strips a leading supported locale prefix', () => {
    expect(resolveNextPath('/en')).toBe('/');
    expect(resolveNextPath('/de')).toBe('/');
    expect(resolveNextPath('/en/')).toBe('/');
    expect(resolveNextPath('/en/profile')).toBe('/profile');
    expect(resolveNextPath('/de/profile?tab=1')).toBe('/profile?tab=1');
    expect(resolveNextPath('/de/shifts/3')).toBe('/shifts/3');
  });

  it('keeps rooted relative paths without a locale', () => {
    expect(resolveNextPath('/profile')).toBe('/profile');
    expect(resolveNextPath('/profile?tab=1')).toBe('/profile?tab=1');
  });

  it('rejects a protocol-relative path exposed after stripping the locale', () => {
    expect(resolveNextPath('/en//evil.com')).toBe('/');
  });
});
