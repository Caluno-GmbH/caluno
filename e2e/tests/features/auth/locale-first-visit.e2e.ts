import { expect, test } from '@playwright/test';
import { BASE_URL } from '../../pages/AuthPage';

/**
 * First-visit locale detection (locale-browser-to-profile).
 * Logged-out visitors: Accept-Language → de|en, else de.
 * No account is created.
 */
test.describe('First-visit locale from Accept-Language', () => {
  test('en browser → /en/', async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/en(\/|$|\?)/);
    await context.close();
  });

  test('de browser → /de/', async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9' },
      locale: 'de-DE',
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/de(\/|$|\?)/);
    await context.close();
  });

  test('unsupported browser language → /de/', async ({ browser }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
      locale: 'fr-FR',
    });
    const page = await context.newPage();

    await page.goto(BASE_URL, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/de(\/|$|\?)/);
    await context.close();
  });
});

test.describe('Authenticated profile locale wins over browser', () => {
  test('caluno.locale=de overrides Accept-Language en on /en/', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      locale: 'en-US',
    });

    // Preference redirect only runs when a session cookie is present.
    await context.addCookies([
      {
        name: 'better-auth.session_token',
        value: 'e2e.locale.profile.override',
        url: BASE_URL,
      },
      {
        name: 'caluno.locale',
        value: 'de',
        url: BASE_URL,
      },
    ]);

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/de(\/|$|\?)/);
    await context.close();
  });
});
