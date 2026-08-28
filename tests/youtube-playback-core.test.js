const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const corePath = path.resolve(__dirname, "..", "youtube-playback-core.js");

function loadCore() {
  delete require.cache[require.resolve(corePath)];
  const core = require(corePath);
  core.resetForTests();
  return core;
}

function mockFrame(id, source = "https://www.youtube-nocookie.com") {
  const messages = [];
  const listeners = new Map();
  return {
    src: `${source}/embed/${id}?enablejsapi=1`,
    dataset: {},
    contentWindow: {
      postMessage(message, targetOrigin) {
        messages.push({ message, targetOrigin });
      }
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    emit(type) {
      listeners.get(type)?.();
    },
    messages,
    listeners
  };
}

test("YouTube playback core keeps one active iframe and deduplicates mounts", () => {
  const core = loadCore();
  const frame = mockFrame("abcdefghijk");
  const first = core.attach(frame, "abcdefghijk");

  assert.ok(first);
  assert.equal(core.snapshot(frame).mounted, true);
  assert.equal(core.snapshot().mounts, 1);
  assert.equal(frame.listeners.size, 1);

  const duplicate = core.attach(frame, "abcdefghijk");
  assert.equal(duplicate, first);
  assert.equal(core.snapshot().mounts, 1);
  assert.equal(core.snapshot().duplicateMounts, 1);
  assert.equal(frame.listeners.size, 1);

  frame.emit("load");
  assert.equal(core.snapshot(frame).ready, true);
  core.update(frame, { playerState: 1, currentTime: 12.5, duration: 120, videoLoadedFraction: 0.75 });
  assert.deepEqual(
    (({ state, currentTime, duration, loadedFraction }) => ({ state, currentTime, duration, loadedFraction }))(core.snapshot(frame)),
    { state: 1, currentTime: 12.5, duration: 120, loadedFraction: 0.75 }
  );
});

test("YouTube playback commands are allowlisted and scoped to the iframe origin", () => {
  const core = loadCore();
  const frame = mockFrame("zyxwvutsrqp");
  core.attach(frame, "zyxwvutsrqp");

  assert.equal(core.command(frame, "playVideo"), true);
  assert.equal(core.command(frame, "notAYouTubeCommand"), false);
  assert.equal(frame.messages.length, 1);
  assert.equal(frame.messages[0].targetOrigin, "https://www.youtube-nocookie.com");
  assert.deepEqual(JSON.parse(frame.messages[0].message), { event: "command", func: "playVideo", args: [] });

  const untrusted = mockFrame("zyxwvutsrqp", "https://example.com");
  assert.equal(core.attach(untrusted, "zyxwvutsrqp"), null);
  assert.equal(core.command(untrusted, "playVideo"), false);
});

test("listening uses the IFrame API handshake instead of a command message", () => {
  const core = loadCore();
  const frame = mockFrame("abcdefghijk");
  core.attach(frame, "abcdefghijk");
  assert.equal(core.listen(frame), true);
  assert.equal(frame.messages.length, 1);
  assert.deepEqual(JSON.parse(frame.messages[0].message), { event: "listening", id: "hh-youtube-player" });
  assert.equal(frame.messages[0].targetOrigin, "https://www.youtube-nocookie.com");
  const source = fs.readFileSync(corePath, "utf8");
  assert.match(source, /function listen\(frame, listenerId/);
  assert.match(source, /event: "listening"/);
  assert.doesNotMatch(source, /"listening", "playVideo"/);
});

test("Replacing or destroying a player cleans the previous registration", () => {
  const core = loadCore();
  const first = mockFrame("abcdefghijk");
  const second = mockFrame("zyxwvutsrqp");
  core.attach(first, "abcdefghijk");
  core.attach(second, "zyxwvutsrqp");

  assert.equal(core.snapshot(first).mounted, false);
  assert.equal(core.snapshot(second).mounted, true);
  assert.equal(core.destroy(second), true);
  assert.equal(core.snapshot().mounted, false);
  assert.equal(second.listeners.size, 0);
  assert.equal(core.destroy(second), false);
});
