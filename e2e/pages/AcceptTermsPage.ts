import { expect, type Page } from '@playwright/test';

// /accept-terms — scroll-gated PDF acceptance after login (or deep link).
export class AcceptTermsPage {
  constructor(private readonly page: Page) {}

  get scroll() {
    return this.page.getByTestId('terms-scroll');
  }

  get acceptButton() {
    return this.page.getByRole('button', { name: 'Accept and continue' });
  }

  static isOnPage(page: Page): boolean {
    return page.url().includes('/accept-terms');
  }

  // Scroll to the end (PDF pages append as they render), then accept and leave.
  async accept() {
    await expect(this.scroll.locator('canvas').first()).toBeVisible({
      timeout: 20_000,
    });

    await expect(async () => {
      await this.scroll.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      await expect(this.acceptButton).toBeEnabled({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    await this.acceptButton.click();
    await this.page.waitForURL(
      (url) => !url.pathname.includes('/accept-terms'),
      { timeout: 30_000, waitUntil: 'commit' },
    );
  }
}
