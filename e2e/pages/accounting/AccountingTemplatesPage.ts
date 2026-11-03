import { expect, type Page } from '@playwright/test';
import { BASE_URL } from '../AuthPage';

export type PauschalenType = 'ehrenamt' | 'uebungsleiter';
export type TemplateKind = 'contract' | 'invoice';

// URL slugs are `${pauschale}spauschale-${kind}` (see template/types.ts
// SLUG_TO_SLOT on the frontend).
const PAUSCHALE_SLUG: Record<PauschalenType, string> = {
  ehrenamt: 'ehrenamtspauschale',
  uebungsleiter: 'uebungsleiterpauschale',
};

// The builder's provenance hint for a template that is not the unit's own
// (messages `Accounting.templates.builder.provenance.*`): inherited from an
// ancestor unit, the org-wide template, or the org-wide template seen from the
// root unit.
const INHERITED_HINT =
  /inherited from|is the organisation-wide template|creates this organisation's own version/;

// The period picker always prints in German regardless of locale (see
// `MONTH_NAMES_DE`/`MONTH_NAMES_FULL_DE` in builder-period-picker.tsx): the
// Month tab's own buttons carry the abbreviation, the trigger's displayed
// value once set carries the full name.
const MONTH_ABBR_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];
const MONTH_FULL_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/**
 * The accounting settings → templates tab and the per-slot builder
 * (`/admin/[orgUId]/accounting/settings/templates/<slug>`). Used to seed an
 * org's templates when a suite cannot rely on the fixtures providing them.
 *
 * The dev DB is stateful, so the spec using this page can `resetTemplates()`
 * first (soft-deletes every active template for the org through the app's own
 * GraphQL API) to guarantee the "no templates" onboarding state.
 */
export class AccountingTemplatesPage {
  private orgUnitId: string | null = null;
  private graphqlUrl: string | null = null;

  constructor(private readonly page: Page) {
    // Capture the app's GraphQL endpoint (the frontend talks to the API
    // directly, so it is not derivable from BASE_URL alone).
    page.on('request', (request) => {
      if (this.graphqlUrl || request.method() !== 'POST') return;
      const url = new URL(request.url());
      if (url.pathname === '/graphql') {
        this.graphqlUrl = `${url.origin}/graphql`;
      }
    });
  }

  async goto(orgUnitId: string) {
    this.orgUnitId = orgUnitId;
    await this.page.goto(
      `${BASE_URL}/en/admin/${orgUnitId}/accounting/settings?tab=templates`,
      { waitUntil: 'load' },
    );
  }

  setupAlert() {
    // Next.js renders an empty route announcer with role="alert" too; the
    // setup alert is the one carrying a CTA link.
    return this.page
      .getByRole('alert')
      .filter({ has: this.page.getByRole('link') });
  }

  async expectSetupAlert() {
    await expect(this.setupAlert()).toBeVisible();
  }

  async expectNoSetupAlert() {
    await expect(this.setupAlert()).toHaveCount(0);
  }

  private requireOrgUnitId(): string {
    if (!this.orgUnitId) {
      throw new Error('AccountingTemplatesPage.goto(orgUnitId) must run first');
    }
    return this.orgUnitId;
  }

  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.graphqlUrl) {
      throw new Error('GraphQL endpoint was not observed from the app yet');
    }
    const response = await this.page.request.post(this.graphqlUrl, {
      headers: { 'x-organization-unit-id': this.requireOrgUnitId() },
      data: { query, variables },
    });
    const body = (await response.json()) as {
      data?: T;
      errors?: unknown[];
    };
    if (body.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(body.errors)}`);
    }
    return body.data as T;
  }

  /**
   * Soft-deletes every active template of the org, returning the org to the
   * no-templates state the onboarding gate expects. There is no delete action
   * in the UI, so this goes through the app's own GraphQL API with the page's
   * authenticated session.
   */
  async resetTemplates() {
    const data = await this.graphql<{ documentTemplates: { id: string }[] }>(
      'query { documentTemplates { id } }',
    );
    for (const template of data.documentTemplates) {
      await this.graphql(
        'mutation($id: ID!) { deleteDocumentTemplate(id: $id) }',
        { id: template.id },
      );
    }
  }

  private builderUrl(pauschale: PauschalenType, kind: TemplateKind): string {
    return `${BASE_URL}/en/admin/${this.requireOrgUnitId()}/accounting/settings/templates/${PAUSCHALE_SLUG[pauschale]}-${kind}`;
  }

  /**
   * Makes sure a slot is set up for the unit, then returns once the app is
   * back on the templates list. A fresh slot is saved from its preset: the
   * contract builder's Save stays disabled until its manual fields (task
   * description, period, hours) are filled; the invoice builder is saveable
   * as-is. A slot that resolves to an inherited or org-wide template (the
   * Testing seed has org-wide ones) is already set up: its Save stays disabled
   * until the document differs, so the helper leaves without saving.
   */
  async configureTemplate(pauschale: PauschalenType, kind: TemplateKind) {
    await this.page.goto(this.builderUrl(pauschale, kind), {
      waitUntil: 'load',
    });

    const save = this.page.getByRole('button', { name: 'Save template' });
    await expect(save).toBeVisible();

    // A slot that is already configured loads its saved body, so its manual
    // fields are filled and Save is enabled — filling them again would fail
    // (the period trigger then reads the saved range, not the placeholder).
    // Only fill the contract's required non-period manual fields on a fresh
    // slot; the period itself is handled below regardless of freshness.
    if (kind === 'contract' && (await save.isDisabled())) {
      await this.page
        .getByRole('textbox', { name: 'Task description' })
        .fill('Support community events');
      await this.setContractPeriodToCurrentMonth();
      await this.page.getByRole('spinbutton', { name: 'Hours' }).fill('10');
    }

    // An unchanged inherited or org-wide template cannot be saved (it would
    // only duplicate the original), so Save stays disabled. The provenance
    // hint says why; wait for it so a still-loading builder is not mistaken
    // for a fresh slot.
    const inheritedHint = this.page.getByText(INHERITED_HINT);
    const inherited = await inheritedHint
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (inherited && (await save.isDisabled())) {
      await this.page.getByRole('link', { name: 'Cancel' }).click();
    } else {
      // The contract must cover the day the suite runs: VOLI-1370 reads an
      // ACTIVE contract whose period has already ended as Expired. A slot
      // saved on an earlier day (stateful dev DB, or staging across runs)
      // loads already-configured and enabled — the fresh-slot branch above
      // never ran — so its saved period can still be stale here. Refresh it
      // to the current month whenever it doesn't already cover today; a
      // freshly-filled slot already does, so this is then a cheap no-op.
      if (
        kind === 'contract' &&
        !(await this.contractPeriodCoversCurrentMonth())
      ) {
        await this.setContractPeriodToCurrentMonth();
      }
      await expect(save).toBeEnabled();
      await save.click();
    }

    await this.page.waitForURL(/accounting\/settings\?tab=templates/, {
      timeout: 20_000,
    });
  }

  /**
   * The contract builder's "Agreement period" field trigger. It is the only
   * `button` manual-field control on this page (the others are text/number
   * inputs), and `aria-required` on it is stable whether the field is still
   * showing its placeholder or already reads a saved value — unlike its
   * accessible name, which becomes the formatted period once set.
   */
  private contractPeriodTrigger() {
    return this.page.locator('button[aria-required="true"]');
  }

  /** Whether the saved/displayed period already spans the whole current month. */
  private async contractPeriodCoversCurrentMonth(): Promise<boolean> {
    const today = new Date();
    const expected = `${MONTH_FULL_DE[today.getMonth()]} ${today.getFullYear()}`;
    const text = (await this.contractPeriodTrigger().textContent()) ?? '';
    return text.includes(expected);
  }

  /**
   * Opens the period picker and sets it to the whole current month via the
   * Month tab — a single click on the month's own button, applied
   * immediately. The Period (range) tab's day-grid can need a 6th calendar
   * row depending on which weekday the 1st falls on, which this suite's
   * 1280×720 viewport does not always have room for; the Month tab has no
   * such overflow risk and a whole month is exactly what's wanted here.
   */
  private async setContractPeriodToCurrentMonth() {
    await this.contractPeriodTrigger().click();
    const popover = this.page.locator('[data-slot="popover-content"]');
    await popover.getByRole('tab', { name: 'Month' }).click();

    const today = new Date();
    await popover
      .getByRole('button', {
        name: MONTH_ABBR_DE[today.getMonth()],
        exact: true,
      })
      .click();
  }
}
