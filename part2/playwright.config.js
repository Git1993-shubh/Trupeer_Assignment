// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function resolveBaseURL() {
  const raw = process.env.TRUPEER_BASE_URL || 'https://app.trupeer.ai';
  try {
    return new URL(raw).origin;
  } catch {
    return 'https://app.trupeer.ai';
  }
}

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { detail: true, suiteTitle: true, resultsDir: 'allure-results' }],
  ],
  timeout: 240000,
  expect: {
    timeout: 20000,
  },
  use: {
    baseURL: resolveBaseURL(),
    headless: process.env.PLAYWRIGHT_HEADED === 'true' ? false : true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.js/,
    },
  ],
});
