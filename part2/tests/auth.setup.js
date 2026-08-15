const { test: setup } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const env = require('../utils/env');
const LoginPage = require('../pages/LoginPage');
const DashboardPage = require('../pages/DashboardPage');

const AUTH_DIR = path.join(__dirname, '../.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

setup('authenticate and save storage state', async ({ page }) => {
  env.validateEnv();
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.TRUPEER_EMAIL(), env.TRUPEER_PASSWORD());

  const dashboardPage = new DashboardPage(page);
  await dashboardPage.dismissOverlays();
  await dashboardPage.expectLoaded();

  await page.context().storageState({ path: AUTH_FILE });
});
