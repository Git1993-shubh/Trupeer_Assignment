const env = require('../utils/env');

/**
 * Calls an LLM to score Trupeer "Rewrite with AI" output against a fixed rubric.
 * Providers: openai, gemini, anthropic.
 */
class LLMJudge {
  constructor() {
    this.apiKey = env.LLM_API_KEY();
    this.provider = env.LLM_PROVIDER().toLowerCase();
    this.model = env.LLM_MODEL();
  }

  /**
   * @param {{ originalScript: string, userPrompt: string, aiOutput: string }} input
   */
  async evaluate(input) {
    const { originalScript, userPrompt, aiOutput } = input;
    if (!originalScript?.trim() || !userPrompt?.trim() || !aiOutput?.trim()) {
      throw new Error('Missing required inputs: originalScript, userPrompt, aiOutput');
    }

    const prompt = this._buildEvaluationPrompt(originalScript, userPrompt, aiOutput);
    let raw;

    if (this.provider === 'openai') {
      raw = await this._callOpenAI(prompt);
    } else if (this.provider === 'gemini') {
      raw = await this._callGemini(prompt);
    } else if (this.provider === 'anthropic') {
      raw = await this._callAnthropic(prompt);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.provider} (use openai, gemini, or anthropic)`);
    }

    return this._parseResponse(raw);
  }

  _buildEvaluationPrompt(originalScript, userPrompt, aiOutput) {
    return `You are a QA evaluator for an AI script-rewriting product.
Evaluate whether the AI-modified script is a good response to the user's rewrite prompt.

ORIGINAL SCRIPT:
"""
${originalScript}
"""

USER PROMPT:
"""
${userPrompt}
"""

AI-MODIFIED OUTPUT (captured from the product UI):
"""
${aiOutput}
"""

Rubric (judge each independently):
1. intent — Does the modified script reflect the intent of the user's prompt?
2. coherence — Is the output coherent and grammatically correct (in the target language if translated)?
3. information_preservation — Does it preserve the core information from the original (meaning/facts), allowing for style/language changes requested by the prompt?
4. meaningful_change — Is it a meaningfully different output from the original, not just a trivial rewording? (For translation, different language counts as meaningful.)

overall is PASS only if ALL four criteria are PASS.
confidence is your certainty in the overall judgment from 0.0 to 1.0.

Respond with ONLY valid JSON (no markdown), exact shape:
{
  "overall": "PASS" | "FAIL",
  "confidence": 0.0,
  "criteria": {
    "intent": { "result": "PASS" | "FAIL", "reason": "..." },
    "coherence": { "result": "PASS" | "FAIL", "reason": "..." },
    "information_preservation": { "result": "PASS" | "FAIL", "reason": "..." },
    "meaningful_change": { "result": "PASS" | "FAIL", "reason": "..." }
  },
  "summary": "1-2 sentence summary"
}`;
  }

  async _callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a strict QA judge. Reply with JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || response.statusText || 'Unknown OpenAI error';
      throw new Error(`OpenAI API error (${response.status}): ${message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty message');
    return content.trim();
  }

  async _callGemini(prompt) {
    const model = this.model.startsWith('gpt') || this.model.startsWith('claude')
      ? 'gemini-2.0-flash'
      : this.model;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || response.statusText || 'Unknown Gemini error';
      throw new Error(`Gemini API error (${response.status}): ${message}`);
    }

    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!content.trim()) throw new Error('Gemini returned an empty message');
    return content.trim();
  }

  async _callAnthropic(prompt) {
    const model = this.model.startsWith('claude') ? this.model : 'claude-haiku-4-5-20251001';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system: 'You are a strict QA judge. Reply with JSON only. No markdown fences.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || response.statusText || 'Unknown Anthropic error';
      throw new Error(`Anthropic API error (${response.status}): ${message}`);
    }

    const content = (data.content || [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
    if (!content.trim()) throw new Error('Anthropic returned an empty message');
    return content.trim();
  }

  _parseResponse(responseText) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in LLM response');

    const result = JSON.parse(jsonMatch[0]);
    if (!result.overall || result.confidence === undefined) {
      throw new Error('Invalid LLM response: missing overall or confidence');
    }

    result.overall = String(result.overall).toUpperCase() === 'PASS' ? 'PASS' : 'FAIL';
    result.confidence = Math.min(1, Math.max(0, Number(result.confidence)));

    const required = ['intent', 'coherence', 'information_preservation', 'meaningful_change'];
    result.criteria = result.criteria || {};
    for (const key of required) {
      const item = result.criteria[key] || {};
      result.criteria[key] = {
        result: String(item.result || 'FAIL').toUpperCase() === 'PASS' ? 'PASS' : 'FAIL',
        reason: item.reason || '',
      };
    }

    const allPass = required.every((key) => result.criteria[key].result === 'PASS');
    result.overall = allPass ? 'PASS' : 'FAIL';
    result.summary = result.summary || '';
    return result;
  }
}

module.exports = LLMJudge;
