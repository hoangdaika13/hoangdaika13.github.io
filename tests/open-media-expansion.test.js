const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const rights = require(path.join(root, "utils", "open-media-rights.js"));

test("open media expansion adds verified music and film without duplicate IDs", () => {
  const baseMusic = readJson("assets/open-media/curated-music-v1.json");
  const expansionMusic = readJson("assets/open-media/curated-music-expansion-v1.json");
  const baseFilms = readJson("assets/open-media/curated-films-v1.json");
  const expansionFilms = readJson("assets/open-media/curated-films-expansion-v1.json");
  assert.equal(expansionMusic.items.length, 5);
  assert.equal(expansionFilms.items.length, 6);
  assert.equal(new Set([...baseMusic.items, ...expansionMusic.items].map((item) => item.id)).size, 60);
  assert.equal(new Set([...baseFilms.items, ...expansionFilms.items].map((item) => item.id)).size, 30);
  for (const item of [...expansionMusic.items, ...expansionFilms.items]) {
    const assessment = rights.validateGovernanceItem(item, { requiredTerritory: "WORLDWIDE" });
    assert.equal(assessment.publiclyAvailable, true, `${item.id}: ${assessment.errors.join(", ")}`);
    const evidence = item.rights.evidence;
    if (item.kind === "track") {
      assert.match(item.playback.url, /github\.com\/tannerhelland\/free-music\/raw\/f6bfe16f49feab2181075ab86b13b24740592aa6/);
      assert.match(evidence.mediaChecksum, /^sha256:[a-f0-9]{64}$/);
      assert.match(evidence.sourceMetadataSnapshot.gitBlobSha1, /^[a-f0-9]{40}$/);
      assert.equal(evidence.metadataChecksum, `sha256:${crypto.createHash("sha256").update(JSON.stringify(evidence.sourceMetadataSnapshot)).digest("hex")}`);
    } else {
      assert.match(item.playback.url, /^https:\/\/upload\.wikimedia\.org\//);
      assert.match(evidence.mediaChecksum, /^sha1:[a-f0-9]{40}$/);
      assert.equal(evidence.mediaChecksumStatus, "verified-upstream");
      assert.equal(evidence.metadataChecksum, `sha256:${crypto.createHash("sha256").update(evidence.metadataRecord).digest("hex")}`);
    }
  }
});

test("media hubs and server restrictions know about optional expansion manifests", () => {
  const musicSource = fs.readFileSync(path.join(root, "open-music-hub.js"), "utf8");
  const cinemaSource = fs.readFileSync(path.join(root, "cinema-hub.js"), "utf8");
  assert.match(musicSource, /curated-music-expansion-v1\.json/);
  assert.match(cinemaSource, /curated-films-expansion-v1\.json/);
  const restrictions = require(path.join(root, "utils", "open-media-server", "restrictions.js"));
  assert.equal(restrictions.__test.CATALOG_IDS.has("github-tanner-clowns"), true);
  assert.equal(restrictions.__test.CATALOG_IDS.has("commons-raya-film-pendek"), true);
});
