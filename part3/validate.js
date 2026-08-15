const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const env = require('./utils/env');
const LLMJudge = require('./llm/LLMJudge');
const LoginPage = require('../part2/pages/LoginPage');
const DashboardPage = require('../part2/pages/DashboardPage');
const EditorPage = require('../part2/pages/EditorPage');

const DEFAULT_PROMPTS = [
  'Make this script more professional',
  'Make this script more concise',
  'Add a call to action at the end',
  'Translate this script to Spanish',
];

const CAPTURES_PATH = path.join(__dirname, 'ai-captures.json');
const RESULTS_PATH = path.join(__dirname, 'validation-results.json');
const SAMPLE_PATH = path.join(__dirname, 'sample-output.txt');

/**
 * Part 3 — AI-augmented validation
 * Playwright drives Trupeer Rewrite-with-AI; an LLM judges each output.
 *
 * Usage:
 *   node validate.js              full capture + judge
 *   node validate.js --judge-only re-judge ai-captures.json (no browser)
 */
class TrupeerAIValidator {
  constructor(options = {}) {
    env.validateEnv();
    this.judgeOnly = Boolean(options.judgeOnly);
    this.results = [];
    this.browser = null;
    this.page = null;
    this.originalScript = '';
    this.llmJudge = new LLMJudge();
    this.prompts = DEFAULT_PROMPTS;
  }

  async run() {
    console.log('========================================');
    console.log('TRUPEER AI VALIDATION (Part 3)');
    console.log('========================================\n');
    console.log(`LLM: ${env.LLM_PROVIDER()} / ${env.LLM_MODEL()}`);
    if (this.judgeOnly) {
      console.log('Mode: judge-only (from ai-captures.json)\n');
    } else {
      console.log(`Video: ${env.TRUPEER_VIDEO_NAME()}\n`);
    }

    try {
      if (this.judgeOnly) {
        await this.runJudgeOnly();
      } else {
        await this.runFull();
      }

      this.printSummary();
      this.saveOutputs();

      const hardFailures = this.results.filter(
        (r) => r.error || r.evaluation?.overall === 'ERROR'
      ).length;
      const passCount = this.results.filter((r) => r.evaluation?.overall === 'PASS').length;
      process.exitCode = hardFailures > 0 || passCount === 0 ? 1 : 0;
    } catch (error) {
      console.error(`\nValidation aborted: ${error.message}`);
      process.exitCode = 1;
    } finally {
      if (this.browser) await this.browser.close();
    }
  }

  async runFull() {
    await this.launchBrowser();
    await this.authenticate();
    this.originalScript = await this.captureOriginalScript();

    const captures = {
      timestamp: new Date().toISOString(),
      videoName: env.TRUPEER_VIDEO_NAME(),
      originalScript: this.originalScript,
      prompts: [],
    };

    for (const prompt of this.prompts) {
      console.log(`\nPrompt: "${prompt}"`);
      console.log('-'.repeat(50));

      let aiOutput = '';
      try {
        aiOutput = await this.runRewritePrompt(prompt);
        console.log(`  Captured AI output (${aiOutput.length} chars)`);

        captures.prompts.push({ prompt, aiOutput });
        this.writeCaptures(captures);

        await this.judgeAndStore(prompt, aiOutput);
      } catch (error) {
        console.error(`  FAIL (error): ${error.message}`);
        // Capture may already be saved above; only save if rewrite succeeded but push was skipped
        if (aiOutput && !captures.prompts.some((p) => p.prompt === prompt && p.aiOutput === aiOutput)) {
          captures.prompts.push({ prompt, aiOutput });
          this.writeCaptures(captures);
        }
        this.results.push({
          prompt,
          aiOutput: aiOutput || null,
          error: error.message,
          evaluation: {
            overall: 'ERROR',
            confidence: 0,
            criteria: {},
            summary: error.message,
          },
        });
      }
    }
  }

  async runJudgeOnly() {
    if (!fs.existsSync(CAPTURES_PATH)) {
      throw new Error(
        `Missing ${CAPTURES_PATH}. Run a full \`npm run validate\` first to capture AI outputs.`
      );
    }

    const captures = JSON.parse(fs.readFileSync(CAPTURES_PATH, 'utf8'));
    this.originalScript = captures.originalScript || '';
    if (!this.originalScript || !captures.prompts?.length) {
      throw new Error('ai-captures.json is missing originalScript or prompts');
    }

    console.log(`Loaded ${captures.prompts.length} captures from ai-captures.json\n`);

    for (const item of captures.prompts) {
      console.log(`\nPrompt: "${item.prompt}"`);
      console.log('-'.repeat(50));
      console.log(`  Using captured AI output (${(item.aiOutput || '').length} chars)`);
      try {
        await this.judgeAndStore(item.prompt, item.aiOutput);
      } catch (error) {
        console.error(`  FAIL (error): ${error.message}`);
        this.results.push({
          prompt: item.prompt,
          aiOutput: item.aiOutput || null,
          error: error.message,
          evaluation: {
            overall: 'ERROR',
            confidence: 0,
            criteria: {},
            summary: error.message,
          },
        });
      }
    }
  }

  async judgeAndStore(prompt, aiOutput) {
    console.log('  Judging with LLM...');
    const evaluation = await this.llmJudge.evaluate({
      originalScript: this.originalScript,
      userPrompt: prompt,
      aiOutput,
    });
    this.results.push({ prompt, aiOutput, evaluation });
    this.printResult(evaluation);
  }

  writeCaptures(captures) {
    fs.writeFileSync(CAPTURES_PATH, JSON.stringify(captures, null, 2), 'utf8');
  }

  async launchBrowser() {
    console.log('Launching browser...');
    this.browser = await chromium.launch({
      headless: !env.PLAYWRIGHT_HEADED(),
    });
    this.page = await this.browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
  }

  async authenticate() {
    console.log('Logging in...');
    const loginPage = new LoginPage(this.page);
    const dashboardPage = new DashboardPage(this.page);

    await loginPage.goto();
    await loginPage.login(env.TRUPEER_EMAIL(), env.TRUPEER_PASSWORD());
    await dashboardPage.expectLoaded();
    console.log('Authenticated.\n');
  }

  async captureOriginalScript() {
    console.log('Opening video editor...');
    const dashboardPage = new DashboardPage(this.page);
    const editorPage = new EditorPage(this.page);

    await dashboardPage.openVideo(env.TRUPEER_VIDEO_NAME());
    await editorPage.ensureEditMode();
    await editorPage.scriptTab.click();

    const script = (await editorPage.getScriptText()).trim();
    if (!script) {
      throw new Error('Original script is empty — pick a video with script content');
    }

    console.log(`Original script captured (${script.length} chars)\n`);
    return script;
  }

  async runRewritePrompt(prompt) {
    const editorPage = new EditorPage(this.page);
    await editorPage.modifyScriptWithAI(prompt);

    const aiOutput = (await editorPage.getScriptText()).trim();
    if (!aiOutput) {
      await editorPage.discardAiChanges().catch(() => {});
      throw new Error('AI rewrite produced empty script text');
    }

    await editorPage.discardAiChanges();
    return aiOutput;
  }

  printResult(evaluation) {
    const icon = evaluation.overall === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`  ${icon} | confidence ${(evaluation.confidence * 100).toFixed(0)}%`);
    if (evaluation.criteria) {
      for (const [key, value] of Object.entries(evaluation.criteria)) {
        console.log(`    - ${key}: ${value.result}${value.reason ? ` — ${value.reason}` : ''}`);
      }
    }
    if (evaluation.summary) console.log(`  Summary: ${evaluation.summary}`);
  }

  printSummary() {
    console.log('\n========================================');
    console.log('VALIDATION SUMMARY');
    console.log('========================================\n');

    let passCount = 0;
    let confidenceTotal = 0;
    let scored = 0;

    for (const result of this.results) {
      if (result.error) {
        console.log(`ERROR  ${result.prompt}`);
        console.log(`       ${result.error}\n`);
        continue;
      }

      const ok = result.evaluation.overall === 'PASS';
      if (ok) passCount += 1;
      confidenceTotal += result.evaluation.confidence;
      scored += 1;

      console.log(`${ok ? 'PASS' : 'FAIL'}  ${result.prompt}`);
      console.log(`       confidence ${(result.evaluation.confidence * 100).toFixed(0)}%\n`);
    }

    const avg = scored ? ((confidenceTotal / scored) * 100).toFixed(1) : '0.0';
    console.log('----------------------------------------');
    console.log(`Overall: ${passCount}/${this.results.length} prompts PASS`);
    console.log(`Average confidence (scored runs): ${avg}%`);
    console.log('========================================\n');
  }

  saveOutputs() {
    const timestamp = new Date().toISOString();
    const scored = this.results.filter(
      (r) => typeof r.evaluation?.confidence === 'number' && !r.error && r.evaluation.overall !== 'ERROR'
    );
    const summary = {
      timestamp,
      environment: {
        provider: env.LLM_PROVIDER(),
        model: env.LLM_MODEL(),
        trupeerUrl: env.TRUPEER_BASE_URL(),
        videoName: env.TRUPEER_VIDEO_NAME(),
        mode: this.judgeOnly ? 'judge-only' : 'full',
      },
      originalScript: this.originalScript,
      results: this.results.map((r) => ({
        prompt: r.prompt,
        error: r.error || null,
        aiOutput: r.aiOutput || null,
        evaluation: r.evaluation,
      })),
      summary: {
        total: this.results.length,
        passed: this.results.filter((r) => r.evaluation?.overall === 'PASS').length,
        failed: this.results.filter((r) => r.evaluation?.overall === 'FAIL').length,
        errors: this.results.filter((r) => r.error || r.evaluation?.overall === 'ERROR').length,
        averageConfidence: scored.length
          ? scored.reduce((sum, r) => sum + r.evaluation.confidence, 0) / scored.length
          : 0,
      },
    };

    fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`Wrote ${RESULTS_PATH}`);

    fs.writeFileSync(SAMPLE_PATH, this.formatSampleText(summary), 'utf8');
    console.log(`Wrote ${SAMPLE_PATH}`);
  }

  formatSampleText(summary) {
    const lines = [];
    lines.push('========================================');
    lines.push('TRUPEER AI VALIDATION RESULTS (Part 3)');
    lines.push('========================================');
    lines.push(`Timestamp: ${summary.timestamp}`);
    lines.push(`Judge: ${summary.environment.provider} / ${summary.environment.model}`);
    lines.push(`Video: ${summary.environment.videoName}`);
    lines.push(`Mode: ${summary.environment.mode}`);
    lines.push('');
    lines.push('--- Original script (excerpt) ---');
    lines.push(truncate(summary.originalScript, 400));
    lines.push('');

    for (const result of summary.results) {
      lines.push('----------------------------------------');
      lines.push(`Prompt: ${result.prompt}`);
      if (result.error) {
        lines.push(`Result: ERROR`);
        lines.push(`Error: ${result.error}`);
        if (result.aiOutput) {
          lines.push('AI output (excerpt):');
          lines.push(truncate(result.aiOutput, 350));
        }
        lines.push('');
        continue;
      }

      const ev = result.evaluation;
      lines.push(`Result: ${ev.overall}`);
      lines.push(`Confidence: ${ev.confidence}`);
      if (ev.criteria) {
        lines.push('Criteria:');
        for (const [key, value] of Object.entries(ev.criteria)) {
          lines.push(`  - ${key}: ${value.result} — ${value.reason || ''}`);
        }
      }
      if (ev.summary) lines.push(`Summary: ${ev.summary}`);
      lines.push('AI output (excerpt):');
      lines.push(truncate(result.aiOutput || '', 350));
      lines.push('');
    }

    lines.push('========================================');
    lines.push(
      `Overall: ${summary.summary.passed}/${summary.summary.total} PASSED` +
        (summary.summary.errors ? ` (${summary.summary.errors} errors)` : '')
    );
    lines.push(`Average Confidence: ${(summary.summary.averageConfidence * 100).toFixed(1)}%`);
    lines.push('========================================');
    lines.push('');
    return lines.join('\n');
  }
}

function truncate(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}...`;
}

async function main() {
  const judgeOnly = process.argv.includes('--judge-only');
  const validator = new TrupeerAIValidator({ judgeOnly });
  await validator.run();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = TrupeerAIValidator;
