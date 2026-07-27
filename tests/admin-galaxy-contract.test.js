const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Admin Galaxy exposes seven permission-gated operational areas", () => {
  const client = read("community-admin.js");
  const css = read("community-admin.css");

  for (const label of [
    "Mission Control",
    "Identity & Access",
    "Security Center",
    "Users & Community",
    "Content & Trust",
    "Platform & Release",
    "Growth & Data"
  ]) {
    assert.match(client, new RegExp(label.replace(/[&]/g, "\\&")));
  }

  assert.match(client, /data-admin-theme-select/);
  assert.match(client, /data-admin-text-select/);
  assert.match(client, /data-admin-text=/);
  assert.match(client, /Deep Space Admin/);
  assert.match(client, /Aurora Shield/);
  assert.match(client, /Cyber Command/);
  assert.match(client, /Nebula Rose/);
  assert.match(client, /Golden Observatory/);
  assert.match(client, /hh\.admin-galaxy\.preferences\.v1/);
  assert.match(css, /hh-admin-core-star/);
  assert.match(css, /hh-admin-orbit-planet/);
  assert.match(css, /@media \(max-width: 375px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /Admin Galaxy readability scale v3/);
  assert.match(css, /--admin-reading-size/);
});

test("Admin Galaxy backend returns real, privacy-safe control-plane data", () => {
  const api = read("utils/community-admin-api.js");
  const roles = read("utils/community-admin.js");

  for (const view of ["mission", "identity", "incidents", "platform", "growth"]) {
    assert.match(api, new RegExp(`view === "${view}"`));
  }

  assert.match(api, /detectedFindings/);
  assert.match(api, /runtimeServices/);
  assert.match(api, /incident:update/);
  assert.match(api, /queue-job:update/);
  assert.match(api, /jobPayloadsReturned:\s*false/);
  assert.match(api, /providerSecretsReturned:\s*false/);
  assert.match(api, /paymentDetailsReturned:\s*false/);
  assert.match(api, /rawPromptsReturned:\s*false/);
  assert.doesNotMatch(api, /PAYOS_API_KEY\s*:/);

  for (const role of ["security_admin", "content_moderator", "support", "analyst", "release_manager"]) {
    assert.match(roles, new RegExp(`${role}:`));
  }
  assert.match(roles, /incidents\.manage/);
  assert.match(roles, /platform\.manage/);
  assert.match(roles, /growth\.view/);
});

test("Admin Galaxy cache manifest ships the current assets", () => {
  assert.match(read("performance-loader.js"), /community-admin\.css\?v=9/);
  assert.match(read("performance-loader.js"), /community-admin\.js\?v=11/);
  assert.match(read("sw.js"), /hh-identity-portal-v262/);
  assert.match(read("index.html"), /performance-loader\.js\?v=51/);
});
