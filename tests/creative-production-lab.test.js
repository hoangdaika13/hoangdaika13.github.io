const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "creative-production-lab.js");
const cssPath = path.join(root, "creative-production-lab.css");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const lab = require(sourcePath);

test("Production Lab exposes a standalone lifecycle and four requested views", () => {
  assert.equal(lab.VERSION, 1);
  assert.equal(lab.FORMAT, "hh-creative-production-lab");
  assert.equal(lab.STORAGE_KEY, "hh.creative-production-lab.v1");
  assert.deepEqual(lab.VIEWS, ["repurpose", "brand", "audio-dubbing", "prototype"]);
  assert.equal(typeof lab.mount, "function");
  assert.equal(typeof lab.unmount, "function");
  assert.match(source, /globalScope\.HHCreativeProductionLab = api/);
  assert.match(source, /data-creative-production-lab/);
});

test("repurpose engine creates all formats with deterministic specs and status", () => {
  const result = lab.generateRepurpose({
    title: "Huong dan lam video",
    transcript: "Hom nay chung ta hoc cach tao video. Buoc dau tien la chuan bi y tuong. Sau do hay viet kich ban. Cuoi cung kiem tra ket qua.",
    targetLanguage: "en",
    duration: 93
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(Object.keys(result.outputs), ["shorts", "facebook", "thumbnail", "podcast", "email", "blog", "subtitle"]);
  assert.equal(result.outputs.shorts.spec.width, 1080);
  assert.equal(result.outputs.thumbnail.spec.height, 720);
  assert.ok(result.outputs.subtitle.captions.length >= 4);
  assert.match(result.outputs.subtitle.srt, /00:00:00,000 --> 00:00:04,000/);
  assert.equal(result.outputs.subtitle.translation.provider, "deterministic-local");
  assert.ok(result.source.words > 10);
});

test("repurpose bundle exports JSON, Markdown and valid SRT without hiding fallback limits", () => {
  const result = lab.generateRepurpose({ title: "Demo", transcript: "Xin chao. Cam on ban. Hom nay lam video." });
  const bundle = lab.exportRepurposeBundle(result);
  assert.equal(bundle.format, `${lab.FORMAT}-repurpose`);
  assert.deepEqual(Object.keys(bundle.files), ["bundle.json", "content.md", "subtitles.srt"]);
  assert.equal(JSON.parse(bundle.files["bundle.json"]).metadata.title, "Demo");
  assert.match(bundle.files["content.md"], /## Shorts/);
  assert.match(bundle.files["subtitles.srt"], /1\n00:00:00,000/);
  assert.match(lab.fallbackTranslate("xin chao", "en").notice, /local/i);
});

test("brand intelligence reports banned words, CTA and voice mismatch", () => {
  const brand = lab.normalizeBrand({
    name: "HH",
    voiceKeywords: ["ro rang", "gan gui"],
    bannedWords: ["re nhat", "bao dam"],
    cta: "Kham pha ngay"
  });
  const report = lab.scoreBrandOutput("RE NHAT tren thi truong. Chung toi bao dam ket qua.", brand);
  assert.ok(report.score < 70);
  assert.ok(report.warnings.some((item) => item.code === "banned-word" && item.value === "re nhat"));
  assert.ok(report.warnings.some((item) => item.code === "voice-missing"));
  assert.ok(report.warnings.some((item) => item.code === "cta-missing"));
});

test("brand auto-fix is non-destructive and creates a compliant draft", () => {
  const original = "Day la san pham RE NHAT.";
  const brand = { voiceKeywords: ["gan gui"], bannedWords: ["re nhat"], cta: "Kham pha ngay" };
  const draft = lab.autoFixBrandOutput(original, brand);
  assert.equal(original, "Day la san pham RE NHAT.");
  assert.equal(draft.original, original);
  assert.notEqual(draft.output, original);
  assert.doesNotMatch(draft.output, /re nhat/i);
  assert.match(draft.output, /Kham pha ngay/);
  assert.match(draft.notice, /khong bi ghi de/i);
  assert.ok(draft.report.score > lab.scoreBrandOutput(original, brand).score);
});

test("audio timeline add, move and trim helpers are immutable", () => {
  const original = lab.normalizeTimeline({ duration: 12, clips: [{ id: "voice-1", type: "voice", start: 1, duration: 5, text: "Xin chao" }] });
  const added = lab.addTimelineClip(original, { id: "music-1", type: "music", start: 0, duration: 8, text: "Nen" });
  const moved = lab.moveTimelineClip(added, "voice-1", 3.5);
  const trimmed = lab.trimTimelineClip(moved, "voice-1", 1, 1.5);
  assert.equal(original.clips.length, 1);
  assert.equal(added.clips.length, 2);
  assert.equal(original.clips[0].start, 1);
  assert.equal(moved.clips.find((item) => item.id === "voice-1").start, 3.5);
  assert.equal(trimmed.clips.find((item) => item.id === "voice-1").trimIn, 1);
  assert.equal(trimmed.clips.find((item) => item.id === "voice-1").trimOut, 1.5);
});

test("audio exports produce real PCM WAV bytes, SRT, CSV and truthful capability notices", () => {
  const timeline = lab.normalizeTimeline({ duration: 3, clips: [
    { id: "v1", type: "voice", start: 0, duration: 2, text: "Dong mot" },
    { id: "s1", type: "subtitle", start: 2, duration: 1, text: "Dong hai" }
  ] });
  const wav = lab.renderTimelineWav(timeline, { sampleRate: 8000, maxDuration: 3 });
  assert.equal(Buffer.from(wav.subarray(0, 4)).toString("ascii"), "RIFF");
  assert.equal(Buffer.from(wav.subarray(8, 12)).toString("ascii"), "WAVE");
  assert.equal(wav.length, 44 + 8000 * 3 * 2);
  assert.match(lab.timelineToSrt(timeline), /Dong mot/);
  assert.match(lab.timelineToCsv(timeline), /^id,type,speaker,start,duration,language,text/);
  const capabilities = lab.detectAudioCapabilities({});
  assert.equal(capabilities.webAudio, false);
  assert.equal(capabilities.recording, false);
  assert.match(capabilities.notice, /preview mix/i);
});

test("prototype engine creates editable screens, components, links and mock data", () => {
  const project = lab.generatePrototype("Ung dung ban hang co dang nhap va dashboard");
  assert.ok(project.screens.some((screen) => screen.id === "login"));
  assert.ok(project.screens.some((screen) => screen.id === "catalog"));
  assert.ok(project.screens.some((screen) => screen.id === "checkout"));
  assert.ok(project.links.length >= 3);
  assert.equal(project.mockData.user.plan, "Free");
  assert.match(project.safety, /No user-authored script/);
});

test("prototype sanitizes prompt and exported HTML never runs user script", () => {
  const project = lab.generatePrototype('<img src=x onerror=globalThis.pwned=1> javascript:alert(1) dang nhap');
  project.screens[0].components.push({ id: "unsafe", type: "text", text: '<script>globalThis.pwned=1</script><b onclick="x()">Hello</b>' });
  const html = lab.exportPrototypeHtml(project);
  assert.doesNotMatch(project.prompt, /<img|javascript:|onerror/i);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /onclick=|onerror=/i);
  assert.doesNotMatch(html, /globalThis\.pwned\s*=/);
  assert.match(html, /Hello/);
  assert.match(html, /href="#dashboard"/);
});

test("versioned local fallback round-trips and reports unsupported storage", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const state = lab.createDefaultState();
  state.projectName = "Demo local";
  assert.deepEqual(lab.saveLocalState(state, storage), { ok: true });
  assert.equal(JSON.parse(values.get(lab.STORAGE_KEY)).format, lab.FORMAT);
  assert.equal(lab.loadLocalState(storage).projectName, "Demo local");
  assert.deepEqual(lab.saveLocalState(state, null), { ok: false, reason: "unsupported" });
});

test("project store integration merges Production Lab data without deleting other project data", async () => {
  let record = { id: "project-1", name: "Existing", data: { brief: { goal: "Launch" } }, tags: ["existing"] };
  const store = {
    async getProject(id) { return id === record.id ? structuredClone(record) : null; },
    async saveProject(next) { record = structuredClone(next); return structuredClone(record); }
  };
  const state = lab.createDefaultState();
  state.projectId = "project-1";
  state.projectName = "Production project";
  const result = await lab.saveProjectState(store, state);
  assert.equal(result.ok, true);
  assert.deepEqual(record.data.brief, { goal: "Launch" });
  assert.equal(record.data.creativeProductionLab.format, lab.FORMAT);
  assert.ok(record.tags.includes("existing"));
  assert.ok(record.tags.includes("production-lab"));
  assert.equal((await lab.loadProjectState(store, "project-1")).projectName, "Production project");
  assert.deepEqual(await lab.saveProjectState(null, state), { ok: false, reason: "unsupported" });
});

test("Creative OS store adapter writes into workflows and keeps existing project domains", async () => {
  let storeState = {
    activeProjectId: "creative-1",
    projects: [{
      id: "creative-1", name: "Campaign", brief: { goal: "Launch" }, assets: [{ id: "asset-1" }],
      workflows: { nodes: [{ id: "brief" }], edges: [], presets: [] },
      brand: { name: "Old brand", colors: ["#112233"] }
    }]
  };
  const store = {
    getState: () => structuredClone(storeState),
    updateProject(id, patch) {
      const index = storeState.projects.findIndex((item) => item.id === id);
      storeState.projects[index] = {
        ...storeState.projects[index], ...structuredClone(patch),
        workflows: { ...storeState.projects[index].workflows, ...(patch.workflows || {}) },
        brand: { ...storeState.projects[index].brand, ...(patch.brand || {}) }
      };
      return structuredClone(storeState.projects[index]);
    }
  };
  const state = lab.createDefaultState();
  state.projectId = "creative-1";
  state.brand.kit = lab.normalizeBrand({ name: "HH New", colors: ["#68E8FF"], cta: "Kham pha" });
  const saved = await lab.saveProjectState(store, state);
  const project = storeState.projects[0];
  assert.equal(saved.adapter, "creative-os");
  assert.deepEqual(project.brief, { goal: "Launch" });
  assert.deepEqual(project.assets, [{ id: "asset-1" }]);
  assert.deepEqual(project.workflows.nodes, [{ id: "brief" }]);
  assert.equal(project.workflows.productionLab.format, lab.FORMAT);
  assert.equal(project.brand.name, "HH New");
  const loaded = await lab.loadProjectState(store, "creative-1");
  assert.equal(loaded.projectId, "creative-1");
  assert.equal(lab.projectFromStoreState(store.getState()).name, "Campaign");
});

test("state normalizer rejects unknown views and unsafe prototype component types", () => {
  const state = lab.normalizeState({ activeView: "not-real", prototype: { project: { activeScreen: "x", screens: [{ id: "x", components: [{ id: "a", type: "script", text: "hello" }] }] } } });
  assert.equal(state.activeView, "repurpose");
  assert.equal(state.prototype.project.screens[0].components[0].type, "text");
  assert.equal(state.format, lab.FORMAT);
});

test("UI contract includes AI hook, navigation hook, explicit consent, status and safe file import", () => {
  for (const marker of [
    "opts.runAI", "opts.onNavigate", "opts.store", "data-cpl-view", "data-cpl-transcript-file", "FileReader", "readAsText",
    "data-cpl-record-consent", "getUserMedia", "MediaRecorder", "data-cpl-audio-clip", "data-cpl-prototype-component",
    'role=\"tab\"', 'aria-live=\"polite\"', 'role=\"status\"', "ArrowRight", "ArrowLeft", "event.ctrlKey",
    "hh.creative-production-lab.v1", "saveProjectState", "loadProjectState", "opts.onNavigate?.(state.activeView)"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(|Function\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /AIza|sk-[A-Za-z0-9]|mongodb(?:\+srv)?:\/\//i);
});

test("responsive CSS supports mobile, focus visibility and reduced motion", () => {
  for (const marker of [
    ".cpl-repurpose", ".cpl-brand", ".cpl-audio-grid", ".cpl-timeline", ".cpl-prototype", ".cpl-device",
    ":focus-visible", "@media (max-width: 560px)", "@media (prefers-reduced-motion: reduce)", "overflow-x: auto",
    "grid-template-columns: 1fr", "transition: none !important"
  ]) assert.ok(css.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^;]*vw[^;]*\)/i, "regular UI text must not scale with viewport width");
});
