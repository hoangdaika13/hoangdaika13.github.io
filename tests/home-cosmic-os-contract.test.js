const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-cosmic-os.js");
const styles = read("home-cosmic-os.css");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const index = read("index.html");
const api = require(path.join(root, "home-cosmic-os.js"));

function includesAll(haystack, contracts, label) {
  for (const contract of contracts) {
    assert.ok(haystack.includes(contract), `${label} missing contract: ${contract}`);
  }
}

function versionFor(manifest, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return manifest.match(new RegExp(`${escaped}\\?v=(\\d+)`))?.[1] || "";
}

test("Cosmic OS is a versioned home module in both online and offline manifests", () => {
  assert.match(String(api.VERSION || api.version), /^\d+\.\d+\.\d+$/);
  for (const asset of ["home-cosmic-os.css", "home-cosmic-os.js"]) {
    const loaderVersion = versionFor(loader, asset);
    const workerVersion = versionFor(worker, asset);
    assert.ok(loaderVersion, `performance loader missing versioned ${asset}`);
    assert.ok(workerVersion, `service worker missing versioned ${asset}`);
    assert.equal(workerVersion, loaderVersion, `${asset} versions must agree`);
  }
  assert.match(index, /performance-loader\.js\?v=\d+/);
  assert.match(worker, /hh-identity-portal-v\d+/);
  assert.match(source, /HHHomeCosmicOS/);
  assert.match(source, /data-hco-root/);
});

test("Cosmic OS state is versioned, account scoped and learner-profile scoped", () => {
  assert.match(source, /hh\.home\.cosmic-os\.v\d+/);
  includesAll(source, ["ownerId", "learnerProfileId", "guest", "storageKey"], "storage scope");
  assert.equal(typeof api.scopedKey, "function", "export scopedKey for isolation tests");
  const accountA = api.scopedKey("owner-a", "learner-1");
  const accountB = api.scopedKey("owner-b", "learner-1");
  const profileB = api.scopedKey("owner-a", "learner-2");
  assert.match(accountA, /^hh\.[a-z0-9._:-]+$/i);
  assert.notEqual(accountA, accountB);
  assert.notEqual(accountA, profileB);
  assert.ok(accountA.includes("owner-a") && accountA.includes("learner-1"));
});

test("P0 Morning Brief and Continue Stack are built from real resumable records", () => {
  includesAll(source, [
    "collectMorningBrief", "data-hco-morning-brief", "data-hco-start-day",
    "important-task", "next-event", "lesson-due", "active-transfer",
    "pending-publish", "comic-update", "website-warning", "next-action",
    "collectContinueStack", "data-hco-continue-stack", "data-hco-continue"
  ], "brief and continue");
  for (const kind of ["project", "lesson", "upload", "thumbnail", "comic"]) {
    assert.match(source, new RegExp(`["']${kind}["']`), `Continue Stack missing ${kind}`);
  }
  assert.doesNotMatch(source, /["']game["']/);
  assert.match(source, /slice\(0,\s*5\)/, "Continue Stack must be capped at five real records");
  assert.doesNotMatch(source, /(?:sample|demo|mock)(?:Brief|Continue|Progress)/i);
});

test("P0 Universal Inbox, What's New and Quick Capture expose safe actions", () => {
  includesAll(source, [
    "collectUniversalInbox", "data-hco-inbox", "mark-read", "snooze", "pin", "to-task",
    "collectWhatsNew", "lastVisitAt", "data-hco-whats-new",
    "quick-capture", "suggestCaptureDestination", "data-hco-capture-confirm"
  ], "inbox, delta and capture");
  for (const origin of ["system", "youtube", "facebook", "work", "learning", "website", "download", "render", "comic"]) {
    assert.match(source, new RegExp(`["']${origin}["']`), `Inbox missing ${origin}`);
  }
  for (const type of ["task", "note", "idea", "link", "file", "image", "recording", "event", "vocabulary"]) {
    assert.match(source, new RegExp(`["']${type}["']`), `Quick Capture missing ${type}`);
  }
  assert.match(source, /(?:requiresConfirmation|confirmCapture|capture-confirm)/);
});

test("P0 command routing previews supported intents instead of using dummy buttons", () => {
  includesAll(source, ["commandRegistry", "commandPreview", "data-hco-command-preview", "Control", "KeyK"], "command palette");
  for (const command of [
    "open-japanese", "continue-thumbnail", "create-task", "unpublished-video",
    "backend-health", "continue-comic", "focus-mode"
  ]) assert.match(source, new RegExp(`["']${command}["']`), `missing command ${command}`);
  for (const route of ["/japanese", "/work", "/analytics", "/comic-reader"]) {
    assert.ok(source.includes(route), `missing real command route ${route}`);
  }
});

test("P0 Active Queue supports exact pause, resume and retry transitions", () => {
  includesAll(source, ["collectActiveQueue", "transitionQueueItem", "data-hco-queue", "data-hco-queue-action", "retryFrom"], "active queue");
  for (const kind of ["upload", "download", "render", "ocr", "ai", "import", "sync", "backup"]) {
    assert.match(source, new RegExp(`["']${kind}["']`), `Queue missing ${kind}`);
  }
  assert.equal(typeof api.transitionQueueItem, "function");
  const running = { id: "job-1", state: "running", progress: 37, currentStep: 4 };
  const paused = api.transitionQueueItem(running, "pause");
  assert.equal(paused.state, "paused");
  assert.equal(paused.progress, 37);
  assert.equal(api.transitionQueueItem(paused, "resume").state, "running");
  const retried = api.transitionQueueItem({ ...running, state: "failed", failedStep: 4 }, "retry");
  assert.ok(["queued", "running"].includes(retried.state));
  assert.equal(retried.retryFrom, 4);
});

test("P0 priority scoring is deterministic and always explains its evidence", () => {
  assert.equal(typeof api.priorityScore, "function");
  assert.equal(typeof api.priorityReason, "function");
  const now = Date.parse("2026-08-09T08:00:00.000Z");
  const urgent = { id: "urgent", dueAt: now + 45 * 60 * 1000, priority: "high", progress: 82, blocked: false };
  const later = { id: "later", dueAt: now + 7 * 86400000, priority: "low", progress: 10, blocked: false };
  assert.equal(api.priorityScore(urgent, now), api.priorityScore({ ...urgent }, now));
  assert.ok(api.priorityScore(urgent, now) > api.priorityScore(later, now));
  const reason = api.priorityReason(urgent, now);
  assert.equal(typeof reason, "string");
  assert.ok(reason.trim().length >= 12);
  assert.match(reason, /45|deadline|háº¡n/i);
});

test("P1 Focus, split workspace and time machine remain inside the home workspace", () => {
  includesAll(source, [
    "focus-cockpit", "pomodoro", "focus-file", "focus-music", "focus-note", "focus-progress", "complete-focus", "switch-focus",
    "split-workspace", "splitPreset", "calendar-work", "thumbnail-title", "youtube-schedule", "english-dictionary", "comic-notes", "upload-channel",
    "activity-time-machine", "opened", "file-edited", "setting-changed", "task-completed", "error", "ai-created", "restore-preview"
  ], "focus, split and time machine");
  assert.doesNotMatch(source, /window\.open\s*\(/, "Split Workspace must not open OS/browser windows");
  assert.match(source, /(?:restore-confirm|requiresConfirmation|confirmRestore)/);
});

test("P1 automation scenes, radar and calendar have resumable, inspectable state", () => {
  includesAll(source, [
    "automation-scenes", "start-video", "publish-today", "quick-study", "check-website", "prepare-sleep", "end-day-backup",
    "automation-radar", "running", "queued", "failed", "needs-confirmation", "completed", "retryFrom", "automation-log",
    "smart-calendar", "personal", "deadline", "youtube", "facebook", "learning", "render", "comic", "website",
    "calendar-day", "calendar-week", "calendar-timeline"
  ], "automation and calendar");
});

test("P1 drop zone waits for a destination and clipboard protects sensitive values", () => {
  includesAll(source, [
    "dragenter", "dragover", "drop", "global-drop-zone", "thumbnail", "ocr", "convert", "upload-video", "add-project", "audio-analysis", "backup", "device-vault",
    "smart-clipboard", "clipboard-pin", "clipboard-expires", "isSensitiveClipboard"
  ], "drop zone and clipboard");
  assert.match(source, /(?:drop-choice|chooseDropAction|pendingDrop)/, "files must wait for an explicit destination");
  assert.equal(typeof api.isSensitiveClipboard, "function");
  assert.equal(api.isSensitiveClipboard("sk-proj-example-secret-value"), true);
  assert.equal(api.isSensitiveClipboard("Authorization: Bearer very-private-token"), true);
  assert.equal(api.isSensitiveClipboard("Ã tÆ°á»Ÿng video cho tuáº§n nÃ y"), false);
});

test("P1 project, content and learning pulses use current module data", () => {
  includesAll(source, [
    "project-pulse", "progress", "deadline", "members", "blocked", "recentFile", "lastOpenedAt", "relatedTools",
    "content-pipeline", "idea", "script", "voice", "image", "thumbnail", "render", "review", "publish",
    "learning-pulse", "english", "japanese", "reviewsDue", "weakSkill", "nextLesson", "quick-study-5", "quick-study-10", "quick-study-15"
  ], "project, content and learning pulse");
  assert.match(source, /hh-project-center/);
  assert.match(source, /hh\.learning/);
});

test("P1 Website Mission Control reports only probed or explicitly unknown services", () => {
  includesAll(source, [
    "website-mission-control", "frontend", "backend", "database", "oauth", "youtube", "facebook", "resend", "gemini", "openai", "vercel", "service-worker", "web-vitals",
    "checking", "unknown", "unsupported", "lastCheckedAt"
  ], "mission control");
  assert.match(source, /\/api\/(?:health|platform\/summary)/);
  assert.match(source, /(?:response\.ok|probeResult|verifiedAt)/);
  assert.doesNotMatch(source, /(?:default|initial).*status\s*:\s*["'](?:online|healthy|active)["']/i);
  assert.doesNotMatch(source, /(?:fake|mock|random)(?:Latency|Health|Status|Metric)/i);
});

test("P2 galaxy signals and concierge reflect state without autonomous publishing", () => {
  includesAll(source + styles, [
    "signal-deadline", "signal-transfer", "signal-backend-error", "signal-comic", "signal-learning", "signal-recent",
    "cosmic-concierge", "summarize-day", "find-tool", "explain-warning", "next-step", "create-plan", "draft-content"
  ], "reactive galaxy and concierge");
  assert.match(source, /(?:dangerous-action|requiresConfirmation|concierge-confirm)/);
  assert.doesNotMatch(source, /(?:autoPublish|publishWithoutConfirm|autoPost)\s*[:=(]\s*(?:true|1)/i);
});

test("P2 context profiles and constellation progress preserve truthful user data", () => {
  includesAll(source, [
    "context-aware", "morning", "work-hours", "evening", "active-upload", "website-incident", "near-deadline",
    "home-profiles", "work", "learning", "creative", "website", "family",
    "constellation-progress", "tasksCompleted", "vocabularyLearned", "contentPublished", "projectsCompleted", "focusMinutes", "skillsUnlocked"
  ], "context, profiles and constellation");
  assert.doesNotMatch(source, /hh\.astral-realms|\/entertainment|\/character-3d/);
  assert.doesNotMatch(source, /(?:fakeScore|randomScore|pressureStreak)/i);
});

test("P2 mini windows, ambient desktop and screensaver remain local and user controlled", () => {
  includesAll(source, [
    "cosmic-mini-window", "calculator", "notes", "music", "calendar", "timer", "image-viewer", "download-queue", "api-monitor",
    "mini-minimize", "mini-pin", "mini-resize", "mini-snap",
    "ambient-desktop", "weather", "work-mode", "website-status", "music-playing", "season",
    "cosmic-screensaver", "idleTimeout", "pointermove", "keydown", "next-event"
  ], "mini windows, ambient and screensaver");
  assert.match(source, /ambientSound[^\n]{0,100}(?:false|off)/i, "ambient sound must default off");
  assert.doesNotMatch(source, /new\s+Audio\([^)]*\)\.play\s*\(\)/, "ambient audio needs a user gesture");
});

test("P2 QR handoff excludes credentials and Security Beacon covers real risks", () => {
  includesAll(source, [
    "cross-device-handoff", "handoffId", "lesson", "comic", "note", "upload", "task", "qr",
    "security-beacon", "session", "new-device", "microphone", "geolocation", "oauth-expiry", "account-connection", "last-backup", "local-only"
  ], "handoff and security beacon");
  assert.equal(typeof api.safeHandoffPayload, "function");
  const handoff = api.safeHandoffPayload({
    type: "lesson",
    stateId: "lesson-a1-03",
    ownerId: "owner-a",
    accessToken: "never-in-qr",
    refresh_token: "never-in-qr-either",
    password: "secret"
  });
  const serialized = JSON.stringify(handoff);
  assert.ok(serialized.includes("lesson-a1-03"));
  assert.doesNotMatch(serialized, /never-in-qr|password|accessToken|refresh_token/i);
});

test("client safety forbids embedded secrets, fake browser metrics and native dialogs", () => {
  assert.doesNotMatch(source, /\b(?:alert|confirm|prompt)\s*\(/, "use the internal modal/notice system");
  assert.doesNotMatch(source, /(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|EAA[A-Za-z0-9]{30,})/);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^\n]*(?:secret|password|access.?token|refresh.?token)/i);
  assert.doesNotMatch(source, /(?:CPU|RAM)\s*(?:toÃ n mÃ¡y|máy tính)/i);
  assert.doesNotMatch(source, /ICMP\s*(?:ping|latency)/i);
  assert.match(source, /escapeHtml|textContent/);
});

test("delegated controls cannot be shadowed by root state attributes", () => {
  assert.match(source, /closest\("button\[data-hco-open\]"\)/, "launcher handler must target the button, not the V4 root");
  assert.match(source, /closest\("button\[data-hco-profile\]"\)/, "profile handler must target an explicit profile button");
  const routeIndex = source.indexOf('const routeNode = target.closest("[data-hco-route]")');
  for (const selector of ["[data-hco-split-preset]", "[data-hco-pipeline-step]", "[data-hco-restore-preview]"]) {
    assert.ok(source.indexOf(selector) < routeIndex, `${selector} must be handled before generic navigation`);
  }
  assert.match(source, /dataset\.hcoOverlayOpen/, "overlay state must not reuse the launcher attribute");
});

test("runtime remount and auth changes preserve owner isolation", () => {
  includesAll(source, ["currentIdentity", "GUEST_FLAG_KEY", "hasAuthenticatedOwner", "instance.storageKey", "nextStorageKey"], "owner lifecycle");
  const ownerBlock = source.match(/function ownerScope\([\s\S]*?\n\s*\}/)?.[0] || "";
  assert.doesNotMatch(ownerBlock, /\.email/, "email is not a stable server owner identifier");
  assert.match(source, /new global\.MutationObserver\(\(\) => \{ attach\(\); \}\)/, "root replacement observer must remain active");
  assert.doesNotMatch(source, /MutationObserver\([^\n]+observer\.disconnect/, "observer must not detach after the first V4 root");
});

test("one-screen CSS remains usable on narrow screens and reduced motion", () => {
  assert.match(styles, /\.hco(?:\s|[-.[#:{])/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /minmax\(0,\s*1fr\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*(?:700|760)px\)/);
  assert.match(styles, /@media\s*\([^)]*(?:1100|1179|1180)px[^)]*\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /prefers-reduced-motion[^}]*animation(?:-duration)?:\s*(?:none|0\.0?1ms)/s);
  assert.doesNotMatch(styles, /font-size:\s*(?:[0-9]|10)px\s*;/, "readable Cosmic OS text must stay at least 11px");
});
