import { mkdirSync } from 'node:fs';
import { type Browser, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../../../pages/AuthPage';
import { AccountingTemplatesPage } from '../../../pages/accounting/AccountingTemplatesPage';
import { AdminReimbursementsPage } from '../../../pages/accounting/AdminReimbursementsPage';
import { LoginPage } from '../../../pages/LoginPage';
import { VolunteerMembershipPage } from '../../../pages/volunteering/VolunteerMembershipPage';
import { VolunteerProfilePage } from '../../../pages/volunteering/VolunteerProfilePage';

// The whole document signing chain, both sides.
//
// Depends on the e2e seed (apps/backend/src/database/fixtures.ts, `bun run
// db:fixtures:e2e`): the Playground org has accounting enabled, reimbursement
// rates, and the fixture accounts below exist. Templates are no longer seeded
// (removed with the setup-gating change), so this suite configures the Ehrenamt
// contract + invoice templates itself in beforeAll. Runs against the default
// staging base URL like the other suites, or locally with
// E2E_BASE_URL=http://localhost:3000.
//
// Playground Member 02 is the volunteer (kept document-free in the fresh
// fixtures so the run's documents are uniquely identifiable); the admin is
// the Playground owner. Like the other auth-gated suites, sessions are
// authenticated once in beforeAll and persisted to .auth/ (storageState).
const ADMIN_EMAIL = 'demo+e2e_admin@caluno.org';
const VOLUNTEER_EMAIL = 'demo+e2e_member02@caluno.org';
const PASSWORD = 'abcd1234';
const VOLUNTEER_NAME = 'Playground Member 02';
const DECLINE_REASON = `E2E decline ${Date.now()}: Zeitraum stimmt nicht`;

const adminAuthFile = '.auth/accounting-admin.json';
const volunteerAuthFile = '.auth/accounting-volunteer.json';

async function saveAuthState(
  browser: Browser,
  email: string,
  authFile: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);
  await login.goto();
  await login.login(email, PASSWORD);
  await page.waitForURL(/\/en\/?$/, { timeout: 15_000 });
  await context.storageState({ path: authFile });
  await context.close();
}

test.describe('accounting documents flow — admin + volunteer', () => {
  test.beforeAll(async ({ browser }) => {
    mkdirSync('.auth', { recursive: true });
    await saveAuthState(browser, ADMIN_EMAIL, adminAuthFile);
    await saveAuthState(browser, VOLUNTEER_EMAIL, volunteerAuthFile);

    // Templates are no longer seeded, so configure the Ehrenamt pair the
    // document flow needs before the assertions run. Idempotent: when the slot
    // is already configured the builder re-saves the existing template.
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];
    const templates = new AccountingTemplatesPage(adminPage);
    await templates.goto(orgUnitId);
    await templates.configureTemplate('ehrenamt', 'contract');
    await templates.configureTemplate('ehrenamt', 'invoice');
    await adminContext.close();
  });

  test('volunteer completes missing profile details in a sheet from "My documents", then the card becomes signable', async ({
    browser,
  }) => {
    // ── Admin side: a fresh contract awaits the volunteer's signature ──────
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];
    const board = new AdminReimbursementsPage(adminPage);
    await board.goto(orgUnitId);
    await board.createContractFor(VOLUNTEER_NAME);
    await adminContext.close();

    const volunteerContext = await browser.newContext({
      storageState: volunteerAuthFile,
    });
    const volunteerPage = await volunteerContext.newPage();

    // The fixtures seed no zip/city; clear them anyway so the test is
    // re-runnable against a stateful dev DB where an earlier run filled them.
    // The reset goes through the same UpdateMyProfile mutation the profile
    // edit form submits (with the volunteer's session) — that form's Save
    // never enables today: its isValid flag stays false while the error map
    // stays empty, so the UI path cannot do the reset. Empty string is the
    // form's own "no value" for optional fields.
    const clearResponse = await volunteerPage.request.post(
      `${API_URL}/graphql`,
      {
        data: {
          query: `mutation ResetZipCity($input: UpdateMyProfileInput!) {
          updateMyProfile(input: $input) { id }
        }`,
          variables: { input: { zip: '', city: '' } },
        },
      },
    );
    expect(clearResponse.ok()).toBeTruthy();
    const clearBody = (await clearResponse.json()) as { errors?: unknown[] };
    expect(clearBody.errors).toBeUndefined();

    // ── My documents: Sign is disabled, "Complete details" opens the sheet ──
    await volunteerPage.goto(`${BASE_URL}/en/profile/documents`, {
      waitUntil: 'load',
    });
    const card = volunteerPage
      .locator(
        '[data-testid="volunteer-document-card"][data-state="awaiting-signature"]',
      )
      .first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(
      'Your profile is missing details this document needs.',
    );
    await expect(
      card.getByRole('button', { name: 'Sign', exact: true }),
    ).toBeDisabled();

    await card.getByRole('link', { name: 'Complete details' }).click();
    await volunteerPage.waitForURL(
      /\/en\/profile\/documents\/complete-profile\?kind=contract&id=[^&]+/,
      { timeout: 15_000 },
    );

    const sheet = volunteerPage.getByRole('dialog');
    await expect(sheet.getByText('Complete your details')).toBeVisible();

    // Only the missing fields render: postal code and city, no IBAN. The
    // sheet builds every field as required, and FieldRenderer appends the
    // marker to the label, so the accessible names read "Postal code *" /
    // "City *" — anchor on the prefix rather than the exact name.
    await expect(sheet.getByLabel(/^Postal code/)).toBeVisible();
    await expect(sheet.getByLabel(/^City/)).toBeVisible();
    await expect(sheet.getByLabel(/^IBAN/)).toHaveCount(0);

    await sheet.getByLabel(/^Postal code/).fill('10115');
    await sheet.getByLabel(/^City/).fill('Berlin');
    const save = sheet.getByRole('button', { name: 'Save changes' });
    await expect(save).toBeEnabled();
    const [saveResponse] = await Promise.all([
      volunteerPage.waitForResponse(
        (response) =>
          response.url().includes('/graphql') &&
          (response.request().postData() ?? '').includes('UpdateMyProfile'),
        { timeout: 20_000 },
      ),
      save.click(),
    ]);
    expect(saveResponse.ok()).toBeTruthy();

    // ── Back on My documents: the refreshed card is signable ───────────────
    await volunteerPage.waitForURL(/\/en\/profile\/documents$/, {
      timeout: 15_000,
    });
    // The sheet is gone — not left mounted in the @sheet slot, and not
    // swapped for the "all complete" message while closing.
    await expect(volunteerPage.getByRole('dialog')).toHaveCount(0);
    await expect(
      volunteerPage.getByText('All details are complete'),
    ).toHaveCount(0);
    const refreshed = volunteerPage
      .locator(
        '[data-testid="volunteer-document-card"][data-state="awaiting-signature"]',
      )
      .first();
    await expect(
      refreshed.getByRole('button', { name: 'Sign', exact: true }),
    ).toBeEnabled();
    await expect(
      refreshed.getByRole('link', { name: 'Complete details' }),
    ).toHaveCount(0);

    await volunteerContext.close();
  });

  test('admin creates → volunteer signs → admin countersigns → active; then a second document is declined with a reason', async ({
    browser,
  }) => {
    // ── Admin side ──────────────────────────────────────────────────────────
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();

    // /admin redirects to the admin's org; grab the org unit id from the URL.
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];

    const board = new AdminReimbursementsPage(adminPage);
    await board.goto(orgUnitId);
    await board.createContractFor(VOLUNTEER_NAME);

    // ── Volunteer side: the document is waiting for their signature ────────
    const volunteerContext = await browser.newContext({
      storageState: volunteerAuthFile,
    });
    const volunteerPage = await volunteerContext.newPage();

    const profile = new VolunteerProfilePage(volunteerPage);
    await profile.goto();
    const membershipUrl = await profile.openMembership();

    const membership = new VolunteerMembershipPage(volunteerPage);
    await membership.goto(membershipUrl);
    await membership.expectCardsVisible();
    await membership.signAwaitingCard();

    // ── Admin side: it has moved on and is waiting on them ──────────────────
    await board.countersignContract();

    // ── Volunteer side: fully signed, both signatures on the card ──────────
    await volunteerPage.reload({ waitUntil: 'load' });
    const signedCard = membership.cardForState('signed').first();
    await expect(signedCard).toContainText('Active');
    await expect(signedCard).toContainText('You signed on');
    await expect(signedCard).toContainText('countersigned on');
    const downloadButton = signedCard.getByRole('button', {
      name: 'Download',
    });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    // The signed PDF actually downloads (real render + stored file).
    const [volunteerDownload] = await Promise.all([
      volunteerPage.waitForEvent('download', { timeout: 15_000 }),
      downloadButton.click(),
    ]);
    expect(volunteerDownload.suggestedFilename()).toMatch(/\.pdf$/);

    // ── Admin side: the countersigned document's PDF downloads too ─────────
    await board.openFirstContractSheet();
    const adminSheet = board.documentSheet();
    const sheetDownload = adminSheet.getByRole('button', {
      name: 'Download',
    });
    await expect(sheetDownload).toBeEnabled();
    const [adminDownload] = await Promise.all([
      adminPage.waitForEvent('download', { timeout: 15_000 }),
      sheetDownload.click(),
    ]);
    expect(adminDownload.suggestedFilename()).toMatch(/\.pdf$/);
    await adminPage.keyboard.press('Escape');

    // ── Second document: the volunteer declines it with a reason ───────────
    await board.createContractFor(VOLUNTEER_NAME);
    await volunteerPage.reload({ waitUntil: 'load' });
    await membership.declineAwaitingCard(DECLINE_REASON);

    // The org's dashboard reads Declined, attributed to the volunteer, with
    // the reason shown in full.
    await board.expectDeclinedWithReason(DECLINE_REASON);

    await adminContext.close();
    await volunteerContext.close();
  });

  test('profile dropdown leads to the cross-org "My documents" page, whose badge matches the cards awaiting the signature', async ({
    browser,
  }) => {
    // The preceding test resolves every document it creates, so create one
    // awaiting the volunteer's signature first — otherwise the badge count is
    // zero and the equality below verifies nothing.
    const adminContext = await browser.newContext({
      storageState: adminAuthFile,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/en/admin`, { waitUntil: 'load' });
    await adminPage.waitForURL(/\/en\/admin\/[^/]+/, { timeout: 20_000 });
    const orgUnitId = new URL(adminPage.url()).pathname.split('/')[3];
    const board = new AdminReimbursementsPage(adminPage);
    await board.goto(orgUnitId);
    await board.createContractFor(VOLUNTEER_NAME);
    await adminContext.close();

    const volunteerContext = await browser.newContext({
      storageState: volunteerAuthFile,
    });
    const volunteerPage = await volunteerContext.newPage();

    // Volunteer home → avatar dropdown → "My documents".
    await volunteerPage.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
    await volunteerPage.getByRole('button', { name: 'Profile' }).click();
    const dropdownDocuments = volunteerPage.getByRole('button', {
      name: /My documents/,
    });
    await expect(dropdownDocuments).toBeVisible();

    // The badge (red dot with a number) counts documents needing the
    // volunteer's signature across all orgs. It is the role="img" whose
    // accessible name carries the count. Match on that rather than the first
    // bare-number span, which also catches the home day-strip day numbers.
    const badge = volunteerPage.getByRole('img', {
      name: /documents need your signature/,
    });
    await expect(badge).toBeVisible();
    const badgeLabel = await badge.getAttribute('aria-label');
    const badgeCount = Number(badgeLabel?.match(/\d+/)?.[0] ?? 0);
    expect(badgeCount).toBeGreaterThan(0);

    await dropdownDocuments.click();
    await volunteerPage.waitForURL(/\/en\/profile\/documents/, {
      timeout: 15_000,
    });
    await expect(
      volunteerPage.getByText('My documents', { exact: true }),
    ).toBeVisible();

    // The org accordions are open by default; count the cards awaiting the
    // signature across all of them — the badge number must match. The list
    // paginates (three cards per org at first), so expand it fully first;
    // leftovers from earlier runs against a stateful dev DB would otherwise
    // sit behind the "Load more" button while the badge counts them all.
    const awaitingCards = volunteerPage.locator(
      '[data-testid="volunteer-document-card"][data-state="awaiting-signature"]',
    );
    await expect(awaitingCards.first()).toBeVisible();
    const loadMore = volunteerPage.getByRole('button', { name: /Load more/ });
    while (await loadMore.isVisible().catch(() => false)) {
      const before = await loadMore.textContent();
      await loadMore.click();
      // Each click reveals the next batch of documents (any state); the
      // loop ends when the button disappears or its remaining count drops.
      await expect
        .poll(
          async () =>
            (await loadMore.isVisible().catch(() => false))
              ? await loadMore.textContent()
              : null,
          { timeout: 10_000 },
        )
        .not.toBe(before);
    }
    const awaitingCount = await awaitingCards.count();
    expect(awaitingCount).toBe(badgeCount);

    await volunteerContext.close();
  });
});
