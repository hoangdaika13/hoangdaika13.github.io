const DEFAULT_MAX_ATTEMPTS = 4;

function parseGeminiKeys(env = process.env) {
  const values = [
    env.GEMINI_API_KEYS,
    env.GEMINI_API_KEY,
    env.GOOGLE_AI_API_KEY
  ];
  const keys = values
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[\r\n,;]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 20);
  return [...new Set(keys)].slice(0, 50);
}

function failureCooldown(status, message = "") {
  const text = String(message).toLowerCase();
  if (status === 401 || status === 403 || /leaked|invalid api key|api key not valid/.test(text)) {
    return 30 * 60 * 1000;
  }
  if (status === 429 || /quota|resource_exhausted|rate limit/.test(text)) {
    return 75 * 1000;
  }
  if (status === 408 || status >= 500) return 15 * 1000;
  return 0;
}

function canTryAnotherKey(status, message = "") {
  return failureCooldown(status, message) > 0;
}

class GeminiKeyPool {
  constructor(keys, options = {}) {
    this.keys = [...new Set((keys || []).filter(Boolean))];
    this.cursor = 0;
    this.cooldowns = new Map();
    this.now = options.now || (() => Date.now());
    this.maxAttempts = Math.max(1, Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS);
  }

  availableCount() {
    const now = this.now();
    return this.keys.filter((key) => Number(this.cooldowns.get(key) || 0) <= now).length;
  }

  candidates() {
    if (!this.keys.length) return [];
    const now = this.now();
    const ordered = this.keys.map((_, index) => this.keys[(this.cursor + index) % this.keys.length]);
    this.cursor = (this.cursor + 1) % this.keys.length;
    const ready = ordered.filter((key) => Number(this.cooldowns.get(key) || 0) <= now);
    const fallback = ready.length ? ready : ordered;
    return fallback.slice(0, Math.min(this.maxAttempts, fallback.length));
  }

  reportFailure(key, status, message) {
    const cooldown = failureCooldown(Number(status || 0), message);
    if (cooldown) this.cooldowns.set(key, this.now() + cooldown);
    return cooldown;
  }

  reportSuccess(key) {
    this.cooldowns.delete(key);
  }
}

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  GeminiKeyPool,
  canTryAnotherKey,
  failureCooldown,
  parseGeminiKeys
};
