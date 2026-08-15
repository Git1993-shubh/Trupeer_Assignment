const { test, expect } = require('@playwright/test');
const env = require('../utils/env');
const testData = require('../utils/testData');
const DashboardPage = require('../pages/DashboardPage');
const EditorPage = require('../pages/EditorPage');

test.beforeAll(() => {
  env.validateEnv();
});

test.describe('Negative scenarios', () => {
  test.beforeEach(async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('should handle empty Rewrite with AI prompt (validation gap)', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const editorPage = new EditorPage(page);

    await dashboardPage.openVideo(testData.defaultVideoName());
    await editorPage.ensureEditMode();
    await editorPage.openRewriteWithAiDialog();

    const scriptBefore = await editorPage.getScriptText();

    expect(
      await editorPage.isRewriteButtonEnabled(),
      'BUG: Rewrite script is enabled even when the prompt is empty (0/300)'
    ).toBe(true);

    await editorPage.trySubmitEmptyPrompt();

    await expect
      .poll(async () => !(await editorPage.isAiDialogVisible()), {
        message: 'Empty prompt currently closes the Rewrite with AI dialog without an error toast',
        timeout: 15000,
      })
      .toBe(true);

    const scriptAfter = await editorPage.getScriptText();
    expect(
      scriptAfter,
      'Empty prompt should not silently replace the script with empty content'
    ).toBe(scriptBefore);
  });

  test('should reject or clamp an extremely long AI prompt (>300 chars)', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const editorPage = new EditorPage(page);

    await dashboardPage.openVideo(testData.defaultVideoName());
    await editorPage.ensureEditMode();
    await editorPage.openRewriteWithAiDialog();

    await editorPage.aiPromptInput.fill(testData.longPrompt);
    const value = await editorPage.aiPromptInput.inputValue();
    const dialogText = await editorPage.getAiDialogText();

    const clampedOrFlagged =
      value.length <= 300 ||
      /\d+\s*\/\s*300/.test(dialogText) ||
      !(await editorPage.isRewriteButtonEnabled());

    expect(
      clampedOrFlagged,
      'Long prompts should be clamped to 300 characters and/or block Rewrite script'
    ).toBe(true);

    await page.keyboard.press('Escape');
  });
});
