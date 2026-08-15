# Part 3 notes — CI gating & human disagreement

## Confidence threshold before gating CI

I would **not** fail the pipeline on a single LLM-judge FAIL. For a hard gate I would require:

- **Overall PASS** on the prompt, and
- **Confidence ≥ 0.85**, and
- The same FAIL reproduced on a **second independent judge call** (same rubric, slightly different temperature or model) to cut one-off judge noise.

Below ~0.85 I would treat the result as **advisory** (warning / artifact only): surface it in CI reports and Slack, but do not block merges. Below ~0.70 I would auto-escalate to a human review queue rather than trusting either PASS or FAIL.

Reason: the product output is non-deterministic and the judge is also an LLM — false fails would make the gate flaky and teams would disable it.

## When the LLM judge disagrees with a human

Treat the human as source of truth for product quality, and treat the disagreement as a **rubric/process defect**, not a silent override forever:

1. **Log the disagreement** (prompt, original, AI output, judge JSON, human verdict + short reason) in a review corpus.
2. **Triage**: if humans consistently say PASS where the judge FAILs on one criterion (e.g. “meaningful_change” too strict for light tone edits), tighten/loosen that criterion or add prompt-specific exceptions.
3. **Spot-check reverse cases** (judge PASS / human FAIL) — those are more dangerous for CI; bias the rubric toward catching intent misses over punishing mild rewrites.
4. After a handful of labeled disagreements, **re-run the judge** on the corpus and only raise the CI threshold once agreement with humans is stable (e.g. ≥90% on the labeled set).

Do not permanently hard-code “always trust human for this prompt” without updating the rubric — that hides regressions in the evaluation harness itself.
