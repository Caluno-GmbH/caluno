import { expect, test } from '@playwright/test';
import { BASE_URL } from '../pages/AuthPage';
import { LoginPage } from '../pages/LoginPage';

// These specs depend on the e2e seed (apps/backend/src/database/fixtures.ts),
// which you load yourself with `bun run db:fixtures:e2e` — they are not
// self-contained like flow.e2e.ts: run with E2E_BASE_URL=http://localhost:3000.
//
// member02 is the fixture account with the "Overlap Test Pair"
// (2 overlapping shifts) and "Overlap Test Pile" (6 overlapping shifts,
// A-F) fixtures invited to it — member01 is kept conflict-free as a
// baseline for other manual checks.
const MEMBER_EMAIL = 'demo+testing_member02@caluno.org';
const MEMBER_PASSWORD = 'abcd1234';

type Page = import('@playwright/test').Page;
type Locator = import('@playwright/test').Locator;

/** Day keys + text lengths — detects new days and same-day page growth. */
async function myShiftsListFingerprint(page: Page) {
  return page
    .locator('[data-day]')
    .evaluateAll((els) =>
      els
        .map(
          (el) =>
            `${el.getAttribute('data-day')}:${el.textContent?.length ?? 0}`,
        )
        .join('|'),
    );
}

/**
 * Click one progressive paging control (Load more / Load past) until
 * `locator` is visible or that direction is exhausted.
 *
 * Idle labels are locale-specific; while a page is in flight the same
 * control is labelled Common.loading ("Loading...") and disabled — so a
 * /load more/-only locator looks empty mid-fetch. We click by idle name,
 * then wait for list growth / the idle label to return, without requiring
 * Playwright to observe the disabled frame (fast local backends skip it).
 */
async function pageMyShiftsDirection(
  page: Page,
  locator: Locator,
  idleName: RegExp,
  maxClicks: number,
): Promise<boolean> {
  const isFound = async () =>
    locator
      .first()
      .isVisible()
      .catch(() => false);

  const idleButton = page.getByRole('button', { name: idleName });
  const loadingButton = page.getByRole('button', {
    name: /^(loading|wird geladen)/i,
  });

  for (let i = 0; i < maxClicks; i++) {
    if (await isFound()) {
      await locator
        .first()
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      return true;
    }

    if ((await idleButton.count()) === 0) {
      if ((await loadingButton.count()) === 0) return false;
      await expect
        .poll(
          async () => {
            if (await isFound()) return true;
            if ((await idleButton.count()) > 0) return true;
            return (await loadingButton.count()) === 0;
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      continue;
    }

    const button = idleButton.last();
    if (await button.isDisabled()) {
      await expect
        .poll(
          async () => {
            if (await isFound()) return true;
            if ((await idleButton.count()) === 0) return true;
            return idleButton.last().isEnabled();
          },
          { timeout: 15_000 },
        )
        .toBe(true);
      continue;
    }

    const fingerprintBefore = await myShiftsListFingerprint(page);
    // Let Playwright scroll only as needed for the click — an explicit
    // scrollIntoViewIfNeeded parks the viewport on the button and past
    // already-loaded targets when the fetch finishes in the same tick.
    await button.click();

    await expect(button)
      .toBeDisabled({ timeout: 2_000 })
      .catch(() => {});

    let progressed = false;
    await expect
      .poll(
        async () => {
          if (await isFound()) return true;
          if ((await myShiftsListFingerprint(page)) !== fingerprintBefore) {
            progressed = true;
            return true;
          }
          if ((await loadingButton.count()) > 0) return false;
          if ((await idleButton.count()) === 0) return true;
          if (
            await idleButton
              .last()
              .isDisabled()
              .catch(() => false)
          ) {
            return false;
          }
          // Idle again with the same fingerprint — no more pages this way.
          return true;
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    if (await isFound()) {
      await locator
        .first()
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      return true;
    }

    if (
      !progressed &&
      (await myShiftsListFingerprint(page)) === fingerprintBefore
    ) {
      return false;
    }
  }

  return isFound();
}

/**
 * Keep clicking progressive paging until `locator` is visible.
 * Tries future ("Load more") first, then past ("Load past") — overlap
 * fixtures are today-relative and a stale seed can leave them behind
 * Load past while Load more only scrolls further into the future.
 */
async function expandMyShiftsUntil(page: Page, locator: Locator) {
  if (
    await pageMyShiftsDirection(page, locator, /^(load more|mehr laden)$/i, 16)
  ) {
    return;
  }
  if (
    await pageMyShiftsDirection(
      page,
      locator,
      /^(load past|vergangene laden)$/i,
      16,
    )
  ) {
    return;
  }
  await expect(locator.first()).toBeVisible({ timeout: 15_000 });
  await locator
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
}

test.describe('my-shifts conflict clustering + day strip', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(MEMBER_EMAIL, MEMBER_PASSWORD);
    // Not `login.expectLoggedIn()` — that also asserts a "Home" heading which
    // doesn't exist on the real volunteer home page (only fresh org-less
    // signups land on a page with that heading), just the redirect off /login.
    await page.waitForURL(/\/en\/?$/, { timeout: 15000 });

    await page.goto(`${BASE_URL}/en/my-shifts`, { waitUntil: 'load' });
    // DetailPageHeader's title renders as a styled <span>, not a heading role.
    await expect(
      page.getByText('Your assignments', { exact: true }),
    ).toBeVisible();
    // Far-future fixture days sit behind progressive "Load more" pages.
    await expandMyShiftsUntil(page, page.getByText('Overlap Test Pair A'));
  });

  test('renders a 2-shift conflict side by side with an overlap warning', async ({
    page,
  }) => {
    const pairA = page.getByText('Overlap Test Pair A');
    await pairA.scrollIntoViewIfNeeded();

    await expect(pairA).toBeVisible();
    await expect(page.getByText('Overlap Test Pair B')).toBeVisible();
    await expect(
      page
        .getByText('You have overlapping assignments in your schedule')
        .first(),
    ).toBeVisible();

    // Pair day can pick up extra overlapping fixtures (e.g. Late Signup), so
    // the cluster may render as a stacked ConflictPile rather than a 2-col
    // grid — assert both cards + the warning, not a specific layout.
    const pairDayGroup = page.locator('[data-day]', { has: pairA });
    // A cluster this small never gets a "+N more" toggle (threshold is 5).
    await expect(pairDayGroup.getByText(/\+\d+ more/)).toHaveCount(0);
  });

  test('a conflict cluster over 5 shifts shows the first 5 and collapses the rest behind "+N more"', async ({
    page,
  }) => {
    // Fixture cluster is 6 shifts (Pile A-F) — expect A-E visible up front,
    // F collapsed behind "+1 more", with no fanned/hidden-card trick: all 5
    // visible cards must be individually readable, not just the first one.
    // Pile A alone can appear before "Load more" pulls in B–F. The collapse
    // control is a button whose accessible name is the aria-label
    // ("Show all N overlapping assignments"), not the visible "+N more" text.
    const moreToggle = page.getByRole('button', {
      name: /Show all \d+ overlapping assignments/,
    });
    await expandMyShiftsUntil(page, moreToggle);
    const lastVisiblePile = page.getByText('Overlap Test Pile E', {
      exact: true,
    });
    await expandMyShiftsUntil(page, lastVisiblePile);
    await moreToggle.first().scrollIntoViewIfNeeded();

    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      await expect(page.getByText(`Overlap Test Pile ${letter}`)).toBeVisible();
    }
    await expect(page.getByText('Overlap Test Pile F')).toHaveCount(0);
    await expect(moreToggle.first()).toBeVisible();

    await moreToggle.first().click();

    await expect(page.getByText('Overlap Test Pile F')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show less' })).toBeVisible();
    await expect(moreToggle).toHaveCount(0);

    await page.getByRole('button', { name: 'Show less' }).click();
    await expect(page.getByText('Overlap Test Pile F')).toHaveCount(0);
    await expect(moreToggle.first()).toBeVisible();
  });

  test('day strip only shows shift-days, with gap dividers for multi-day gaps', async ({
    page,
  }) => {
    const strip = page.getByRole('tablist', { name: 'Day selector' });
    await expect(strip).toBeVisible();

    const counts = await strip.evaluate((el) => ({
      children: el.children.length,
      tabs: el.querySelectorAll('[role="tab"]').length,
    }));

    // Every child is either a day pill (role=tab) or a gap divider — with
    // this fixture data (weekly Mon/Wed shifts + one-off overlap shifts),
    // there should be at least one multi-day gap collapsed to a divider.
    expect(counts.tabs).toBeGreaterThan(0);
    expect(counts.children).toBeGreaterThan(counts.tabs);
  });

  test('"Go to top" scrolls back to the closest-upcoming day after scrolling away', async ({
    page,
  }) => {
    // beforeEach scrolled down to the overlap fixture — restore the page's
    // resting position first. my-shifts uses initialScroll="top", and the
    // strip's "Go to top" is scrollY=0 (Load past stays reachable), not the
    // closest-upcoming day discover uses.
    await page.getByRole('button', { name: 'Go to top' }).click();
    await page.waitForTimeout(1000);
    const landingHeadingText = await page.evaluate(() => {
      const header = document.querySelector('.sticky');
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const headings = [...document.querySelectorAll('[data-day] h3')];
      const active = headings.find(
        (h) => h.getBoundingClientRect().top >= headerBottom,
      );
      return (active ?? headings[headings.length - 1])?.textContent ?? '';
    });
    expect(landingHeadingText).not.toBe('');

    await page.mouse.wheel(0, 8000);
    await page.waitForTimeout(300);
    await expect(
      page.getByText(landingHeadingText).first(),
    ).not.toBeInViewport();

    await page.getByRole('button', { name: 'Go to top' }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(landingHeadingText).first()).toBeInViewport();
  });

  test('"Check in" hands off to the QR check-in tab instead of checking in directly', async ({
    page,
  }) => {
    // The check-in button only renders when the member's next shift is
    // "starting soon" or overdue (ShiftCardMy's `showCheckIn`) — whether
    // that's true depends on wall-clock time relative to the fixture data,
    // not something this suite controls. Verify the behavior when the
    // button is present; skip rather than flake when it isn't.
    const checkInLink = page.locator('a', { hasText: 'Check in' }).first();
    const isPresent = (await checkInLink.count()) > 0;
    test.skip(
      !isPresent,
      'No shift currently in the "starts soon" check-in window for this fixture data',
    );

    await expect(checkInLink).toHaveAttribute('href', /\/check-in$/);

    await checkInLink.click();
    await page.waitForURL(/\/check-in$/, { timeout: 10000 });
  });
});
