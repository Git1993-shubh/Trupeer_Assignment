require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const REQUIRED_VARS = ['TRUPEER_EMAIL', 'TRUPEER_PASSWORD'];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\n` +
        'Copy .env.example to .env at the repo root and set TRUPEER_EMAIL / TRUPEER_PASSWORD.'
    );
  }
}

function getEnv(name, defaultValue = undefined) {
  const value = process.env[name];
  if ((value === undefined || value === '') && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value !== undefined && value !== '' ? value : defaultValue;
}

module.exports = {
  validateEnv,
  getEnv,
  TRUPEER_BASE_URL: () => getEnv('TRUPEER_BASE_URL', 'https://app.trupeer.ai'),
  TRUPEER_EMAIL: () => getEnv('TRUPEER_EMAIL'),
  TRUPEER_PASSWORD: () => getEnv('TRUPEER_PASSWORD'),
  TRUPEER_VIDEO_NAME: () => getEnv('TRUPEER_VIDEO_NAME', 'simple. Website User Guide'),
};
