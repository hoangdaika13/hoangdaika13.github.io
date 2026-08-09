const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("primary navigation separates Game, Phim and Nhạc without breaking game deep links", () => {
  const html = read("index.html");
  const shell = read("script.js");

  assert.match(html, /data-hh-galaxy-key="entertainment"[^>]*>[\s\S]*?<em>Game<\/em>/);
  assert.equal((html.match(/data-hh-planet="\d+"/g) || []).length, 15, "login galaxy must remain a fifteen-planet layout");
  assert.match(shell, /id:\s*"entertainment",\s*\n\s*label:\s*"Game"[\s\S]*?route:\s*"\/entertainment"/);
  assert.match(shell, /id:\s*"cinema",[\s\S]*?label:\s*"Phim"[\s\S]*?route:\s*"\/cinema"/);
  assert.match(shell, /id:\s*"music-library",[\s\S]*?label:\s*"Nhạc"[\s\S]*?route:\s*"\/music"/);
  assert.match(shell, /route === "\/entertainment\/cinematic-arcade"/);
  assert.match(shell, /route === "\/entertainment\/arcade"/);
});

test("cinema and open music routes mount, unmount, search and expose correct breadcrumbs", () => {
  const shell = read("script.js");

  assert.match(shell, /route === "\/cinema" \|\| route\.startsWith\("\/cinema\/"\)/);
  assert.match(shell, /HHCinemaHub\?\.mount/);
  assert.match(shell, /HHCinemaHub\?\.unmount/);
  assert.match(shell, /data-cinema-hub-host/);
  assert.match(shell, /data-cinema-search-focus/);
  assert.match(shell, /route === "\/music" \|\| route\.startsWith\("\/music\/"\)/);
  assert.match(shell, /HHMusicLibrary\?\.mount/);
  assert.match(shell, /HHMusicLibrary\?\.unmount/);
  assert.match(shell, /data-open-music-host/);
  assert.match(shell, /data-music-search-focus/);
  assert.match(shell, /music:\s*"Nhạc",\s*cinema:\s*"Phim"/);
  assert.match(shell, /entertainment:\s*"Game"/);
  assert.match(shell, /type:\s*"Phim"[\s\S]*?route:\s*"\/cinema"/);
  assert.match(shell, /type:\s*"Nhạc"[\s\S]*?route:\s*"\/music"/);
});
