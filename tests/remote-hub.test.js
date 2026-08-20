"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const remote = require(path.join(root, "remote-hub.js"));

test("Remote Hub exposes bounded, reproducible connection helpers", () => {
  assert.equal(remote.normalizeCode("ab-cd 2345!"), "ABCD2345");
  assert.equal(remote.VERSION, 2);
  assert.equal(remote.MAX_FILE_BYTES, 32 * 1024 * 1024);
  assert.equal(remote.CHUNK_BYTES, 64 * 1024);
  assert.equal(remote.MAX_DATA_MESSAGE_BYTES, 48_000);
  const value = { kind: "offer", description: { type: "offer", sdp: "v=0\r\n" } };
  assert.deepEqual(remote.decodeSignal(remote.encodeSignal(value)), value);
  assert.throws(() => remote.decodeSignal("not-a-signal"), /không hợp lệ/i);
  const envelope = remote.createEnvelope("chat", { text: "hello" });
  assert.equal(remote.normalizeEnvelope(envelope).payload.text, "hello");
  assert.equal(remote.normalizeEnvelope({ ...envelope, at: Date.now() - 180_000 }), null);
});

test("Remote is a first-class lazy route across shell, galaxy and offline cache", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  assert.match(script, /id: "remote"[\s\S]*?route: "\/remote"/);
  assert.match(script, /app-remote-route/);
  assert.match(script, /data-remote-hub-host/);
  assert.match(script, /HHRemoteHub\.mount/);
  assert.match(script, /HHRemoteHub\?\.unmount/);
  assert.match(script, /Remote máy tính & điện thoại/);
  assert.match(loader, /remote:\s*\{[\s\S]*?remote-hub\.css\?v=3[\s\S]*?remote-hub\.js\?v=3/);
  assert.match(loader, /startsWith\("\/remote"\)[\s\S]*?\["remote"\]/);
  assert.match(worker, /remote-hub\.css\?v=3/);
  assert.match(worker, /remote-hub\.js\?v=3/);
  assert.match(html, /data-hh-galaxy-key="remote"/);
  assert.match(html, /25 LĨNH VỰC/);
  assert.match(galaxy, /remote:\s*\{[\s\S]*?route: "#\/remote"/);
});

test("Remote implementation uses real WebRTC primitives and explicit permission gates", () => {
  const source = read("remote-hub.js");
  for (const contract of [
    /navigator\.mediaDevices\.getDisplayMedia/,
    /new global\.RTCPeerConnection/,
    /createDataChannel\("hh-remote-assist-v2"/,
    /createOffer\(\)/,
    /createAnswer\(\)/,
    /setRemoteDescription/,
    /remote:session:create/,
    /remote:session:approve/,
    /remote:signal/,
    /PIN 6 số/,
    /WebRTC thủ công/,
    /Picture-in-Picture/,
    /Gửi clipboard/,
    /Truyền tệp trực tiếp/,
    /MediaRecorder/,
    /canvas\.toBlob/,
    /applyConstraints/,
    /setParameters/,
    /getStats/,
    /restartIce/,
    /remote:session:lock/,
    /remote:session:revoke/,
    /remote:session:recover/
  ]) assert.match(source, contract);
  assert.match(source, /Trình duyệt không thể tự bấm chuột hay nhập bàn phím/);
  assert.match(source, /Không tuyên bố điều khiển hệ điều hành khi chưa có native agent/);
});

test("Remote bounds signaling, messages and file transfers", () => {
  const client = read("remote-hub.js");
  const server = read("realtime-server/src/remote-signaling.js");
  assert.match(client, /MAX_FILE_BYTES = 32 \* 1024 \* 1024/);
  assert.match(client, /MAX_DATA_MESSAGE_BYTES = 48_000/);
  assert.match(client, /file\.slice\(offset/);
  assert.match(client, /nextSize > incomingFile\.size/);
  assert.match(client, /file\.received !== file\.size/);
  assert.match(client, /seenMessages\.has/);
  assert.match(server, /MAX_SIGNAL_BYTES = 96_000/);
  assert.match(server, /MAX_VIEWERS = 1/);
  assert.match(server, /MAX_PENDING = 8/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /pinHash: hashSecret\(pin\)/);
  assert.match(server, /reconnectTokenHash: hashSecret\(reconnectToken\)/);
  assert.match(server, /allowedOrigins\.includes\(origin\)/);
  assert.doesNotMatch(server, /pin:\s*pin/);
});

test("Remote UI is one-screen, colorful, responsive and motion-safe", () => {
  const css = read("remote-hub.css");
  assert.match(css, /body\.app-remote-route \{ overflow: hidden; \}/);
  assert.match(css, /\.remote-hub\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.remote-layout[\s\S]*?grid-template-columns:210px minmax\(0,1fr\) 330px/);
  assert.match(css, /\.remote-hub\[data-view="quick"\] \.remote-context/);
  assert.match(css, /@media \(max-width:560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  for (const animation of ["remote-stars", "remote-nebula", "remote-orbit", "remote-comet", "remote-packet", "remote-scan"]) assert.match(css, new RegExp(animation));
  assert.match(css, /remote-record-pulse/);
  assert.match(css, /\.remote-permission/);
  assert.match(css, /\.remote-metrics/);
});

test("Remote v2 keeps sensitive permissions denied by default and exposes explicit modes", () => {
  assert.equal(remote.PERMISSIONS.chat.default, true);
  assert.equal(remote.PERMISSIONS.pointer.default, true);
  for (const key of ["clipboard", "files", "screenshot", "recording"]) assert.equal(remote.PERMISSIONS[key].default, false);
  assert.deepEqual(Object.keys(remote.QUALITY_PROFILES), ["saver", "balanced", "sharp"]);
  assert.equal(remote.QUALITY_PROFILES.saver.frameRate, 12);
  assert.equal(remote.QUALITY_PROFILES.sharp.height, 1080);
});

test("Remote source avoids dynamic code execution and embedded credentials", () => {
  const files = [read("remote-hub.js"), read("realtime-server/src/remote-signaling.js")];
  for (const source of files) {
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /new\s+Function\s*\(/);
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}/);
    assert.doesNotMatch(source, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
  }
});
