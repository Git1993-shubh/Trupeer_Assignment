const { test, expect } = require('@playwright/test');
const env = require('../utils/env');
const testData = require('../utils/testData');
const DashboardPage = require('../pages/DashboardPage');
const EditorPage = require('../pages/EditorPage');

test.beforeAll(() => {
  env.validateEnv();
});

test.describe('Editor', () => {
  test.beforeEach(async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('should open an existing video and show timeline, preview, and script panel', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const editorPage = new EditorPage(page);

    await dashboardPage.openVideo(testData.defaultVideoName());
    await editorPage.ensureEditMode();
    await editorPage.expectKeyElementsVisible();

    expect(await editorPage.isScriptPanelVisible(), 'Script panel tab should be visible').toBe(true);
    expect(await editorPage.isPreviewVisible(), 'Video preview (video or canvas) should be present').toBe(true);
    expect(await editorPage.isTimelineVisible(), 'Timeline / scene markers should be visible').toBe(true);

    const script = await editorPage.getScriptText();
    expect(script.trim().length, 'Existing video should already have a non-empty script').toBeGreaterThan(0);
  });

  test('should rewrite script with AI and display an updated script in the UI', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const editorPage = new EditorPage(page);

    await dashboardPage.openVideo(testData.defaultVideoName());
    await editorPage.ensureEditMode();
    await editorPage.expectKeyElementsVisible();

    const originalScript = await editorPage.getScriptText();
    expect(originalScript.trim().length, 'Need an original script before AI rewrite').toBeGreaterThan(0);

    await editorPage.modifyScriptWithAI(testData.aiPrompts.concise);

    expect(
      await editorPage.isAiResultDisplayed(),
      'Rewrite with AI should return a result with Keep changes / Discard changes'
    ).toBe(true);

    const updatedScript = await editorPage.getScriptText();
    expect(
      updatedScript.trim().length,
      'A modified script should be displayed in the script panel after AI rewrite'
    ).toBeGreaterThan(0);
    expect(
      updatedScript.trim(),
      'Modified script should differ from the original for a "more concise" prompt'
    ).not.toBe(originalScript.trim());

    await editorPage.keepAiChanges();
  });

  test('should apply Zooms editor feature and show zoom controls', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const editorPage = new EditorPage(page);

    await dashboardPage.openVideo(testData.defaultVideoName());
    await editorPage.ensureEditMode();
    await editorPage.expectKeyElementsVisible();

    const ready = await editorPage.verifyZoomsFeatureReady();
    expect(ready, 'Zooms panel should open with "Add zoom effects" guidance').toBe(true);
    await expect(
      editorPage.zoomsHeading,
      'Zooms feature heading should be visible after selecting Zooms'
    ).toBeVisible();
  });
});
