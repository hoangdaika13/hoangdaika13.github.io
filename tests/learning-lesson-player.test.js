const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "learning-lesson-player.js"), "utf8");
const css = fs.readFileSync(path.join(root, "learning-lesson-player.css"), "utf8");
const mod = require("../learning-lesson-player.js");

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    dispatchEvent(event) { for (const handler of listeners.get(event.type) || []) handler(event); return true; },
    count(type) { return listeners.get(type)?.size || 0; }
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values
  };
}

function host() {
  return {
    ...eventTarget(),
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function fixture() {
  const lesson = {
    id: "technology-a1-01", trackId: "technology", level: "A1", title: "Software release",
    minutes: 8, skills: ["vocabulary", "speaking"], difficulty: 2, xp: 25
  };
  let state = {
    activeLessonId: lesson.id,
    profile: { level: "A1", retentionGoal: 90 },
    progress: {}, mistakes: [], reviews: []
  };
  const store = {
    get: () => JSON.parse(JSON.stringify(state)),
    update(recipe) { state = recipe(JSON.parse(JSON.stringify(state))) || state; return this.get(); },
    recordStudy(payload) {
      state.progress[payload.lessonId] = { status: "completed", score: payload.score };
      return this.get();
    }
  };
  const core = {
    lessons: [lesson, { ...lesson, id: "technology-a2-01", level: "A2", title: "Next lesson" }],
    uid: (prefix) => `${prefix}-fixed`,
    pathForProfile: () => core.lessons,
    scheduleReview: (card) => ({ ...card, lastRating: "again" }),
    createStore: () => store
  };
  return { lesson, core, store, getState: () => state };
}

test("exposes the lesson and lesson-player lifecycle contract", () => {
  assert.deepEqual(mod.VIEWS, ["lesson", "lesson-player"]);
  assert.equal(mod.supports("lesson"), true);
  assert.equal(mod.supports("lesson-player"), true);
  assert.equal(mod.supports("learning-home"), false);
  assert.deepEqual(Object.keys(global.HHLearningLessonPlayer).sort(), ["mount", "supports", "unmount"]);
  assert.equal(mod.DRAFT_STORAGE_KEY, "hh.learning.lesson.drafts.v1");
});

test("builds every requested activity from one core lesson", () => {
  const { lesson } = fixture();
  const steps = mod.buildLessonContent(lesson);
  assert.deepEqual(steps.map((step) => step.type), ["article", "video", "flashcard", "fill", "drag", "match", "listen", "record", "write", "scenario", "quiz"]);
  assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
  assert.ok(steps.every((step) => step.title && step.skillId));
  assert.match(steps.find((step) => step.type === "video").body, /thiết bị/i);
});

test("evaluates objective, matching, writing and sorting answers deterministically", () => {
  const steps = mod.buildLessonContent(fixture().lesson);
  const fill = steps.find((step) => step.type === "fill");
  const match = steps.find((step) => step.type === "match");
  const write = steps.find((step) => step.type === "write");
  const drag = steps.find((step) => step.type === "drag");
  assert.equal(mod.evaluateStep(fill, "deploy").correct, true);
  assert.equal(mod.evaluateStep(fill, "unknown").correct, false);
  assert.equal(mod.evaluateStep(match, Object.fromEntries(match.pairs)).score, 100);
  assert.equal(mod.evaluateStep(write, "We deploy the update after a complete review.").correct, true);
  assert.equal(mod.evaluateStep(drag, drag.answer.split(" ")).correct, true);
});

test("draft persistence is versioned, bounded and restorable", () => {
  const storage = memoryStorage();
  const scope = { localStorage: storage };
  assert.equal(mod.saveDraft(scope, "lesson-a", { stepIndex: 4, answers: { fill: "safe" }, results: {} }), true);
  assert.equal(mod.loadDraft(scope, "lesson-a").stepIndex, 4);
  assert.equal(mod.loadDraft(scope, "lesson-a").answers.fill, "safe");
  assert.equal(JSON.parse(storage.values.get(mod.DRAFT_STORAGE_KEY)).version, 1);
  assert.equal(mod.clearDraft(scope, "lesson-a"), true);
  assert.equal(mod.loadDraft(scope, "lesson-a"), null);
});

test("mount renders a focused stepper and never requests microphone permission", () => {
  const { core, store, lesson } = fixture();
  let permissionRequests = 0;
  const scope = {
    ...eventTarget(),
    localStorage: memoryStorage(),
    navigator: { mediaDevices: { getUserMedia: async () => { permissionRequests += 1; return { getTracks: () => [] }; } } },
    setTimeout, clearTimeout,
    speechSynthesis: { cancel() {} },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  };
  const target = host();
  const controller = mod.publicApi.mount(target, { view: "lesson-player", lessonId: lesson.id, core, store, scope });
  assert.equal(permissionRequests, 0);
  assert.equal(controller.lessonId, lesson.id);
  assert.match(target.innerHTML, /data-hlp-root/);
  assert.match(target.innerHTML, /aria-label="Các bước bài học"/);
  assert.match(target.innerHTML, /BƯỚC 1\/11/);
  assert.equal(target.count("click"), 1);
  mod.publicApi.unmount();
  assert.equal(target.innerHTML, "");
});

test("recording asks for permission only after the explicit start action and stops tracks", async () => {
  const { core, store, lesson } = fixture();
  let permissionRequests = 0;
  let stoppedTracks = 0;
  let recorderStarts = 0;
  let recorderStops = 0;
  class Recorder {
    constructor() { this.state = "inactive"; this.listeners = {}; this.mimeType = "audio/webm"; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    start() { this.state = "recording"; recorderStarts += 1; }
    stop() { this.state = "inactive"; recorderStops += 1; this.listeners.stop?.(); }
  }
  const scope = {
    ...eventTarget(), localStorage: memoryStorage(), setTimeout, clearTimeout, MediaRecorder: Recorder,
    navigator: { mediaDevices: { getUserMedia: async () => { permissionRequests += 1; return { getTracks: () => [{ stop: () => { stoppedTracks += 1; } }] }; } } },
    speechSynthesis: { cancel() {} },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  };
  const controller = mod.publicApi.mount(host(), { view: "lesson", lessonId: lesson.id, core, store, scope });
  assert.equal(permissionRequests, 0);
  assert.equal(await controller.startRecording(), true);
  assert.equal(permissionRequests, 1);
  assert.equal(recorderStarts, 1);
  mod.publicApi.unmount();
  assert.equal(recorderStops, 1);
  assert.ok(stoppedTracks >= 1);
});

test("cleanup cancels speech, aborts recognition, stops media and revokes object URLs", () => {
  let cancelled = 0;
  let aborted = 0;
  let stopped = 0;
  const revoked = [];
  const runtime = {
    scope: { speechSynthesis: { cancel: () => { cancelled += 1; } }, URL: { revokeObjectURL: (url) => revoked.push(url) } },
    mediaStream: { getTracks: () => [{ stop: () => { stopped += 1; } }] },
    recognition: { abort: () => { aborted += 1; } },
    objectUrls: new Set(["blob:one", "blob:two"])
  };
  mod.cleanupMedia(runtime);
  assert.equal(cancelled, 1);
  assert.equal(aborted, 1);
  assert.equal(stopped, 1);
  assert.deepEqual(revoked, ["blob:one", "blob:two"]);
  assert.equal(runtime.objectUrls.size, 0);
});

test("escapes hostile lesson text and CSS includes responsive accessibility contracts", () => {
  assert.equal(mod.escapeHtml('<img src=x onerror="boom">'), "&lt;img src=x onerror=&quot;boom&quot;&gt;");
  const hostile = mod.buildLessonContent({ trackId: "communication", title: "<script>alert(1)</script>", level: "A0" });
  assert.doesNotMatch(mod.escapeHtml(hostile[0].title), /<script>/);
  assert.match(source, /accept=\"video\/mp4,video\/webm,video\/ogg\"/);
  assert.match(source, /getUserMedia\(\{ audio: true, video: false \}\)/);
  assert.match(source, /revokeObjectURL/);
  assert.match(source, /speechSynthesis/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
});

test("next lesson follows the shared core learning path", () => {
  const { core, lesson } = fixture();
  assert.equal(mod.nextLesson(core, { profile: {}, progress: {} }, lesson.id).id, "technology-a2-01");
  assert.equal(mod.nextLesson(core, { profile: {}, progress: {} }, "technology-a2-01"), null);
});
