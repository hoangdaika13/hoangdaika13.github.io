const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Discord is a top-level lazy workspace across shell, home and auth galaxy", () => {
  const loader = read("performance-loader.js");
  const shell = read("script.js");
  const home = read("home-galaxy-command.js");
  const auth = read("auth-creative-universe.js");
  assert.match(loader, /discord:\s*\{[\s\S]*?discord-hub\.css\?v=2[\s\S]*?discord-hub\.js\?v=2/);
  assert.match(loader, /value === "\/discord"[\s\S]*?return \["discord"\]/);
  assert.match(shell, /HHDiscordHub\?\.mount/);
  assert.match(shell, /HHDiscordHub\?\.unmount/);
  assert.match(shell, /route === "\/discord"/);
  assert.match(home, /label: "Discord", route: "\/discord"/);
  assert.match(auth, /label: "Discord"[\s\S]*?route: "\/discord"/);
});

test("Discord Center has real OAuth, server, channel, message and safe composer flows", () => {
  const hub = read("discord-hub.js");
  const css = read("discord-hub.css");
  for (const action of ["oauth/start", "guilds", "channels/", "messages/send", "bot/invite", "disconnect"]) assert.ok(hub.includes(action), `missing ${action}`);
  assert.match(hub, /credentials: "include"/);
  assert.match(hub, /setInterval[\s\S]*12000/);
  assert.match(hub, /if \(!document\.hidden/);
  assert.match(hub, /data-dh-composer/);
  assert.match(hub, /data-dh-save-message/);
  assert.match(css, /\.dh-content[^{]*\{[^}]*overflow-y:auto/);
  assert.match(css, /\.dh-composer[^{]*\{[^}]*position:relative/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /body\.app-discord-route \.app-page-header/);
});

test("Discord backend keeps tokens private and sends bot messages without automatic mentions", () => {
  const manager = read("utils/discordManager.js");
  const security = read("utils/discordSecurity.js");
  const env = read(".env.example");
  assert.match(manager, /USER_SCOPES = Object\.freeze\(\["identify", "guilds"\]\)/);
  assert.match(manager, /allowed_mentions: \{ parse: \[\] \}/);
  assert.match(manager, /findOneAndDelete\(\{ stateHash, expiresAt:/);
  assert.match(manager, /connections\.findOne\(\{ userId, active: true \}\)/);
  assert.match(manager, /Authorization: `\$\{options\.bot \? "Bot" : "Bearer"\}/);
  assert.doesNotMatch(read("discord-hub.js"), /DISCORD_(?:CLIENT_SECRET|BOT_TOKEN|TOKEN_ENCRYPTION_KEY)\s*=/);
  assert.match(security, /aes-256-gcm/);
  assert.match(security, /setAAD\(context\(connection\)\)/);
  for (const key of ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_TOKEN_ENCRYPTION_KEY", "DISCORD_BOT_TOKEN"]) assert.match(env, new RegExp(`^${key}=`, "m"));
});
