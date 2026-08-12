#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "assets", "open-media", "curated-music-v1.json");
const write = process.argv.includes("--write");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const tracks = catalog.items.filter((item) => item.source?.provider === "GitHub - Tanner Helland Free Music");

async function hashTrack(track) {
  const downloadUrl = track.playback.url.replace(
    "https://github.com/tannerhelland/free-music/raw/",
    "https://raw.githubusercontent.com/tannerhelland/free-music/"
  );
  const response = await fetch(downloadUrl, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`${track.id}: HTTP ${response.status}`);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  const mediaChecksum = `sha256:${hash.digest("hex")}`;
  const expected = String(track.rights?.evidence?.mediaChecksum || "");
  if (!write && expected !== mediaChecksum) throw new Error(`${track.id}: checksum mismatch`);
  if (write) {
    const evidence = track.rights.evidence;
    evidence.mediaChecksumStatus = "verified";
    evidence.mediaChecksum = mediaChecksum;
    evidence.mediaChecksumAlgorithm = "sha256";
    evidence.mediaChecksumSource = `Downloaded pinned GitHub raw bytes at ${track.source.repositoryCommit}; ${bytes} bytes; Git blob ${evidence.sourceMetadataSnapshot.gitBlobSha1}`;
    evidence.checksumScope = "remote-media-bytes";
    track.rights.flags.mediaChecksumAvailable = true;
  }
  return { id: track.id, bytes, mediaChecksum };
}

async function main() {
  const results = [];
  for (let index = 0; index < tracks.length; index += 5) {
    results.push(...await Promise.all(tracks.slice(index, index + 5).map(hashTrack)));
  }
  if (write) fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const totalBytes = results.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`Verified ${results.length} pinned GitHub tracks (${totalBytes} bytes).`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
