"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const registry = require(path.join(root, "hh-eonwild-species-registry.js"));
const generator = fs.readFileSync(path.join(root, "scripts", "sync-eonwild-species-registry.js"), "utf8");

test("generated registry contains exactly 300 unique animal species", () => {
  assert.equal(registry.format, "hh-eonwild-species-registry-v1");
  assert.equal(registry.species.length, 300);
  assert.equal(registry.minimumSpecies, 300);
  assert.equal(registry.targetSpecies, 400);
  assert.equal(registry.maximumSpecies, 500);
  assert.equal(new Set(registry.species.map((row) => row.id)).size, 300);
  assert.equal(new Set(registry.species.map((row) => row.taxonId)).size, 300);
  assert.equal(new Set(registry.species.map((row) => row.scientificName)).size, 300);
  assert.equal(registry.VALIDATION.valid, true, registry.VALIDATION.errors.join("\n"));
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(registry.species)).digest("hex"), registry.speciesSha256);
});

test("taxonomy groups are explicit, broad and sum to the complete registry", () => {
  assert.deepEqual(registry.groups.map((group) => group.id), [
    "mammals", "birds", "reptiles", "amphibians", "ray-finned-fishes",
    "molluscs", "insects", "arachnids", "malacostracans"
  ]);
  assert.equal(registry.groups.reduce((sum, group) => sum + group.count, 0), 300);
  registry.groups.forEach((group) => assert.ok(registry.species.filter((row) => row.groupId === group.id).length === group.count));
});

test("unreviewed imports fail closed to catalog-only instead of fake wildlife", () => {
  registry.species.forEach((species) => {
    assert.equal(species.taxonomy.kingdom, "Animalia");
    assert.equal(species.eraRealm, "modern");
    assert.equal(species.tier, "catalog-only");
    assert.equal(species.simulationAllowed, false);
    assert.equal(species.model.status, "catalog-only");
    assert.equal(species.model.productionApproved, false);
    assert.equal(species.morphology.reviewed, false);
    assert.ok(species.scientificSources.length > 0);
    assert.match(species.scientificSources[0].url, /^https:\/\/www\.inaturalist\.org\/taxa\/\d+$/);
    assert.doesNotMatch(`${species.scientificName} ${species.englishName}`, /\bHomo sapiens\b|\bhuman\b/i);
  });
});

test("Vietnamese fallback names are labelled rather than presented as reviewed translations", () => {
  const reviewed = registry.species.filter((species) => species.vernacularStatus === "vi-preferred");
  const fallbacks = registry.species.filter((species) => species.vernacularStatus === "scientific-fallback-needs-vietnamese-review");
  assert.ok(reviewed.length > 0);
  assert.ok(fallbacks.length > 0);
  assert.equal(reviewed.length + fallbacks.length, 300);
  fallbacks.forEach((species) => assert.equal(species.vietnameseName, species.scientificName));
});

test("search is bounded and supports Vietnamese, English, Latin and taxonomy", () => {
  const raccoon = registry.list({ query: "Gấu mèo" });
  assert.ok(raccoon.some((species) => species.scientificName === "Procyon lotor"));
  assert.ok(registry.list({ query: "Carnivora" }).length > 0);
  assert.ok(registry.list({ groupId: "birds", limit: 12 }).every((species) => species.groupId === "birds"));
  assert.equal(registry.list({ limit: 999999 }).length, 300);
});

test("sync script rate-limits and bounds streamed API responses without importing remote media", () => {
  assert.match(generator, /https:\/\/api\.inaturalist\.org\/v1/);
  assert.match(generator, /REQUEST_TIMEOUT_MS\s*=\s*20000/);
  assert.match(generator, /MAX_RESPONSE_BYTES\s*=\s*8 \* 1024 \* 1024/);
  assert.match(generator, /MIN_REQUEST_INTERVAL_MS\s*=\s*1000/);
  assert.match(generator, /content-length/);
  assert.match(generator, /response\.body\.getReader/);
  assert.match(generator, /total > maximumBytes/);
  assert.match(generator, /reader\.cancel\("response-too-large"\)/);
  assert.match(generator, /recommendedPracticesUrl/);
  assert.match(generator, /taxonomy and aggregate observation count only/);
  assert.match(generator, /runtimeAssetsImported:\s*false/);
  assert.doesNotMatch(generator, /default_photo\.(url|medium_url)|writeFileSync\([^,]*default_photo/);
  assert.doesNotMatch(generator, /Google Images|sketchfab\.com\/3d-models/);
});
