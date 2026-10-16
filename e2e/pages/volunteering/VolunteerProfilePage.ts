import { expect, type Page } from '@playwright/test';
import { BASE_URL } from '../AuthPage';

/**
 * The volunteer's profile — its "Your organizations" cards link into each
 * membership page, which holds "Your documents".
 */
export class VolunteerProfilePage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto(`${BASE_URL}/en/profile`, { waitUntil: 'load' });
  }

  /**
   * Opens the membership card for the given organisation and returns its
   * absolute URL so the caller can navigate straight to it. Name is required:
   * volunteers can belong to more than one org (e.g. leftover "Testing" from
   * other suites), and `.first()` would open the wrong documents list.
   */
  async openMembership(organizationName: string): Promise<string> {
    // Scope to the membership Card — a bare `div` filter matches a page-level
    // ancestor that contains every org's Open link (and the volunteer's name
    // can also mention the org, e.g. "Testing Member Two").
    const card = this.page
      .locator('[data-slot="card"]')
      .filter({
        has: this.page.getByText(organizationName, { exact: true }),
      })
      .filter({ has: this.page.getByRole('link', { name: 'Open' }) });
    await expect(card).toHaveCount(1);
    const link = card.getByRole('link', { name: 'Open' });
    const href = await link.getAttribute('href');
    if (!href) {
      throw new Error(`Membership card for ${organizationName} has no link`);
    }
    await link.click();
    await this.page.waitForURL(/\/en\/profile\/memberships\//, {
      timeout: 15_000,
    });
    return `${BASE_URL}${href}`;
  }
}
