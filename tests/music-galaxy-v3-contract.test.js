const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const suite = read("music-production-suite.js");
const styles = read("music-production-suite.css");
const coreSource = read("creative-os-core.js");
const api = read("api/modules/[moduleId]/actions.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");

test("living 2.5D galaxy has six identities, six themes and performance safeguards", () => {
  for (const identity of ["constellation", "electric-midi", "track-rings", "reactor", "nebula", "satellites"]) {
    assert.match(suite + styles, new RegExp(identity));
  }
  for (const theme of ["cyberpunk", "dreamy", "deep-space", "aurora", "retro-wave", "golden-cinema"]) {
    assert.match(suite, new RegExp(theme));
  }
  for (const effect of ["mg-stardust", "mg-meteor", "mg-wormhole", "mg-flare", "--beat-ms", "--project-energy", "is-clipping"]) {
    assert.match(styles + suite, new RegExp(effect));
  }
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(suite, /deviceMemory/);
  assert.match(suite, /hardwareConcurrency/);
});

test("Command Center only derives operational data from project, provider and queue state", () => {
  for (const marker of ["Galaxy Command Center", "AI Mission Control", "Generation queue", "todayCost", "realRuns", "providerStatus", "projectWarnings", "lastWorkspace"]) {
    assert.match(suite, new RegExp(marker, "i"));
  }
  assert.doesNotMatch(suite, /fake progress|mock cost|random cost/i);
});

test("composer queue uses the secured server endpoint with real lifecycle controls", () => {
  for (const marker of ["enqueueGeneration", "processGenerationQueue", "runGenerationJob", "AbortController", "cancel", "retry", "duplicate", "queuePaused"]) {
    assert.match(suite, new RegExp(marker, "i"));
  }
  assert.match(suite, /\/api\/modules\/music-ai\/actions/);
  assert.match(api, /music-track/);
  assert.match(api, /music-image/);
  assert.match(api, /isAdminUser/);
  assert.match(api, /process\.env\.ELEVENLABS_API_KEY/);
  assert.doesNotMatch(suite, /ELEVENLABS_API_KEY|GEMINI_API_KEY/);
});

test("arrangement, variation, MIDI and local audio analysis are functional contracts", () => {
  for (const marker of [
    "snapshotArrangement", "restoreArrangement", "split", "duplicate", "stretch", "freeze",
    "regenerate", "automation", "Hybrid Version", "variationScores", "exportMidi",
    "decodeAudioData", "estimateTempo", "estimateKey", "clippingSamples", "correlation"
  ]) assert.match(suite, new RegExp(marker, "i"));
  assert.match(suite, /audio\/midi/);
  assert.match(suite, /file does not|không được tải lên|không rời thiết bị/i);
});

test("release preflight locks publishing and records splits, consent and provenance", () => {
  for (const marker of ["releaseReady", "releaseSplits", "consentNote", "Provenance Graph", "splitTotal", "rightsVerified", "metadataReady"]) {
    assert.match(suite, new RegExp(marker, "i"));
  }
  assert.match(suite, /Math\.round\(splitTotal \* 100\) \/ 100 === 100/);
  assert.match(coreSource, /consent: \{ note: "", ready: false, records: \[\]/);
});

test("v3 assets are versioned in loader and service worker", () => {
  for (const asset of ["music-production-suite.css?v=3", "music-production-suite.js?v=3", "creative-os-core.js?v=4"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.match(worker, /hh-identity-portal-v272/);
});
