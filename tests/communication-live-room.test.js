const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("communication-live-room.js");
const styles = read("communication-live-room.css");

test("Live Room exposes the assigned mount contract and both views", () => {
  assert.match(source, /window\.HHCommunicationLiveRoom\s*=\s*Object\.freeze/);
  for (const member of ["supports", "mount", "unmount"]) assert.match(source, new RegExp(`\\b${member}\\b`));
  assert.match(source, /new Set\(\["live-room", "calls"\]\)/);
  assert.match(source, /hh\.communication\.live\.v1/);
});

test("Calls reuse the existing WebRTC and Socket.IO contracts", () => {
  assert.match(source, /window\.HHCalls/);
  assert.match(source, /window\.HHRealtimeSocket/);
  assert.match(source, /call:config/);
  assert.match(source, /call:participant:joined/);
  assert.match(source, /call:participant:left/);
  assert.match(source, /call:participant:media/);
  assert.match(source, /\/api\/realtime\/ice/);
  assert.match(source, /Authorization:\s*`Bearer \$\{token\}`/);
});

test("Media permission only occurs in explicit user actions", () => {
  assert.match(source, /requestPreviewMedia\(instance\).*data-live-test-devices/s);
  assert.match(source, /calls\.start\(room, instance\.preferences\.callType\)/);
  const mountBody = source.slice(source.indexOf("function mount("), source.indexOf("function unmount("));
  assert.doesNotMatch(mountBody, /getUserMedia\s*\(/);
  assert.doesNotMatch(mountBody, /getDisplayMedia\s*\(/);
});

test("Live Room has collaborative playback, reactions and consent-gated notes", () => {
  for (const event of ["live:media:sync", "live:media:queue", "live:reaction", "live:notes"]) assert.match(source, new RegExp(event.replaceAll(":", "\\:")));
  assert.match(source, /BroadcastChannel/);
  assert.match(source, /data-live-notes-consent/);
  assert.match(source, /Chỉ bật ghi chú khi mọi người đã đồng ý/);
  assert.match(source, /Tệp cục bộ không được tải lên máy chủ/);
});

test("Security wording is truthful and never claims end-to-end encryption", () => {
  assert.match(source, /Chưa bật E2EE/);
  assert.match(source, /e2ee:\s*false/);
  assert.match(source, /DTLS-SRTP/);
  assert.match(source, /STUN/);
  assert.match(source, /TURN/);
  assert.doesNotMatch(source, /E2EE (đã bật|hoạt động|an toàn tuyệt đối)/i);
});

test("The workspace supports keyboard focus, reduced motion and phone layout", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /@media \(max-width:\s*390px\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /aria-live="polite"/);
});

test("Only non-sensitive preferences are persisted", () => {
  const persistedBlock = source.slice(source.indexOf("const preferences = {"), source.indexOf("localStorage.setItem(STORAGE_KEY"));
  for (const key of ["callType", "callScope", "layout", "compact", "mediaVolume", "syncMode"]) assert.match(persistedBlock, new RegExp(`\\b${key}\\b`));
  for (const sensitive of ["deviceId", "roomId", "notes", "queue", "previewStream", "token"]) assert.doesNotMatch(persistedBlock, new RegExp(`\\b${sensitive}\\b`));
});
