const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readOptional(file) {
  const target = path.join(root, file);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function readDirectoryJavaScript(directory) {
  const target = path.join(root, directory);
  if (!fs.existsSync(target)) return "";
  return fs.readdirSync(target, { withFileTypes: true }).map((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return readDirectoryJavaScript(path.relative(root, child));
    return entry.isFile() && entry.name.endsWith(".js") ? fs.readFileSync(child, "utf8") : "";
  }).join("\n");
}

function assertConcept(source, label, patterns) {
  assert.ok(
    patterns.some((pattern) => pattern.test(source)),
    `Thiếu contract ${label}. Chấp nhận một trong các dấu hiệu: ${patterns.map(String).join(", ")}`
  );
}

function assertPattern(source, pattern, message) {
  assert.ok(pattern.test(source), message || `Thiếu contract ${pattern}`);
}

function assertNoPattern(source, pattern, message) {
  assert.ok(!pattern.test(source), message || `Không được xuất hiện ${pattern}`);
}

const html = read("index.html");
const css = [
  readOptional("auth-experience.css"),
  readOptional("auth-platform.css"),
  readOptional("motion-comfort.css")
].join("\n");
const client = [
  read("script.js"),
  readOptional("auth-experience.js"),
  readOptional("auth-platform.js"),
  readOptional("auth-security.js")
].join("\n");
const ui = `${html}\n${client}`;
const api = [
  readDirectoryJavaScript("api/auth"),
  readOptional("utils/platform.js")
].join("\n");

test("auth gate exposes login/register tabs and a persistent three-step signup flow", () => {
  assert.match(html, /data-auth-tab=["']login["']/i);
  assert.match(html, /data-auth-tab=["']register["']/i);
  assert.match(html, /data-auth-panel=["']login["']/i);
  assert.match(html, /data-auth-panel=["']register["']/i);

  for (const step of [1, 2, 3]) {
    assert.match(
      ui,
      new RegExp(`data-(?:signup|register)-step=["']${step}["']`, "i"),
      `Đăng ký cần có bước ${step} với data-signup-step hoặc data-register-step ổn định.`
    );
  }
  assertConcept(ui, "điều hướng lùi không mất dữ liệu", [
    /data-(?:signup|register)-(?:back|previous)/i,
    /(?:signup|register)(?:Back|Previous|Prev)/
  ]);
  assertConcept(ui, "avatar trong bước hồ sơ", [/data-(?:signup|register)-avatar/i, /name=["']avatar["']/i]);
  assertConcept(ui, "lĩnh vực quan tâm", [/data-(?:signup|register)-interest/i, /name=["']interests?(?:\[\])?["']/i]);
});

test("login offers remember, recovery, passkey, other-device, guest and privacy actions", () => {
  const contracts = {
    "ghi nhớ đăng nhập": [/name=["']remember["']/i, /data-auth-(?:action=["']remember|remember)/i],
    "quên mật khẩu": [/data-auth-(?:action=["']forgot|forgot)/i, /id=["'][^"']*forgot/i],
    "Passkey": [/data-auth-(?:action=["']passkey|passkey)/i, /id=["'][^"']*passkey/i],
    "đăng nhập bằng thiết bị khác": [/data-auth-(?:action=["'](?:device|qr)|(?:device|qr))/i, /id=["'][^"']*(?:device|qr)/i],
    "tiếp tục với tư cách khách": [/data-auth-(?:action=["']guest|guest)/i, /id=["'][^"']*guest/i],
    "trung tâm quyền riêng tư": [/data-auth-(?:action=["']privacy|privacy)/i, /href=["'][^"']*privacy/i]
  };
  for (const [label, patterns] of Object.entries(contracts)) assertConcept(ui, label, patterns);
});

test("forms support password managers, inline errors and Caps Lock feedback", () => {
  assert.match(html, /autocomplete=["']email["']/i);
  assert.match(html, /autocomplete=["']current-password["']/i);
  assert.match(html, /autocomplete=["']new-password["']/i);
  assertConcept(html, "vùng thông báo lỗi sống", [/aria-live=["'](?:polite|assertive)["']/i, /role=["']alert["']/i]);
  assertConcept(ui, "lỗi theo từng trường", [
    /data-(?:auth-)?error-for=/i,
    /aria-describedby=["'][^"']*(?:error|hint)/i,
    /setCustomValidity\s*\(/
  ]);
  assert.match(client, /getModifierState\s*\(\s*["']CapsLock["']\s*\)/);
  assert.doesNotMatch(
    `${readOptional("auth-experience.js")}\n${readOptional("auth-platform.js")}\n${readOptional("auth-security.js")}`,
    /(?:window\.)?(?:alert|prompt|confirm)\s*\(/,
    "Auth UI phải dùng thông báo nội tuyến hoặc dialog tùy biến, không dùng hộp thoại trình duyệt thô."
  );
});

test("Google Identity Services and WebAuthn have real client hooks", () => {
  assert.match(html, /data-oauth-provider=["']google["']/i);
  assertConcept(`${html}\n${client}`, "Google Identity Services", [
    /accounts\.google\.com\/gsi\/client/i,
    /google\.accounts\.id\.(?:initialize|renderButton|prompt)/
  ]);
  assertPattern(client, /PublicKeyCredential|navigator\.credentials/, "Thiếu feature detection WebAuthn.");
  assertPattern(client, /navigator\.credentials\.(?:create|get)\s*\(/, "Thiếu lời gọi WebAuthn thật.");
  assertPattern(client, /credentials\s*:\s*["']include["']/, "Auth fetch phải gửi cookie phiên bằng credentials: include.");
});

test("cross-domain Google OAuth uses a short-lived one-time exchange code", () => {
  assertPattern(api, /type:\s*["']oauth-exchange["']/, "OAuth callback cần phát hành challenge dùng một lần.");
  assertPattern(api, /route\s*===\s*["']exchange["']/, "Auth API cần endpoint đổi mã OAuth thành session.");
  assertPattern(client, /authCode/, "Client cần nhận mã OAuth dùng một lần.");
  assertPattern(client, /\/api\/auth\/exchange/, "Client cần đổi mã ở backend trước khi mở dashboard.");
  assertNoPattern(api, /[?&](?:token|access_token|authToken)=/i, "Không được đặt bearer token trong URL callback.");
});

test("auth never persists passwords, bearer tokens or API keys in browser storage or URLs", () => {
  const unsafeStorageLines = client.split(/\r?\n/).filter((line) =>
    /(?:localStorage|sessionStorage)/.test(line)
    && /(?:password|auth[-_]?token|access[-_]?token|refresh[-_]?token|api[-_ ]?key)/i.test(line)
  );
  const unsafeStorageSummary = unsafeStorageLines
    .slice(0, 8)
    .map((line) => line.trim().slice(0, 180))
    .join("\n");
  assert.equal(
    unsafeStorageLines.length,
    0,
    `Phát hiện ${unsafeStorageLines.length} chỗ lưu bí mật auth trong browser storage:\n${unsafeStorageSummary}`
  );
  assertNoPattern(client, /(?:URLSearchParams|searchParams)\([^)]*\)[\s\S]{0,240}(?:authToken|access_token)/i, "Client không được đọc token từ URL.");
  assertNoPattern(api, /[?&](?:authToken|access_token)=/i, "OAuth callback không được trả token qua query string.");
});

test("server issues an HttpOnly session cookie and enforces login abuse controls", () => {
  assertPattern(api, /(?:__Host-)?hh_(?:session|auth_session|sid)\s*=/i, "Cần cookie phiên riêng; cookie OAuth state không thay thế session.");
  assertPattern(api, /HttpOnly/i, "Cookie phiên phải có HttpOnly.");
  assertPattern(api, /Secure/i, "Cookie phiên phải có Secure.");
  assertPattern(api, /SameSite=(?:Lax|Strict|None)/i, "Cookie phiên phải khai báo SameSite; backend khác miền cần SameSite=None kèm Secure.");
  assertPattern(api, /enforceRateLimit|rateLimit/i, "Đăng nhập và đăng ký phải có rate limit.");
  assertConcept(api, "khóa tạm sau nhiều lần sai", [
    /failedLoginAttempts|loginFailures|failedAttempts/i,
    /lockedUntil|lockoutUntil|accountLock/i
  ]);
  assertConcept(api, "CAPTCHA thích ứng", [/captcha.*(?:risk|suspicious|required)/is, /(?:risk|suspicious).*captcha/is]);
});

test("auth API covers email availability, OTP verification and recovery", () => {
  assertConcept(api, "kiểm tra email tồn tại", [
    /email(?:-|_|\/)availability/i,
    /availability(?:-|_|\/)?email/i
  ]);
  assertConcept(api, "gửi OTP", [/otp(?:-|_|\/)(?:request|send)/i, /(?:request|send)(?:-|_|\/)?otp/i]);
  assertConcept(api, "xác minh OTP", [/otp(?:-|_|\/)(?:verify|confirm)/i, /(?:verify|confirm)(?:-|_|\/)?otp/i]);
  assertConcept(api, "quên/đặt lại mật khẩu", [
    /forgot(?:-|_|\/)password/i,
    /password(?:-|_|\/)(?:reset|recovery)/i
  ]);
});

test("auth API exposes complete passkey ceremonies", () => {
  assertConcept(api, "tạo registration options", [/generateRegistrationOptions/, /passkey.*register.*options/is]);
  assertConcept(api, "xác minh đăng ký passkey", [/verifyRegistrationResponse/, /passkey.*register.*verify/is]);
  assertConcept(api, "tạo authentication options", [/generateAuthenticationOptions/, /passkey.*(?:login|authenticate).*options/is]);
  assertConcept(api, "xác minh đăng nhập passkey", [/verifyAuthenticationResponse/, /passkey.*(?:login|authenticate).*verify/is]);
  assertPattern(api, /challenge/i, "Passkey challenge phải được lưu và xác minh phía server.");
  assertPattern(api, /counter/i, "Passkey authenticator counter phải được cập nhật chống replay.");
});

test("session/device management and QR login use revocable server-side routes", () => {
  assertConcept(api, "danh sách phiên", [/route\s*===?\s*["']sessions["']/, /sessions?(?:-|_|\/)list/i]);
  assertConcept(api, "thu hồi một phiên", [/sessions?(?:-|_|\/)(?:revoke|delete)/i, /revokeSession/i]);
  assertConcept(api, "đăng xuất mọi thiết bị", [/logout(?:-|_|\/)all/i, /revokeAllSessions/i]);
  assertConcept(api, "tạo QR login", [/qr(?:-|_|\/)(?:create|start)/i, /createQrLogin/i]);
  assertConcept(api, "theo dõi QR login", [/qr(?:-|_|\/)(?:status|poll)/i, /getQrLoginStatus/i]);
  assertConcept(api, "phê duyệt QR login", [/qr(?:-|_|\/)(?:approve|confirm)/i, /approveQrLogin/i]);
  assertConcept(api, "hết hạn QR", [/expiresAt|ttl|expireAfterSeconds/i]);
});

test("production auth actions use Vercel-safe flat endpoints", () => {
  const platform = readOptional("auth-platform.js");
  const app = read("script.js");
  const handler = readDirectoryJavaScript("api/auth");
  assertNoPattern(
    `${platform}\n${app}`,
    /\/api\/auth\/(?:passkey|forgot-password|email-verification|qr|sessions)\//,
    "Client không được gọi auth route nhiều tầng vì Vercel có thể trả 404 trước khi tới catch-all handler."
  );
  for (const alias of [
    "passkey-login-options", "passkey-login-verify", "password-recovery-request",
    "password-recovery-verify", "password-recovery-reset", "email-verification-request",
    "email-verification-verify", "qr-create", "qr-status", "qr-approve",
    "passkey-register-options", "passkey-register-verify", "passkey-revoke", "session-revoke"
  ]) assert.match(handler, new RegExp(`\\"${alias}\\"`), `Auth handler thiếu alias ${alias}.`);
});

test("email signup and recovery expose provider availability without dead ends", () => {
  assert.match(html, /data-register-provider-notice/i);
  assert.match(client, /oauthProviders\.email\s*===\s*false/);
  assert.match(client, /email-provider-unavailable/);
  assert.match(api, /EMAIL_PROVIDER_UNAVAILABLE/);
  assert.doesNotMatch(
    `${readOptional("auth-experience.js")}\n${readOptional("auth-platform.js")}`,
    /\.reportValidity\s*\(/,
    "Auth phải báo lỗi nội tuyến thay vì dùng popup validation thô của trình duyệt."
  );
});

test("returning-user, loading and service-isolation states are represented", () => {
  assertConcept(ui, "lời chào người quay lại", [/data-auth-returning/i, /returningUser|welcomeBack/i]);
  assertConcept(ui, "workspace gần nhất", [/data-auth-recent-workspace/i, /recentWorkspace/i]);
  assertConcept(ui, "dự án gần đây", [/data-auth-recent-project/i, /recentProject/i]);
  assertConcept(ui, "thiết bị hoặc phiên gần nhất", [/data-auth-last-(?:device|session)/i, /last(?:Device|Session)/]);
  assertConcept(ui, "skeleton OAuth", [/auth-(?:oauth-)?skeleton/i, /data-auth-loading/i]);
  assertConcept(ui, "trạng thái xác thực", [/data-auth-state/i, /is-authenticating|is-auth-success|is-redirecting/i]);
  assertConcept(client, "OAuth lỗi không khóa email form", [
    /oauth[\s\S]{0,200}(?:disabled\s*=\s*false|removeAttribute\(["']disabled)/i,
    /setOAuthError|renderOAuthError/
  ]);
});

test("auth remains accessible, touch-friendly and compact on mobile", () => {
  assert.match(html, /role=["']tablist["']/i);
  assert.match(html, /aria-selected=/i);
  assertConcept(html, "nhãn trạng thái cho công nghệ hỗ trợ", [/aria-live=/i, /role=["']status["']/i]);
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height\s*:\s*(?:4[4-9]|[5-9]\d|1\d{2,})px/i, "Control cảm ứng auth cần cao tối thiểu 44px.");
  assert.match(css, /@media\s*\(\s*max-width\s*:\s*(?:560|640|680)px\s*\)[\s\S]*(?:auth-product-preview|auth-feature-showcase|auth-mobile-preview)/i);
  assertConcept(css, "preview mobile gọn", [
    /@media\s*\(\s*max-width[^)]*\)[\s\S]{0,1800}(?:auth-product-preview|auth-feature-showcase)[\s\S]{0,240}(?:display\s*:\s*none|max-height|scale\()/i,
    /auth-mobile-preview[\s\S]{0,240}(?:display|max-height|grid-template)/i
  ]);
});
