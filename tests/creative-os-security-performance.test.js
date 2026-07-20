const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const uiModules = [
  "creative-os.js",
  "creative-command-center.js",
  "creative-preproduction.js",
  "creative-ai-workflow.js",
  "creative-production-lab.js",
  "creative-collaboration-os.js",
  "creative-publishing.js",
  "creative-marketplace.js"
];

const coreModules = ["creative-os-core.js", ...uiModules];
const styleModules = [
  "creative-os.css",
  "creative-command-center.css",
  "creative-preproduction.css",
  "creative-ai-workflow.css",
  "creative-production-lab.css",
  "creative-collaboration-os.css",
  "creative-publishing.css",
  "creative-marketplace.css"
];

function lineOf(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function matches(source, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  return [...source.matchAll(matcher)];
}

function report(findings, message) {
  findings.push(message);
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); }
  };
}

test("Creative OS frontend contains no embedded credentials or dynamic code execution", () => {
  const findings = [];
  const secretPatterns = [
    ["Google API key", /AIza[0-9A-Za-z_-]{30,}/g],
    ["AQ credential", /AQ\.[0-9A-Za-z_-]{20,}/g],
    ["OpenAI-style key", /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}/g],
    ["GitHub token", /\b(?:ghp|github_pat)_[0-9A-Za-z_]{20,}/g],
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["credentialed MongoDB URI", /mongodb(?:\+srv)?:\/\/[^\s:'"<>]+:[^\s@'"<>]+@/gi]
  ];

  for (const file of coreModules.filter(exists)) {
    const source = read(file);
    for (const [label, pattern] of secretPatterns) {
      for (const match of matches(source, pattern)) report(findings, `${file}:${lineOf(source, match.index)} embeds a ${label}`);
    }
    for (const match of matches(source, /\beval\s*\(|\bnew\s+Function\s*\(/g)) {
      report(findings, `${file}:${lineOf(source, match.index)} uses dynamic code execution`);
    }
  }

  assert.deepEqual(findings, [], findings.join("\n"));
});

test("every Creative OS iframe is sandboxed", () => {
  const findings = [];
  for (const file of coreModules.filter(exists)) {
    const source = read(file);
    for (const match of matches(source, /<iframe\b[^>]*>/gi)) {
      if (!/\bsandbox(?:\s*=|\s|>)/i.test(match[0])) report(findings, `${file}:${lineOf(source, match.index)} renders an iframe without sandbox`);
    }
    for (const match of matches(source, /createElement\s*\(\s*["']iframe["']\s*\)/gi)) {
      const nearby = source.slice(match.index, match.index + 1400);
      if (!/(?:\.sandbox\b|setAttribute\s*\(\s*["']sandbox["'])/.test(nearby)) {
        report(findings, `${file}:${lineOf(source, match.index)} creates an iframe without assigning sandbox`);
      }
    }
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});

test("transient data, file and blob URLs are never persisted", () => {
  const core = require(path.join(root, "creative-os-core.js"));
  const storage = memoryStorage();
  const store = core.createStore({ storage });
  const project = store.createProject({ name: "Transient media contract" });
  const transientSources = [
    "blob:https://example.test/2d9dd87c-5d54-45a1-a782-f1305be69f1c",
    "file:///C:/Users/Test/private-video.mp4",
    "data:image/png;base64,QUJDRA=="
  ];
  transientSources.forEach((source, index) => store.addAsset(project.id, { name: `asset-${index}.png`, type: "image/png", source }));
  const persisted = Object.values(storage.dump()).join("\n");
  const leakedSchemes = [...new Set((persisted.match(/(?:blob:|file:\/{2,3}|data:)/gi) || []).map((item) => item.toLowerCase()))];
  assert.deepEqual(leakedSchemes, [], `local state persisted transient URL schemes: ${leakedSchemes.join(", ")}`);
});

test("imports and persisted collections have hard bounds", () => {
  const findings = [];
  const core = require(path.join(root, "creative-os-core.js"));
  const preproduction = require(path.join(root, "creative-preproduction.js"));
  const workflow = require(path.join(root, "creative-ai-workflow.js"));
  const production = require(path.join(root, "creative-production-lab.js"));
  const publishing = require(path.join(root, "creative-publishing.js"));
  const many = Array.from({ length: 5001 }, (_, index) => ({ id: `item-${index}`, name: `Item ${index}` }));

  if (core.normalizeState({ projects: many }).projects.length > core.MAX_PROJECTS) report(findings, "creative-os-core.js does not cap projects");
  if (preproduction.normalizeMoodboard({ items: many }).items.length > preproduction.LIMITS.cards) report(findings, "creative-preproduction.js does not cap moodboard items");
  if (preproduction.normalizeStoryboard({ scenes: many }).scenes.length > preproduction.LIMITS.scenes) report(findings, "creative-preproduction.js does not cap storyboard scenes");

  const screens = [{ id: "a", components: [] }, { id: "b", components: [] }];
  const links = many.map((item) => ({ ...item, from: "a", to: "b", componentId: item.id }));
  if (production.normalizePrototype({ screens, links }).links.length > 2000) report(findings, "creative-production-lab.js accepts an unbounded prototype links array");

  const providers = many.map((item) => ({ ...item, configured: false }));
  if (publishing.normalizeState({ providers }).providers.length > 2000) report(findings, "creative-publishing.js accepts an unbounded providers array");

  const oversizedCore = JSON.stringify({ format: core.FORMAT, version: core.VERSION, project: { name: "x".repeat(core.MAX_PROJECT_BYTES + 1) } });
  try { core.importProject(oversizedCore); report(findings, "creative-os-core.js accepts an oversized project import"); } catch (_) {}

  const oversizedWorkflow = JSON.stringify({ format: workflow.FORMAT, version: workflow.VERSION, name: "x".repeat(2_100_000) });
  try { workflow.importProject(oversizedWorkflow); report(findings, "creative-ai-workflow.js accepts an oversized project import"); } catch (_) {}

  assert.deepEqual(findings, [], findings.join("\n"));
});

test("publish adapters cannot report success without provider confirmation", async () => {
  const publishing = require(path.join(root, "creative-publishing.js"));
  let attempt = 0;
  const storage = memoryStorage();
  const store = publishing.createStore({
    storage,
    providerAdapters: {
      youtube: {
        configured: true,
        async publish() {
          attempt += 1;
          return attempt === 1
            ? { status: "sent", remoteId: "not-confirmed" }
            : { status: "published", confirmed: true, remoteId: "confirmed-id" };
        }
      }
    }
  });
  store.addPublication({ id: "security-publish", platform: "youtube", title: "Confirmed publish", mediaUrl: "https://cdn.example.test/video.mp4" });
  store.enqueue("security-publish", "2030-01-01T00:00:00.000Z");
  const unconfirmed = await store.processPublication("security-publish", { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(unconfirmed.ok, false);
  assert.equal(unconfirmed.code, "UNCONFIRMED");
  assert.notEqual(store.getState().queue[0].status, "sent");

  store.retryPublication("security-publish");
  const confirmed = await store.processPublication("security-publish", { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.item.status, "sent");
  assert.ok(confirmed.item.confirmedAt);
});

test("mounted modules clean listeners, timers, animation frames and object URLs", () => {
  const findings = [];
  for (const file of uiModules.filter(exists)) {
    const source = read(file);
    if (/\broot\.addEventListener\s*\(/.test(source) && !/(?:\broot\.removeEventListener\s*\(|new\s+AbortController\s*\()/.test(source)) {
      const match = source.match(/\broot\.addEventListener\s*\(/);
      report(findings, `${file}:${lineOf(source, match.index)} adds root listeners without a removable handler or AbortSignal`);
    }
    if (/\bsetInterval\s*\(/.test(source) && !/\bclearInterval\s*\(/.test(source)) report(findings, `${file} starts an interval without clearInterval`);
    if (/\brequestAnimationFrame\s*\(/.test(source) && !/\bcancelAnimationFrame\s*\(/.test(source)) report(findings, `${file} starts an animation frame without cancellation`);
    if (/\bcreateObjectURL\s*\(/.test(source) && !/\brevokeObjectURL\s*\(/.test(source)) report(findings, `${file} creates object URLs without revocation`);
    if (/(?:getUserMedia|new\s+MediaRecorder)\b/.test(source) && !/getTracks\s*\(\)[\s\S]{0,120}\.stop\s*\(/.test(source)) report(findings, `${file} opens media tracks without stopping them`);
    if (/new\s+(?:AudioContext|webkitAudioContext)\s*\(/.test(source) && !/\.close\s*\(/.test(source)) report(findings, `${file} opens an audio context without closing it`);
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});

test("animated Creative OS styles honor reduced motion and mobile width", () => {
  const findings = [];
  for (const file of styleModules.filter(exists)) {
    const source = read(file);
    if (/(?:@keyframes|\banimation\s*:)/i.test(source) && !/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(source)) {
      report(findings, `${file} animates without a prefers-reduced-motion override`);
    }
    if (!/@media\s*\(\s*max-width\s*:\s*(?:[1-5]\d{2}|600)px\s*\)/i.test(source)) report(findings, `${file} has no mobile breakpoint at 600px or below`);
    for (const match of matches(source, /(?<!max-)\b(?:min-)?width\s*:\s*(?:9\d{2}|[1-9]\d{3,})px\b/gi)) {
      report(findings, `${file}:${lineOf(source, match.index)} has an obvious fixed width likely to overflow mobile`);
    }
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});

test("every routed Creative OS engine exposes unmount", () => {
  const findings = [];
  const shell = read("creative-os.js");
  const engineFiles = [...new Set(matches(shell, /js:\s*["']([^"']+\.js)(?:\?[^"']*)?["']/g).map((match) => match[1]))];
  for (const file of engineFiles) {
    if (!exists(file)) {
      report(findings, `${file} is routed but missing`);
      continue;
    }
    const source = read(file);
    if (!/\bunmount\b/.test(source)) {
      report(findings, `${file} does not expose unmount`);
      continue;
    }
    try {
      const api = require(path.join(root, file));
      if (typeof api.unmount !== "function") report(findings, `${file} does not export unmount()`);
    } catch (error) {
      report(findings, `${file} cannot be loaded for its unmount contract (${error.name})`);
    }
  }
  assert.deepEqual(findings, [], findings.join("\n"));
});
