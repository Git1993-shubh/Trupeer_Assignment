const { test, expect } = require('@playwright/test');
const env = require('../utils/env');
const LoginPage = require('../pages/LoginPage');
const DashboardPage = require('../pages/DashboardPage');

test.beforeAll(() => {
  env.validateEnv();
});

test.describe('Login', () => {
  // Fresh browser context without saved storage — covers the login flow itself
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should login successfully and land on the dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(env.TRUPEER_EMAIL(), env.TRUPEER_PASSWORD());

    await dashboardPage.expectLoaded();

    expect(loginPage.isOnAuthPage(), 'User should leave the auth page after a successful login').toBe(false);
    expect(
      await dashboardPage.isLoaded(),
      'Dashboard "Welcome back" heading should be visible after login'
    ).toBe(true);
    await expect(
      dashboardPage.recentContentHeading,
      'Recent content section should be visible on the home dashboard'
    ).toBeVisible();
  });

  test('should reject invalid credentials and stay on auth', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('invalid-user@example.com', 'DefinitelyWrongPassword123!', {
      expectSuccess: false,
    });

    await expect
      .poll(
        async () => loginPage.isOnAuthPage() || (await loginPage.isErrorVisible()),
        {
          message: 'Invalid login should keep the user on auth or show an error',
          timeout: 20000,
        }
      )
      .toBe(true);

    expect(
      page.url(),
      'Invalid credentials must not navigate to the authenticated home page'
    ).toMatch(/auth/);
  });
});
