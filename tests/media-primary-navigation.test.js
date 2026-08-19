const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("primary navigation removes Game and Character 3D while preserving Phim and Nhạc", () => {
  const html = read("index.html");
  const shell = read("script.js");

  assert.doesNotMatch(html, /data-hh-galaxy-key="(?:entertainment|character)"|<em>Game<\/em>|Nhân vật 3D/);
  assert.equal((html.match(/data-hh-planet="\d+"/g) || []).length, 24, "login galaxy must expose only active destinations");
  assert.doesNotMatch(shell, /id:\s*"entertainment"[\s\S]{0,180}label:\s*"Game"|id:\s*"character-3d"/);
  assert.match(shell, /id:\s*"cinema",[\s\S]*?label:\s*"Phim"[\s\S]*?route:\s*"\/cinema"/);
  assert.match(shell, /id:\s*"music-library",[\s\S]*?label:\s*"Nhạc"[\s\S]*?route:\s*"\/music"/);
  assert.match(shell, /route === "\/entertainment" \|\| route\.startsWith\("\/entertainment\/"\)/);
  assert.match(shell, /route === "\/character-3d" \|\| route\.startsWith\("\/character-3d\/"\)/);
  assert.match(shell, /history\.replaceState\(\{\}, document\.title, `\$\{location\.pathname\}\$\{location\.search\}#\/home`\)/);
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
  assert.doesNotMatch(shell, /entertainment:\s*"Game"|id:\s*"character-3d"/);
  assert.match(shell, /type:\s*"Phim"[\s\S]*?route:\s*"\/cinema"/);
  assert.match(shell, /type:\s*"Nhạc"[\s\S]*?route:\s*"\/music"/);
});
