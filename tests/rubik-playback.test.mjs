import assert from "node:assert/strict";
import test from "node:test";
import { createAutoPlayback, turnTiming } from "../rubik-playback.mjs";

function setup(t, moveCount) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let index = 0;
  let segment;
  let playing = false;
  const events = [];
  const playback = createAutoPlayback(moveCount, {
    position: () => index,
    range: () => segment,
    speed: () => 1,
    advance() { events.push("move " + ++index); },
    rewind(at) { index = at; events.push("seek " + at); },
    onPlaying(active) { playing = active; }
  });
  return {
    playback, events,
    get playing() { return playing; },
    setRange(range) {
      segment = range;
      if (range) playback.setLoopStart(range.first - 1);
    }
  };
}

const interval = turnTiming().interval;

test("A/B playback includes both bounds and replaces pending ticks when the range changes", (t) => {
  const player = setup(t, 5);
  player.playback.toggle();
  player.setRange({ first: 2, last: 3 });
  assert.equal(player.playing, true);
  t.mock.timers.tick(interval / 2);
  t.mock.timers.tick(interval);
  t.mock.timers.tick(interval);
  assert.deepEqual(player.events, ["move 1", "seek 1", "move 2", "move 3", "seek 1"]);

  player.setRange({ first: 4, last: 4 });
  t.mock.timers.tick(interval / 2);
  t.mock.timers.tick(interval);
  t.mock.timers.tick(interval / 2);
  assert.deepEqual(player.events.slice(5), ["seek 3", "move 4", "seek 3", "move 4"]);
  player.setRange(null);
  t.mock.timers.tick(interval);
  assert.equal(player.events.at(-1), "move 5");
  t.mock.timers.tick(interval);
  assert.equal(player.playing, false);
});

test("pausing a loop cancels its pending rewind and disabling it at the final move stops cleanly", (t) => {
  const player = setup(t, 3);
  player.setRange({ first: 3, last: 3 });
  assert.equal(player.playing, false);
  player.playback.toggle();
  player.playback.toggle();
  t.mock.timers.tick(interval * 2);
  assert.deepEqual(player.events, ["seek 2", "move 3"]);

  player.playback.toggle();
  t.mock.timers.tick(interval / 2);
  player.setRange(null);
  t.mock.timers.tick(interval);
  assert.deepEqual(player.events, ["seek 2", "move 3", "seek 2", "move 3"]);
  assert.equal(player.playing, false);
  player.playback.toggle();
  assert.deepEqual(player.events.slice(-2), ["seek 0", "move 1"]);
  player.playback.stop();
});
