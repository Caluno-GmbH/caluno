import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  latestPrivacyPolicyVersionFromFilenames,
  resolvePrivacyPolicyDocument,
} from './privacy-policy-files';

describe('latestPrivacyPolicyVersionFromFilenames', () => {
  it('picks the newest privacy-policy_YYYY-MM-DD_<locale>.pdf', () => {
    expect(
      latestPrivacyPolicyVersionFromFilenames([
        'privacy-policy_2026-08-17_de.pdf',
        'readme.txt',
        'privacy-policy_2026-08-25_en.pdf',
        'privacy-policy_not-a-date_de.pdf',
        'privacy-policy_2026-08-25_de.pdf',
      ]),
    ).toBe('2026-08-25');
  });

  it('throws when no matching privacy policy PDF exists', () => {
    expect(() => latestPrivacyPolicyVersionFromFilenames(['notes.md'])).toThrow(
      /privacy policy/i,
    );
  });
});

describe('resolvePrivacyPolicyDocument', () => {
  it('resolves version and path for the requested locale', () => {
    const dir = mkdtempSync(join(tmpdir(), 'privacy-policy-'));
    writeFileSync(join(dir, 'privacy-policy_2026-08-17_de.pdf'), 'old');
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_de.pdf'), 'new-de');
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_en.pdf'), 'new-en');
    mkdirSync(join(dir, 'nested'));

    const document = resolvePrivacyPolicyDocument(dir, 'en');

    expect(document.version).toBe('2026-08-25');
    expect(document.locale).toBe('en');
    expect(document.filename).toBe('privacy-policy_2026-08-25_en.pdf');
    expect(document.path).toBe(join(dir, 'privacy-policy_2026-08-25_en.pdf'));
  });

  it('throws when the current version has no file for the locale', () => {
    const dir = mkdtempSync(join(tmpdir(), 'privacy-policy-missing-'));
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_de.pdf'), 'de-only');

    expect(() => resolvePrivacyPolicyDocument(dir, 'en')).toThrow(/locale en/i);
  });
});
