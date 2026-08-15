/**
 * Dashboard / Home Page Object — Trupeer home after login
 */
class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.welcomeHeading = page.getByRole('heading', { name: /Welcome back/i });
    this.recentContentHeading = page.getByRole('heading', { name: /Recent content/i });
    this.createNewButton = page.getByRole('button', { name: /Create new/i });
    this.libraryNav = page.getByRole('link', { name: /^Library$/i });
    this.accountButton = page.getByRole('button', { name: /Account and settings/i });
  }

  async goto() {
    const base = process.env.TRUPEER_BASE_URL
      ? new URL(process.env.TRUPEER_BASE_URL).origin
      : 'https://app.trupeer.ai';
    await this.page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
    await this.dismissOverlays();
  }

  async expectLoaded() {
    if (this.page.url().includes('/auth')) {
      throw new Error('Expected dashboard but landed on auth — storage state may be expired');
    }

    // Close announcement modal first — it can delay/steal focus from dashboard chrome
    await this.dismissOverlays();

    const dashboardChrome = this.welcomeHeading
      .or(this.recentContentHeading)
      .or(this.libraryNav)
      .or(this.page.getByRole('link', { name: /^Home$/i }));

    await dashboardChrome.first().waitFor({ state: 'visible', timeout: 45000 });
  }

  async isLoaded() {
    const welcome = await this.welcomeHeading.isVisible({ timeout: 3000 }).catch(() => false);
    const recent = await this.recentContentHeading.isVisible({ timeout: 1000 }).catch(() => false);
    const library = await this.libraryNav.isVisible({ timeout: 1000 }).catch(() => false);
    return welcome || recent || library;
  }

  /**
   * Close product tour / what's-new dialogs that block Recent content clicks.
   * Targets the circular X ("Close") on modals like "Library Just Got Easier to Work In".
   */
  async dismissOverlays() {
    // Modal often appears a moment after dashboard paint
    await this.page
      .getByRole('dialog')
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});

    for (let i = 0; i < 5; i++) {
      const dialog = this.page.getByRole('dialog');
      if (!(await dialog.isVisible({ timeout: 1000 }).catch(() => false))) break;

      const closeBtn = dialog.locator('button[aria-label="Close"]').last();

      if ((await closeBtn.count()) > 0) {
        // DOM click — button can fail Playwright visibility checks while still on-screen
        await closeBtn.evaluate((el) => el.click());
      } else {
        await this.page.keyboard.press('Escape');
      }

      await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }

    // Intercom launcher can sit on top of cards — hide if present
    await this.page
      .evaluate(() => {
        document
          .querySelectorAll(
            '#intercom-container, .intercom-lightweight-app, iframe[name="intercom-messenger-frame"]'
          )
          .forEach((el) => {
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
          });
      })
      .catch(() => {});
  }

  /**
   * Open a video from Recent content by title (partial match OK).
   * Card accessible names are unreliable (nested buttons), so prefer title text.
   * @param {string} videoName
   */
  async openVideo(videoName) {
    await this.dismissOverlays();

    const title = this.page.getByText(videoName, { exact: true }).first();
    if (await title.isVisible({ timeout: 8000 }).catch(() => false)) {
      await Promise.all([
        this.page.waitForURL(/\/content\//, { timeout: 45000 }),
        title.click(),
      ]);
      return;
    }

    // Fallback: Library list (more stable link names)
    await this.openVideoFromLibrary(videoName);
  }

  /**
   * @param {string} videoName
   */
  async openVideoFromLibrary(videoName) {
    await this.dismissOverlays();
    await this.libraryNav.click();
    await this.page.waitForURL(/\/library/, { timeout: 20000 });
    await this.dismissOverlays();

    const link = this.page.getByRole('link', { name: new RegExp(escapeRegExp(videoName), 'i') }).first();
    await link.waitFor({ state: 'visible', timeout: 30000 });
    await Promise.all([
      this.page.waitForURL(/\/content\//, { timeout: 45000 }),
      link.click(),
    ]);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = DashboardPage;
