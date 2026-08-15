/**
 * Editor Page Object — Trupeer video edit experience
 * Route: /content/{id}/video/edit
 *
 * UI labels the AI feature "Rewrite with AI" (assignment: "Modify Script with AI").
 * Left-rail tools are ARIA tabs (Script, Zooms, …).
 */
class EditorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.editVideoLink = page.getByRole('link', { name: /Edit video/i });
    this.videoTab = page.getByRole('tab', { name: /^Video$/i }).or(page.getByRole('button', { name: /^Video$/i }));
    this.documentTab = page.getByRole('tab', { name: /^Document$/i }).or(page.getByRole('button', { name: /^Document$/i }));
    this.shareButton = page.getByRole('button', { name: /^Share$/i });

    this.scriptTab = page.getByRole('tab', { name: /^Script$/i });
    this.zoomsTab = page.getByRole('tab', { name: /^Zooms$/i });
    this.visualsTab = page.getByRole('tab', { name: /^Visuals$/i });
    this.addButton = page.getByRole('button', { name: /^Add$/i });

    this.videoPreview = page.locator('video').first();
    this.previewCanvas = page.locator('canvas').first();
    this.timeline = page.getByText(/\bScene\b/).first();
    this.playheadTime = page.getByText(/\d:\d{2}\s*\/\s*\d:\d{2}/);

    // Script lines render as textboxes / contenteditable paragraphs inside the Script panel
    this.scriptLines = page.locator('[contenteditable="true"], [role="textbox"]');
    this.revertScriptButton = page.getByRole('button', { name: /Revert script version/i });
    this.rewriteWithAiButton = this.revertScriptButton.locator('xpath=following::button[1]');

    this.aiDialog = page.getByRole('dialog');
    this.aiDialogTitle = this.aiDialog.getByText(/Rewrite with AI/i);
    this.aiPromptInput = this.aiDialog.locator('textarea');
    this.rewriteScriptButton = this.aiDialog.getByRole('button', { name: /Rewrite script/i });
    this.removeFillerWordsButton = this.aiDialog.getByRole('button', { name: /Remove filler words/i });

    this.keepChangesButton = page.getByRole('button', { name: /Keep changes/i });
    this.discardChangesButton = page.getByRole('button', { name: /Discard changes/i });

    this.zoomsHeading = page.getByText(/Add zoom effects/i);
    this.zoomsHint = page.getByText(/Try zoom in timeline|Hover over the timeline/i);
  }

  async ensureEditMode() {
    await this.page.waitForLoadState('domcontentloaded');

    if (this.page.url().includes('/video/edit')) {
      await this.waitForEditorReady();
      return;
    }

    const editVisible = await this.editVideoLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (editVisible) {
      await Promise.all([
        this.page.waitForURL(/\/video\/edit/, { timeout: 45000 }),
        this.editVideoLink.click(),
      ]);
      await this.waitForEditorReady();
      return;
    }

    if (/\/content\/[^/]+\/video\/?$/.test(this.page.url()) && !this.page.url().includes('/edit')) {
      const editUrl = `${this.page.url().replace(/\/?$/, '')}/edit`;
      await this.page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    }

    await this.waitForEditorReady();
  }

  async waitForEditorReady() {
    if (!this.page.url().includes('/edit')) {
      throw new Error(`Editor not open yet. Current URL: ${this.page.url()}`);
    }

    await Promise.race([
      this.addButton.waitFor({ state: 'visible', timeout: 90000 }),
      this.keepChangesButton.waitFor({ state: 'visible', timeout: 90000 }),
      this.scriptTab.waitFor({ state: 'visible', timeout: 90000 }),
    ]);
    await this.dismissPendingAiReview();
    await this.scriptTab.waitFor({ state: 'visible', timeout: 60000 });
  }

  async dismissPendingAiReview() {
    if (await this.discardChangesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.discardChangesButton.click();
      await this.discardChangesButton.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    }
  }

  async expectKeyElementsVisible() {
    await this.waitForEditorReady();
    await this.scriptTab.waitFor({ state: 'visible', timeout: 15000 });
    await this.videoPreview.or(this.previewCanvas).first().waitFor({ state: 'attached', timeout: 20000 });
    await this.timeline.waitFor({ state: 'visible', timeout: 20000 });
    await this.scriptLines.first().waitFor({ state: 'attached', timeout: 20000 });
  }

  async isScriptPanelVisible() {
    return this.scriptTab.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isPreviewVisible() {
    return (await this.videoPreview.count()) > 0 || (await this.previewCanvas.count()) > 0;
  }

  async isTimelineVisible() {
    return this.timeline.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getScriptText() {
    const count = await this.scriptLines.count();
    const parts = [];
    for (let i = 0; i < count; i++) {
      const text = (await this.scriptLines.nth(i).innerText()).trim();
      if (text && text !== 'Enter script text...') parts.push(text);
    }
    return parts.join('\n');
  }

  async openRewriteWithAiDialog() {
    await this.dismissPendingAiReview();
    await this.scriptTab.click();
    await this.addButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.rewriteWithAiButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.rewriteWithAiButton.click();
    await this.aiDialog.waitFor({ state: 'visible', timeout: 15000 });
    await this.aiDialogTitle.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * @param {string} prompt
   */
  async submitRewritePrompt(prompt) {
    await this.aiPromptInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.aiPromptInput.fill(prompt);
    await this.rewriteScriptButton.click();
  }

  /**
   * @param {string} prompt
   */
  async modifyScriptWithAI(prompt) {
    await this.openRewriteWithAiDialog();
    await this.submitRewritePrompt(prompt);
    await this.waitForAiRewriteToFinish();
  }

  async waitForAiRewriteToFinish() {
    await this.keepChangesButton.waitFor({ state: 'visible', timeout: 180000 });
    await this.discardChangesButton.waitFor({ state: 'visible', timeout: 15000 });
  }

  async keepAiChanges() {
    await this.keepChangesButton.click();
    await this.keepChangesButton.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async discardAiChanges() {
    await this.discardChangesButton.click();
    await this.discardChangesButton.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async isAiResultDisplayed() {
    return this.keepChangesButton.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async isRewriteButtonEnabled() {
    return this.rewriteScriptButton.isEnabled();
  }

  async trySubmitEmptyPrompt() {
    await this.aiPromptInput.fill('');
    await this.rewriteScriptButton.click({ force: true });
  }

  async isAiDialogVisible() {
    return this.aiDialog.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async getAiDialogText() {
    if (!(await this.isAiDialogVisible())) return '';
    return this.aiDialog.innerText();
  }

  async openZoomsPanel() {
    await this.zoomsTab.click();
    await this.zoomsHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  async isZoomsPanelVisible() {
    return this.zoomsHeading.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async verifyZoomsFeatureReady() {
    await this.openZoomsPanel();
    const hintVisible = await this.zoomsHint.isVisible({ timeout: 10000 }).catch(() => false);
    return hintVisible || (await this.isZoomsPanelVisible());
  }
}

module.exports = EditorPage;
