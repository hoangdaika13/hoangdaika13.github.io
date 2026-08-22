const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("home keeps Mission Control as the preferred surface", () => {
  const mission = read("home-galaxy-mission.js");
  const command = read("home-galaxy-command.js");
  const styles = read("home-galaxy-command.css");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(mission, /Trung tâm tín hiệu trực tiếp/);
  assert.match(mission, /Chọn kênh và tải video ngay/);
  assert.match(mission, /GALAXY ACTIVITY/);
  assert.match(mission, /HH GALAXY MISSION CONTROL/);
  assert.match(command, /missionRoot\?\.querySelector\("\[data-hgm-shell\]"\)/);
  assert.match(loader, /home-galaxy-command\.js\?v=15/);
  assert.match(worker, /home-galaxy-command\.js\?v=15/);
  assert.match(loader, /home-galaxy-command\.css\?v=13/);
  assert.match(worker, /home-galaxy-command\.css\?v=13/);
  assert.match(styles, /body\.hgc-home-active \.app-main\.hgc-main-active\s*\{[\s\S]*?overflow:\s*hidden auto\s*!important/);
  assert.match(styles, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(command, /main\.style\.setProperty\("overflow-y", "auto", "important"\)/);
});
