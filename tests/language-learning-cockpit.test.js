"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cockpit = require(path.join(root, "language-learning-cockpit.js"));

test("shared language cockpit exposes a truthful three-centre journey", () => {
  assert.deepEqual(cockpit.DESCRIPTORS.map((item) => item.id), ["english", "japanese", "chinese"]);
  assert.equal(cockpit.descriptorForRoute("#/english/lab").id, "english");
  assert.equal(cockpit.descriptorForRoute("/japanese/lookup").id, "japanese");
  assert.equal(cockpit.descriptorForRoute("/chinese/reading-nebula").id, "chinese");
  assert.equal(cockpit.descriptorForRoute("/home"), null);
  cockpit.DESCRIPTORS.forEach((item) => {
    assert.equal(item.actions.length, 4);
    assert.match(item.description, /[\p{L}]/u);
    assert.match(item.accent, /^#/);
  });
});

test("language cockpit is loaded offline and has layered motion fallbacks", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const css = read("language-learning-cockpit.css");
  const js = read("language-learning-cockpit.js");
  for (const asset of ["language-learning-core.js?v=1", "language-learning-cockpit.css?v=2", "language-learning-cockpit.js?v=2"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  for (const marker of ["hh-language-cockpit__backdrop", "hh-language-cockpit__continue", "hhLanguageArrive", "prefers-reduced-motion", "is-tab-hidden"]) assert.match(css, new RegExp(marker));
  for (const marker of ["hh:route-transition-start", "hh:route-transition-complete", "data-language-route", "HH LANGUAGE LEARNING"]) assert.match(js, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const theme of ['data-language="english"', 'data-language="japanese"', 'data-language="chinese"', "hhLanguageSeal"]) assert.match(css, new RegExp(theme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Chinese launchpad keeps tracks bounded and separate from the 50K lookup catalog", () => {
  const chinese = require(path.join(root, "hh-chinese.js"));
  assert.equal(chinese.LEARNING_TRACKS.length, 6);
  assert.ok(chinese.LEARNING_TRACKS.every((track) => track.route && track.levels.length));
  assert.ok(chinese.LEARNING_TRACKS.every((track) => chinese.learningTrackCount(track) <= chinese.CATALOG_WORDS.length));
  const source = read("hh-chinese.js");
  const css = read("hh-chinese.css");
  assert.match(source, /LEARNING_TRACKS/);
  assert.match(source, /Phòng học theo mục tiêu/);
  assert.match(css, /hhc-learning-launchpad/);
});
