/**
 * Login Page Object — Trupeer auth screen
 * https://app.trupeer.ai/auth?tab=login
 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Role/label selectors are more reliable than #email on this custom input
    this.emailInput = page.getByRole('textbox', { name: /^Email$/i });
    this.passwordInput = page.locator('#password');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.errorMessage = page.locator('[role="alert"]').filter({ hasText: /.+/ }).first();
  }

  async goto() {
    const base = process.env.TRUPEER_BASE_URL
      ? new URL(process.env.TRUPEER_BASE_URL).origin
      : 'https://app.trupeer.ai';
    await this.page.goto(`${base}/auth?tab=login`, { waitUntil: 'domcontentloaded' });
    await this.emailInput.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Fill a field reliably (handles flaky controlled inputs).
   * @param {import('@playwright/test').Locator} locator
   * @param {string} value
   */
  async fillReliable(locator, value) {
    await locator.waitFor({ state: 'visible' });
    await locator.click();
    await locator.fill('');
    await locator.fill(value);

    let current = await locator.inputValue().catch(() => '');
    if (current === value) return;

    // Fallback: clear + type character-by-character
    await locator.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Backspace');
    await locator.pressSequentially(value, { delay: 25 });

    current = await locator.inputValue().catch(() => '');
    if (current !== value) {
      throw new Error(`Could not fill field (expected length ${value.length}, got length ${current.length})`);
    }
  }

  /**
   * @param {string} email
   * @param {string} password
   * @param {{ expectSuccess?: boolean }} [options]
   */
  async login(email, password, options = {}) {
    const expectSuccess = options.expectSuccess !== false;

    await this.fillReliable(this.emailInput, email);
    await this.fillReliable(this.passwordInput, password);

    // Re-assert email after password (browser password managers can clear sibling fields)
    const emailAfterPassword = await this.emailInput.inputValue();
    if (emailAfterPassword !== email) {
      await this.fillReliable(this.emailInput, email);
    }

    const responsePromise = this.page
      .waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
        { timeout: 45000 }
      )
      .catch(() => null);

    await this.continueButton.click();
    const response = await responsePromise;

    if (expectSuccess) {
      if (!response) {
        // Retry once — intermittent submit misses
        await this.fillReliable(this.emailInput, email);
        await this.fillReliable(this.passwordInput, password);
        const retry = this.page.waitForResponse(
          (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
          { timeout: 45000 }
        );
        await this.continueButton.click();
        const retryResponse = await retry;
        if (!retryResponse.ok()) {
          throw new Error(`Login API failed with status ${retryResponse.status()}`);
        }
      } else if (!response.ok()) {
        throw new Error(`Login API failed with status ${response.status()}`);
      }

      await this.page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 45000 });
      return;
    }

    await this.page
      .waitForURL((url) => url.pathname.includes('/auth'), { timeout: 10000 })
      .catch(() => {});
  }

  async isErrorVisible() {
    return this.errorMessage.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getErrorText() {
    if (!(await this.isErrorVisible())) return null;
    return (await this.errorMessage.textContent())?.trim() || null;
  }

  isOnAuthPage() {
    return this.page.url().includes('/auth');
  }
}

module.exports = LoginPage;
