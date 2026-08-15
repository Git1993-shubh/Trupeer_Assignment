# Part 3 — AI-Augmented Testing

End-to-end validation of Trupeer’s **Rewrite with AI** (assignment: “Modify Script with AI”).

Playwright logs in, opens a video editor, captures the original script, runs several rewrite prompts, then calls an LLM with a structured rubric to score each AI output (pass/fail per criterion + confidence).

Reuses Part 2 page objects: `LoginPage`, `DashboardPage`, `EditorPage`.

## Prerequisites

- Node.js 18+ (built-in `fetch`)
- Part 2 dependencies/browsers available (`cd ../part2 && npx playwright install chromium` if needed)
- Trupeer account with a video that has script text
- An LLM API key — OpenAI **or** Google Gemini (free tier at [Google AI Studio](https://aistudio.google.com/apikey))

## Setup

```bash
cd part3
npm install
```

Configure the **repo root** `.env`:

```env
TRUPEER_BASE_URL=https://app.trupeer.ai
TRUPEER_EMAIL=your-email@example.com
TRUPEER_PASSWORD=your-password
TRUPEER_VIDEO_NAME=simple. Website User Guide

# OpenAI
LLM_API_KEY=sk-your-openai-key
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Or Anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# LLM_PROVIDER=anthropic
# LLM_MODEL=claude-haiku-4-5-20251001

# Or Gemini (free key from AI Studio)
# LLM_API_KEY=your-gemini-key
# LLM_PROVIDER=gemini
# LLM_MODEL=gemini-2.0-flash
```

`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are accepted as provider-specific aliases for the judge key.

Optional:

```env
PLAYWRIGHT_HEADED=true
```

## Run

```bash
npm run validate
```

This is a single command. It writes:

- `sample-output.txt` — human-readable results (submit this)
- `validation-results.json` — full structured results
- `ai-captures.json` — original + AI outputs (so you can re-judge without re-running Trupeer)

If captures already exist and you only need to re-run the LLM judge (e.g. after switching API keys):

```bash
npm run validate:judge
```

## What it does

1. Login → dismiss overlays → open `TRUPEER_VIDEO_NAME` → ensure edit mode  
2. Capture original script text  
3. For each prompt (professional / concise / CTA / Spanish):
   - Open **Rewrite with AI**, submit prompt, wait for Keep/Discard  
   - Capture modified script from the UI  
   - **Discard** changes so the next prompt starts from the same baseline  
   - Call the LLM judge with original + prompt + output + rubric  
4. Print and save per-prompt pass/fail, criteria, confidence, and overall score  

## Rubric (sent to the LLM)

- Reflects the user’s prompt intent  
- Coherent / grammatically correct  
- Preserves core information from the original  
- Meaningfully different (not a trivial rewording)  

Overall PASS only if all four criteria PASS.

## Sample prompts

1. Make this script more professional  
2. Make this script more concise  
3. Add a call to action at the end  
4. Translate this script to Spanish  

## Deliverables

| File | Purpose |
|------|---------|
| `validate.js` | Runnable orchestrator |
| `llm/LLMJudge.js` | OpenAI judge + JSON parse |
| `sample-output.txt` | Sample run output (≥4 prompts) |
| `notes.md` | CI confidence threshold + human disagreement |
| `README.md` | This file |

## Notes

See [notes.md](./notes.md) for CI gating threshold and handling judge vs human disagreement.
