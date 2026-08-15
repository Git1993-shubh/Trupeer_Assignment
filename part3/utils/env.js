const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_TRUPEER = ['TRUPEER_BASE_URL', 'TRUPEER_EMAIL', 'TRUPEER_PASSWORD'];

function validateEnv() {
  const missing = REQUIRED_TRUPEER.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n` +
        `Set them in the repo root .env file.`
    );
  }

  if (!llmApiKey()) {
    throw new Error(
      'Missing LLM API key in the root .env file.\n' +
        'Set LLM_API_KEY, or provider-specific: OPENAI_API_KEY / ANTHROPIC_API_KEY.\n' +
        'OpenAI:    LLM_PROVIDER=openai     LLM_MODEL=gpt-4o-mini\n' +
        'Gemini:    LLM_PROVIDER=gemini     LLM_MODEL=gemini-2.0-flash\n' +
        'Anthropic: LLM_PROVIDER=anthropic  LLM_MODEL=claude-haiku-4-5-20251001  ANTHROPIC_API_KEY=sk-ant-...'
    );
  }
}

function getEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${name} is not set`);
    }
    return defaultValue;
  }
  return value;
}

function llmApiKey() {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  if (provider === 'anthropic') {
    return (process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || '').trim();
  }
  if (provider === 'openai') {
    return (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  }
  return (
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    ''
  ).trim();
}

module.exports = {
  validateEnv,
  getEnv,
  TRUPEER_BASE_URL: () => getEnv('TRUPEER_BASE_URL'),
  TRUPEER_EMAIL: () => getEnv('TRUPEER_EMAIL'),
  TRUPEER_PASSWORD: () => getEnv('TRUPEER_PASSWORD'),
  TRUPEER_VIDEO_NAME: () => getEnv('TRUPEER_VIDEO_NAME', 'simple. Website User Guide'),
  LLM_API_KEY: () => {
    const key = llmApiKey();
    if (!key) throw new Error('LLM API key is not set');
    return key;
  },
  LLM_PROVIDER: () => getEnv('LLM_PROVIDER', 'openai'),
  LLM_MODEL: () => getEnv('LLM_MODEL', 'gpt-4o-mini'),
  PLAYWRIGHT_HEADED: () => String(process.env.PLAYWRIGHT_HEADED || '').toLowerCase() === 'true',
};
