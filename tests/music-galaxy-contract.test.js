const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const suite = read("music-production-suite.js");
const styles = read("music-production-suite.css");
const shell = read("script.js");
const core = read("creative-os-core.js");
const loader = read("performance-loader.js");
const studio = read("music-ai-studio.js");
const apps = read("music-ai-apps.js");

test("Music Galaxy replaces the long sidebar with six production planets", () => {
  assert.match(shell, /const musicAIPlanetItems = \[/);
  assert.match(shell, /pages: musicAIPlanetItems/);
  assert.match(shell, /musicItemMatchesRoute/);
  for (const id of ["ideas-lyrics", "compose-midi", "arrange-record", "mix-master-hub", "visual-universe", "release-control"]) {
    assert.match(shell, new RegExp(`id: "${id}"`));
    assert.match(suite, new RegExp(`id: "${id}"`));
  }
  const planetBlock = shell.match(/const musicAIPlanetItems = \[([\s\S]*?)\n  \];/)?.[1] || "";
  assert.equal((planetBlock.match(/route: "\/music-ai\//g) || []).length, 6);
  assert.equal((planetBlock.match(/identity: "/g) || []).length, 6);
  assert.match(shell, /data-music-planet=/);
  const navigationStyles = read("sidebar-navigation-pro.css");
  assert.match(navigationStyles, /max-height:min\(286px,48vh\)/);
  assert.match(navigationStyles, /overflow-y:auto/);
});

test("hero, orbit navigation and transport implement the Music Galaxy interaction model", () => {
  for (const marker of ["Music Galaxy", "mg-nebula", "mg-orbit-system", "mg-project-star", "mg-galaxy-wave", "mg-transport", "toggle-play", "add-marker", "toggle-loop", "toggle-ab"]) {
    assert.match(suite, new RegExp(marker));
  }
  for (const mode of ["static", "balanced", "cinematic"]) assert.match(suite, new RegExp(`value="${mode}"`));
  assert.match(styles, /\.mg-shell\.is-playing \.mg-galaxy-wave/);
  assert.match(styles, /\.mg-shell\[data-motion="static"\]/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /@media \(max-width:375px\)/);
  assert.match(styles, /:focus-visible/);
});

test("Universal Project maps Creative fields, music metadata and typed prompts", () => {
  for (const field of ["description", "audience", "goal", "tone", "platform", "palettes", "references", "assets", "rights", "publishing"]) {
    assert.match(core + suite, new RegExp(field));
  }
  for (const field of ["songDNA", "promptComposer", "variations", "arrangement", "lyrics", "stems", "vocals", "mix", "visual", "release", "sync"]) {
    assert.match(core, new RegExp(field));
  }
  assert.match(core, /type: cleanText\(input\.type \|\| "general"/);
  assert.match(loader, /creative-os-core\.js\?v=4[\s\S]*music-production-suite\.js\?v=4/);
});

test("Creative Core preserves normalized Music DNA and generation provenance", () => {
  const creativeCore = require(path.join(root, "creative-os-core.js"));
  const project = creativeCore.normalizeProject({
    name: "Orbit Track",
    prompts: [{ type: "music", title: "Main", content: "cosmic piano" }],
    music: {
      project: { bpm: 108, key: "D minor" },
      songDNA: { chords: "Dm - Bb - F - C" },
      promptComposer: { music: "cosmic piano" }
    },
    analytics: {
      runs: [{
        provider: "music", model: "music-v2", action: "music-track",
        prompt: "cosmic piano", seed: "1308", estimatedCost: 0.12,
        usageRights: "commercial", version: "B"
      }]
    }
  });
  assert.equal(project.prompts[0].type, "music");
  assert.equal(project.music.project.bpm, 108);
  assert.equal(project.music.songDNA.chords, "Dm - Bb - F - C");
  assert.equal(project.analytics.runs[0].seed, "1308");
  assert.equal(project.analytics.runs[0].usageRights, "commercial");
});

test("sync is bidirectional, autosaved and conflict-safe", () => {
  for (const marker of ["Nạp từ Sáng tạo", "Đồng bộ ngược", "Đã lưu", "Đang đồng bộ", "Có xung đột", "buildConflict", "resolve-creative", "resolve-music"]) {
    assert.match(suite, new RegExp(marker));
  }
  assert.match(suite, /setTimeout\(\(\) => syncToCreative\(false, false\), 850\)/);
  assert.match(suite, /snapshotProject/);
  assert.match(studio, /ingestStudioState/);
  assert.match(apps, /ingestAppsState/);
});

test("requested production workspaces remain reachable from the six hubs", () => {
  for (const label of [
    "Song DNA", "Prompt Composer", "Variation Galaxy", "Arrangement Canvas",
    "Chord & Melody Lab", "Lyrics Sync", "Stem Workspace", "Vocal Studio",
    "AI Mix Doctor", "Master Targets", "Visual Universe", "Release Control"
  ]) assert.match(suite, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const view of ["composer", "lyrics", "audio-midi", "arrange", "record", "stems", "vocal", "mix-doctor", "master", "visualizer", "rights", "publish"]) {
    assert.match(suite, new RegExp(`"${view}"`));
  }
});

test("generated assets and AI run provenance flow into the active Universal Project", () => {
  for (const marker of ["recordAsset", "recordRun", "provider", "model", "prompt", "seed", "estimatedCost", "usageRights", "version"]) {
    assert.match(core + suite, new RegExp(marker));
  }
  assert.match(studio, /HHMusicGalaxy\?\.recordAsset/);
  assert.match(studio, /HHMusicGalaxy\?\.recordRun/);
  assert.match(apps, /HHMusicGalaxy\?\.recordAsset/);
  assert.match(apps, /HHMusicGalaxy\?\.recordRun/);
});

test("client code does not embed provider credentials", () => {
  const client = [suite, studio, apps, shell].join("\n");
  assert.doesNotMatch(client, /AIza[0-9A-Za-z_-]{24,}/);
  assert.doesNotMatch(client, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(client, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
});
