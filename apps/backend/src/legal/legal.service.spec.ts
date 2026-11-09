import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StreamableFile } from '@nestjs/common';
import { LegalService } from './legal.service';

describe('LegalService', () => {
  it('streams the newest privacy policy PDF for the locale', () => {
    const dir = mkdtempSync(join(tmpdir(), 'legal-service-'));
    writeFileSync(join(dir, 'privacy-policy_2026-08-17_de.pdf'), 'old');
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_de.pdf'), 'new-de');
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_en.pdf'), 'new-en');

    const file = new LegalService(dir).streamCurrentPrivacyPolicy('en');
    const headers = file.getHeaders();

    expect(file).toBeInstanceOf(StreamableFile);
    expect(headers.type).toBe('application/pdf');
    expect(headers.disposition).toContain('privacy-policy_2026-08-25_en.pdf');
  });

  it('returns the date of the newest privacy notice', () => {
    const dir = mkdtempSync(join(tmpdir(), 'legal-service-date-'));
    writeFileSync(join(dir, 'privacy-policy_2026-08-17_de.pdf'), 'old');
    writeFileSync(join(dir, 'privacy-policy_2026-08-25_en.pdf'), 'new');

    expect(new LegalService(dir).getCurrentPrivacyNoticeDate()).toBe(
      '2026-08-25',
    );
  });

  it('throws when the legal directory has no privacy policy PDF', () => {
    const dir = mkdtempSync(join(tmpdir(), 'legal-service-empty-'));
    mkdirSync(join(dir, 'nested'));

    expect(() =>
      new LegalService(dir).streamCurrentPrivacyPolicy('de'),
    ).toThrow(/privacy policy/i);
  });
});
