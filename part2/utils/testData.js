const env = require('./env');

module.exports = {
  aiPrompts: {
    concise: 'Make this script more concise',
    professional: 'Make this script more professional',
  },

  /** Extremely long prompt for negative / boundary testing (UI limit is 300 chars). */
  longPrompt: 'Please rewrite this entire script in exhaustive detail. '.repeat(20),

  defaultVideoName: () => env.TRUPEER_VIDEO_NAME(),
};
