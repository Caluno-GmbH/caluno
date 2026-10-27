import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import MessageFormat from '@messageformat/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { I18nModule } from 'nestjs-i18n';
import { DEFAULT_LOCALE } from '../graphql/locale';
import { AppI18nService, ICU_ARGUMENT_PATTERN } from './app-i18n.service';
import { formatLocaleDateTime } from './format-date-time';

const LOCALES_PATH = join(__dirname, 'locales');

function collectIcuMessages(
  value: unknown,
  path: string,
): Array<{ path: string; message: string }> {
  if (typeof value === 'string') {
    return ICU_ARGUMENT_PATTERN.test(value) ? [{ path, message: value }] : [];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      collectIcuMessages(child, `${path}.${key}`),
    );
  }
  return [];
}

const icuMessages = readdirSync(LOCALES_PATH).flatMap((locale) =>
  readdirSync(join(LOCALES_PATH, locale))
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) =>
      collectIcuMessages(
        JSON.parse(readFileSync(join(LOCALES_PATH, locale, file), 'utf8')),
        `${locale}/${file.replace(/\.json$/, '')}`,
      ).map((entry) => ({ ...entry, locale })),
    ),
);

describe('ICU messages in locale catalogs', () => {
  it('finds the plural messages in every locale', () => {
    expect(icuMessages.length).toBeGreaterThan(0);
    expect(new Set(icuMessages.map(({ locale }) => locale)).size).toBe(
      readdirSync(LOCALES_PATH).length,
    );
  });

  it.each(icuMessages)('$path compiles', ({ locale, message }) => {
    expect(() => new MessageFormat(locale).compile(message)).not.toThrow();
  });
});

describe('AppI18nService', () => {
  let moduleRef: TestingModule;
  let appI18n: AppI18nService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        I18nModule.forRoot({
          fallbackLanguage: DEFAULT_LOCALE,
          loaderOptions: {
            path: join(__dirname, 'locales'),
          },
        }),
      ],
      providers: [AppI18nService],
    }).compile();

    appI18n = moduleRef.get(AppI18nService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('translates with a full key path', () => {
    expect(
      appI18n.translate('en', 'email.passwordReset.subject', {
        brandName: 'Caluno',
      }),
    ).toBe('Reset your Caluno password');
  });

  it('scopes translators to a namespace', () => {
    const { t } = appI18n.createTranslator('de', 'email');

    expect(t('passwordReset.subject', { brandName: 'Caluno' })).toBe(
      'Setze dein Caluno-Passwort zurück',
    );
  });

  it('formats ICU plural messages', () => {
    const { t: tEn } = appI18n.createTranslator('en', 'email');
    const { t: tDe } = appI18n.createTranslator('de', 'email');

    expect(tEn('volunteerDigest.reasonNeedsMore', { count: 1 })).toBe(
      'Needs 1 more volunteer',
    );
    expect(tEn('volunteerDigest.reasonNeedsMore', { count: 3 })).toBe(
      'Needs 3 more volunteers',
    );
    expect(tDe('volunteerDigest.reasonNeedsMore', { count: 1 })).toBe(
      'Braucht noch 1 weiteren Freiwilligen',
    );
    expect(tDe('volunteerDigest.reasonNeedsMore', { count: 3 })).toBe(
      'Braucht noch 3 weitere Freiwillige',
    );
  });

  it('interpolates plain placeholders alongside ICU plurals', () => {
    const { t } = appI18n.createTranslator('en', 'email');

    expect(
      t('shiftInvited.periodWithCount', {
        startDate: '01.11.2026',
        endDate: '30.11.2026',
        count: 4,
      }),
    ).toBe('01.11.2026 – 30.11.2026 · 4 assignments');
  });
});

describe('formatLocaleDateTime', () => {
  it('formats dates in the recipient locale and Berlin timezone', () => {
    const formatted = formatLocaleDateTime(
      new Date('2026-07-01T10:00:00.000Z'),
      'de',
    );

    expect(formatted).toMatch(/01[./]07[./]2026/);
    expect(formatted).toMatch(/12:00/);
  });

  it('uses German regional date order for English copy', () => {
    const formatted = formatLocaleDateTime(
      new Date('2026-07-06T10:00:00.000Z'),
      'en',
    );

    expect(formatted).toMatch(/06[./]07[./]2026/);
    expect(formatted).not.toMatch(/^07[./]06/);
    expect(formatted).toMatch(/12:00/);
  });
});
