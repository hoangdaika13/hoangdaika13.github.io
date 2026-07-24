const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("login repair stylesheet loads last and keeps the primary form compact", () => {
  const html = read("index.html");
  const css = read("auth-login-repair.css");
  assert.match(html, /motion-comfort\.css[^>]+>\s*<link rel="stylesheet" href="auth-login-repair\.css\?v=3"/);
  assert.match(css, /data-auth-view="login"[^}]+#gateLoginForm/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /\.hh-consent-banner\[data-privacy-banner\]/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]+\.auth-gate-brand[\s\S]+display:\s*none/);
});

test("auth runtime publishes the active view for responsive layout", () => {
  const runtime = read("auth-platform.js");
  const experience = read("auth-experience.js");
  assert.match(runtime, /gate\.dataset\.authView = "login"/);
  assert.match(runtime, /gate\.dataset\.authView = name/);
  assert.match(runtime, /Bước 2\/3 · Hoàn thiện hồ sơ hiển thị/);
  assert.match(runtime, /Khôi phục mật khẩu bằng email đã xác minh/);
  assert.match(runtime, /typeof event\.getModifierState === "function"/);
  assert.match(experience, /if \(!window\.HHAuthPlatform\?\.init\)/);
});

test("auth requests time out cleanly instead of leaving the form busy forever", () => {
  const runtime = read("auth-platform.js");
  const html = read("index.html");
  const worker = read("sw.js");
  assert.match(runtime, /AUTH_REQUEST_TIMEOUT\s*=\s*9000/);
  assert.match(runtime, /Cổng đăng nhập đã sẵn sàng · đang khôi phục phiên nền/);
  assert.match(runtime, /authEpoch\s*\+=\s*1/);
  assert.match(runtime, /new AbortController\(\)/);
  assert.match(runtime, /controller\.abort\("auth-timeout"\)/);
  assert.match(runtime, /Máy chủ phản hồi quá lâu/);
  assert.match(runtime, /finally\s*\{[\s\S]*?clearTimeout\(timeoutId\)/);
  assert.match(html, /auth-platform\.js\?v=12/);
  assert.match(worker, /auth-platform\.js\?v=12/);
  assert.match(runtime, /hh:logout-request/);
  assert.match(runtime, /history\.replaceState\(\{\}, document\.title/);
});

test("successful authentication unlocks the workspace before optional animation", () => {
  const runtime = read("auth-platform.js");
  const shellRuntime = read("script.js");
  const shellStyles = read("app-shell.css");
  const completeAuth = runtime.slice(runtime.indexOf("const completeAuth"), runtime.indexOf("const loadMe"));
  assert.match(completeAuth, /setGateState\(\);[\s\S]*connectSocket\(\);/);
  assert.match(completeAuth, /Promise\.resolve\(transition\.play/);
  assert.doesNotMatch(completeAuth, /await\s+transition\.play/);
  assert.match(runtime, /gate\.hidden\s*=\s*authenticated/);
  assert.match(runtime, /gate\.inert\s*=\s*authenticated/);
  assert.match(runtime, /HHAuthCreativeUniverse\?\.destroy/);
  assert.match(shellRuntime, /const releaseAuthInteractionLocks/);
  assert.match(shellRuntime, /gate\.style\.pointerEvents\s*=\s*"none"/);
  assert.match(shellStyles, /auth-unlocked[\s\S]*?#authGate[\s\S]*?pointer-events:\s*none\s*!important/);
});

test("authentication boots independently from the large application bundle", () => {
  const html = read("index.html");
  const runtime = read("auth-platform.js");
  const worker = read("sw.js");
  assert.match(html, /auth-platform\.js\?v=12[\s\S]*script\.js\?v=131/);
  assert.match(runtime, /realtimeUrl:\s*String\(window\.HH_REALTIME_URL/);
  assert.match(runtime, /socketUrl:\s*String\(window\.HH_SOCKET_URL/);
  assert.match(runtime, /hh:auth-bootstrap-ready/);
  assert.match(runtime, /document\.querySelector\("#authGate"\)[\s\S]*?start\(\)/);
  assert.match(runtime, /document\.addEventListener\("DOMContentLoaded", start/);
  assert.doesNotMatch(worker, /auth-bootstrap\.js/);
});

test("auth bootstrap and security notifications cannot block on optional services", () => {
  const api = read("api/auth/[...action].js");
  const security = read("utils/auth-security.js");
  assert.match(api, /if \(route === "providers"[\s\S]*?setCors\(req, res\)[\s\S]*?providerPayload\(req\)/);
  assert.match(api, /route === "me"[\s\S]*?!req\.headers\.authorization[\s\S]*?parseCookies\(req\)\.hh_session/);
  assert.match(api, /Promise\.race\(\[[\s\S]*?Promise\.allSettled\(tasks\)/);
  assert.match(api, /settleOptionalTasks\(\[[\s\S]*?notifyNewDevice[\s\S]*?recordLoginEvent/);
  assert.match(security, /new AbortController\(\)/);
  assert.match(security, /setTimeout\(\(\) => controller\.abort\(\), 3500\)/);
  assert.match(security, /signal:\s*controller\.signal/);
});

test("public provider and anonymous session checks work without opening MongoDB", async () => {
  const handler = require("../api/auth/[...action].js");
  const previousMongo = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;

  const invoke = async ({ action, url }) => {
    const result = { statusCode: 0, body: null, headers: {} };
    const req = {
      method: "GET",
      query: { action },
      url,
      headers: {
        host: "nhhoang13all.xyz",
        origin: "https://nhhoang13all.xyz",
        "x-forwarded-proto": "https"
      }
    };
    const res = {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; },
      end() { return this; }
    };
    await handler(req, res);
    return result;
  };

  try {
    const providers = await invoke({ action: ["providers"], url: "/api/auth/providers" });
    assert.equal(providers.statusCode, 200);
    assert.equal(typeof providers.body.google, "boolean");
    assert.equal(providers.headers["Cache-Control"], "no-store");

    const session = await invoke({ action: ["me"], url: "/api/auth/me" });
    assert.equal(session.statusCode, 200);
    assert.deepEqual(session.body, { user: null, loginHistory: [] });
  } finally {
    if (previousMongo === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongo;
  }
});

test("Google OAuth starts without MongoDB and redirects with a state cookie", async () => {
  const handler = require("../api/auth/[...action].js");
  const previous = {
    mongo: process.env.MONGODB_URI,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callback: process.env.GOOGLE_CALLBACK_URL,
    frontend: process.env.FRONTEND_URL,
    jwt: process.env.JWT_SECRET
  };
  delete process.env.MONGODB_URI;
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_CALLBACK_URL = "https://nhhoang13all.xyz/api/auth/google/callback";
  process.env.FRONTEND_URL = "https://nhhoang13all.xyz";
  process.env.JWT_SECRET = "test-only-jwt-secret-with-more-than-thirty-two-characters";

  const result = { statusCode: 0, location: "", headers: {} };
  const req = {
    method: "GET",
    query: { action: ["google"], returnTo: "https://nhhoang13all.xyz" },
    url: "/api/auth/google?returnTo=https%3A%2F%2Fnhhoang13all.xyz",
    headers: {
      host: "nhhoang13all.xyz",
      origin: "https://nhhoang13all.xyz",
      "x-forwarded-proto": "https"
    }
  };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    getHeader(name) { return result.headers[name]; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
    redirect(location) { result.statusCode = 302; result.location = location; return this; },
    end() { return this; }
  };

  try {
    await handler(req, res);
    assert.equal(result.statusCode, 302);
    assert.match(result.location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    assert.match(result.location, /redirect_uri=https%3A%2F%2Fnhhoang13all\.xyz%2Fapi%2Fauth%2Fgoogle%2Fcallback/);
    assert.match(String(result.headers["Set-Cookie"]), /hh_oauth_google=/);
    assert.match(String(result.headers["Set-Cookie"]), /HttpOnly/);
  } finally {
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("MONGODB_URI", previous.mongo);
    restore("GOOGLE_CLIENT_ID", previous.clientId);
    restore("GOOGLE_CLIENT_SECRET", previous.clientSecret);
    restore("GOOGLE_CALLBACK_URL", previous.callback);
    restore("FRONTEND_URL", previous.frontend);
    restore("JWT_SECRET", previous.jwt);
  }
});

test("Google OAuth bootstraps on the configured callback origin", () => {
  const api = read("api/auth/[...action].js");
  assert.match(api, /const callbackOrigin = new URL\(redirectUri\)\.origin/);
  assert.match(api, /if \(callbackOrigin !== requestOrigin\)/);
  assert.match(api, /new URL\(`\/api\/auth\/\$\{provider\}`,[^)]*callbackOrigin\)/);
});
