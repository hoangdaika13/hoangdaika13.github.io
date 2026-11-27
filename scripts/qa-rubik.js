"use strict";

// HH_QA_BASE_URL points to a hosted copy or the local static server.
// Only the guest flow is exercised. Account and consent writes are isolated.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.HH_QA_PLAYWRIGHT || "playwright");
const origin = new URL(process.env.HH_QA_BASE_URL || "http://127.0.0.1:3000");
const output = path.resolve(process.env.HH_QA_OUTPUT || "artifacts/rubik");
fs.mkdirSync(output, { recursive: true });

const browserOptions = {
  headless: true,
  ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : { channel: "chromium" }),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking"]
};

async function isolateRequests(context) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin.origin && ["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    if (url.origin === origin.origin && url.pathname.startsWith("/api/")) return route.fulfill({ status: 200, json: { ok: true } });
    return route.abort();
  });
}

function site(route = "") {
  const url = new URL(origin);
  if (url.hostname === "127.0.0.1") url.searchParams.set("api", "local");
  url.hash = route;
  return url.href;
}

async function guest(page) {
  await page.locator("body.auth-locked:not(.hh-surface-pending) .spiral-card").waitFor();
  if (await page.locator("[data-banner-refuse]").isVisible()) await page.locator("[data-banner-refuse]").click();
  await page.locator("[data-auth-guest]").click();
  await page.locator("body.auth-unlocked:not(.hh-surface-pending)").waitFor();
  if (await page.locator("[data-banner-refuse]").isVisible()) await page.locator("[data-banner-refuse]").click();
}

async function go(page, route, selector) {
  if (new URL(page.url()).hash !== "#" + route) {
    const previous = await page.$(".rb");
    try {
      await page.evaluate((value) => { location.hash = value; }, route);
      if (previous) await page.waitForFunction((workspace) => !workspace.isConnected, previous);
    } finally {
      await previous?.dispose();
    }
  }
  await page.locator(selector).first().waitFor();
}

async function openFromSidebar(page) {
  const toggle = page.locator('[data-sidebar-section-toggle="entertainment"]');
  if (!(await toggle.isVisible()) || await page.locator("body").evaluate((body) => body.classList.contains("app-sidebar-collapsed"))) {
    await page.locator(".app-header [data-shell-toggle]").click();
  }
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  const target = page.locator('#sidebar-section-entertainment [data-app-route="/rubik"]');
  assert.equal(await target.count(), 1);
  await target.click();
  await page.locator(".rb-hero").waitFor();
}

async function clip(video) {
  await video.scrollIntoViewIfNeeded();
  const result = await video.evaluate(async (node) => {
    let timeout;
    try {
      await Promise.race([
        node.play(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Timed out starting " + node.currentSrc)), 12000); })
      ]);
      return { width: node.videoWidth, duration: node.duration, played: node.currentTime };
    } finally {
      clearTimeout(timeout);
      node.pause();
    }
  });
  assert.ok(result.width >= 160 && result.duration > 1);
  return result;
}

async function noOverflow(page) {
  const dimensions = await page.locator(".rb").evaluate((node) => [node.clientWidth, node.scrollWidth]);
  assert.ok(dimensions[1] <= dimensions[0] + 1, "Rubik workspace overflow " + dimensions);
}

async function dragCube(page, stage, volume, mobile) {
  await stage.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
  await stage.click({ trial: true });
  const bounds = await stage.boundingBox();
  assert.ok(bounds?.width > 48 && bounds.height > 48);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const route = page.url();
  const before = await volume.evaluate((element) => element.style.transform);
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (const offset of [12, 28, 42]) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + offset, y: y + 8 }] });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 42, y + 8, { steps: 4 });
    await page.mouse.up();
  }
  assert.notEqual(await volume.evaluate((element) => element.style.transform), before, "drag must rotate the live cube");
  assert.equal(page.url(), route, "drag on a card must not open another route");
  assert.equal(await page.evaluate(() => getSelection()?.toString() || ""), "", "drag must not select card text");
  assert.equal(await page.locator(".rb-dialog[open]").count(), 0, "drag must keep the cube inline");
}

async function hero(page, mobile) {
  const hero = page.locator(".rb-hero");
  const model = hero.locator("[data-rb-hero-model]");
  const stage = model.locator(".rubik-cube-stage");
  await stage.waitFor();
  assert.equal(await model.locator(".rubik-cube-cell").count(), 54);
  const colors = await model.locator(".rubik-cube-cell").evaluateAll((stickers) =>
    [4, 22, 31].map((i) => stickers[i].dataset.color));
  assert.deepEqual(colors, ["D", "B", "U"], "3×3 starts with yellow above, blue in front and white below");
  for (const label of ["Bắt đầu học", "Tra công thức", "Luyện tập"]) {
    const link = hero.getByRole("link", { name: label, exact: true });
    await link.waitFor();
    const bounds = await link.boundingBox();
    assert.ok(bounds?.height >= 44, label + " needs a 44px touch target");
  }
  await dragCube(page, stage, model.locator(".rubik-cube-volume"), mobile);
}

async function galleryCapture(page, mobile) {
  const grid = page.locator("[data-rb-results]");
  const first = grid.locator("[data-rb-case-model]").first();
  await first.scrollIntoViewIfNeeded();
  await first.locator(".rubik-cube-stage").waitFor();
  await first.evaluate((node) => node.closest(".rb-case-card").scrollIntoView({ block: "center", behavior: "instant" }));
  await page.screenshot({ path: path.join(output, mobile ? "thu-vien-mobile.png" : "thu-vien-desktop.png") });
  if (mobile) return;
  const previous = await page.locator("body").getAttribute("data-app-theme");
  const root = page.locator(".rb");
  const color = () => root.evaluate((node) => getComputedStyle(node).getPropertyValue("--rb-text").trim());
  const dark = await color();
  await page.locator("body").evaluate((node) => { node.dataset.appTheme = "light"; });
  try {
    assert.notEqual(await color(), dark, "the light theme must update Rubik text tokens");
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, "thu-vien-giao-dien-sang.png") });
  } finally {
    await page.locator("body").evaluate((node, value) => {
      if (value === null) node.removeAttribute("data-app-theme");
      else node.dataset.appTheme = value;
    }, previous);
  }
}

async function restoreGallery(page) {
  const filter = page.locator("[data-filter='query']");
  await filter.fill("OLL");
  const tile = page.locator(".rb-case-card").last();
  const title = tile.locator(".rb-case");
  await title.scrollIntoViewIfNeeded();
  const id = await tile.locator("[data-rb-case-model]").getAttribute("data-rb-case-model");
  const expectedTop = (await tile.boundingBox()).y;
  assert.ok(expectedTop > 0 && expectedTop < await page.evaluate(() => innerHeight));
  await title.click();
  await page.locator("[data-rb-library-back]").click();
  await filter.waitFor();
  assert.equal(await filter.inputValue(), "OLL");
  assert.equal(await page.locator("[data-filter='group']").inputValue(), "oll");
  await page.waitForFunction(({ id, expectedTop }) => {
    const model = document.querySelector('[data-rb-case-model="' + id + '"]');
    return model && Math.abs(model.closest(".rb-case-card").getBoundingClientRect().y - expectedTop) < 48;
  }, { id, expectedTop });
}

const timelineStep = (player, index) => player.locator("[data-player-step='" + index + "']");

async function observeTurn(stage, action) {
  await stage.evaluate((root) => {
    root.qaPhases = [];
    root.qaTurnObserver = new MutationObserver(() => {
      const phase = root.dataset.turnPhase;
      if (phase) root.qaPhases.push({ phase, targets: root.querySelectorAll(".rb-turn-target").length });
    });
    root.qaTurnObserver.observe(root, { attributeFilter: ["data-turn-phase"] });
  });
  try {
    await action();
    await stage.page().waitForFunction((selector) => !document.querySelector(selector)?.dataset.turnPhase, "[data-rb-case-player] .rubik-cube-stage");
    return await stage.evaluate((root) => root.qaPhases);
  } finally {
    await stage.evaluate((root) => {
      root.qaTurnObserver.disconnect();
      delete root.qaTurnObserver;
      delete root.qaPhases;
    });
  }
}

async function playback(page, mobile) {
  const player = page.locator("[data-rb-case-player]");
  const stage = player.locator(".rubik-cube-stage");
  const volume = stage.locator(".rubik-cube-volume");
  const snapshot = () => stage.locator(".rubik-cube-cell").evaluateAll((cells) => cells.map((cell) => cell.dataset.color).join(""));
  const camera = () => volume.evaluate((node) => node.style.transform);
  await timelineStep(player, 0).waitFor();
  const home = await camera();
  const initial = await snapshot();
  await dragCube(page, stage, volume, mobile);
  const rotated = await camera();
  assert.notEqual(home, rotated);
  await timelineStep(player, 3).click();
  assert.equal(await timelineStep(player, 3).getAttribute("aria-current"), "step");
  const third = await snapshot();
  assert.notEqual(third, initial, "seeking must change the rendered Rubik state");
  await player.locator("[data-player='back']").click();
  assert.equal(await timelineStep(player, 2).getAttribute("aria-current"), "step");
  assert.notEqual(await snapshot(), third);
  assert.equal(await camera(), rotated, "stepping through the formula must keep the user's view");

  const phases = await observeTurn(stage, async () => {
    await player.locator("[data-player='next']").click();
    await timelineStep(player, 3).and(player.locator("[aria-current='step']")).waitFor();
  });
  if (mobile) assert.ok(!phases.some(({ phase }) => phase === "moving"), "reduced motion suppresses animated turns");
  else {
    assert.ok(phases.some(({ phase, targets }) => phase === "prepare" && targets > 0), "highlight the turning layer before moving it");
    assert.ok(phases.some(({ phase }) => phase === "moving"), "animate the turning layer");
  }
  assert.equal(await snapshot(), third, "one animated step must end at the same state as seeking");
  assert.equal(await camera(), rotated);
  await player.locator("[data-player='camera']").click();
  assert.equal(await camera(), home);
  await timelineStep(player, 0).click();
  assert.equal(await snapshot(), initial);
  const speed = player.locator("[data-player-speed]");
  await speed.selectOption("0.5");
  assert.equal(await speed.inputValue(), "0.5");
  const play = player.locator("[data-player='play']");
  await play.click();
  await timelineStep(player, 1).and(player.locator("[aria-current='step']")).waitFor();
  await play.click();
  assert.match(await play.textContent(), /Phát/u);
  await timelineStep(player, 0).click();
  assert.equal(await snapshot(), initial);
}

async function formulaGallery(page, mobile) {
  await go(page, "/rubik/cong-thuc?group=basic", "select[data-filter='group']");
  assert.equal(await page.locator("select[data-filter='group']").inputValue(), "basic");
  const cards = page.locator(".rb-case-card");
  const count = await cards.count();
  assert.ok(count >= 6, "the beginner formula gallery should show its published cases");
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await card.locator("[data-rb-case-model] .rubik-cube-stage").waitFor();
    assert.equal(await card.locator("[data-rb-case-model] .rubik-cube-cell").count(), 54, "beginner card must show its inline 3×3 cube");
  }
  await noOverflow(page);

  await page.locator("[data-filter='group']").selectOption("oll");
  await galleryCapture(page, mobile);
  await restoreGallery(page);
  await page.locator("[data-filter='query']").fill("OLL 27");
  const model = page.locator("[data-rb-case-model='oll-27']");
  await model.scrollIntoViewIfNeeded();
  await model.locator(".rubik-cube-stage").waitFor();
  const ollCamera = await model.locator(".rubik-cube-volume").evaluate((node) => node.style.transform);
  const card = cards.filter({ has: model });
  await card.locator("[data-rb-card-status]").waitFor();
  await dragCube(page, model.locator(".rubik-cube-stage"), model.locator(".rubik-cube-volume"), mobile);
  await card.screenshot({ path: path.join(output, mobile ? "inline-oll27-mobile.png" : "inline-oll27-desktop.png") });
  await card.locator(".rb-case[href$='/oll-27']").click();
  await playback(page, mobile);
  await timelineStep(page.locator("[data-rb-case-player]"), 1).click();
  return ollCamera;
}

const progressKey = "hh.rubik.v1.guest";
const sessionCase = "[data-trainer-body][data-rb-session-case]";
const progress = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), progressKey);

async function checkQuickLinks(page) {
  for (const mode of ["recognize", "recall", "turn"]) {
    const link = "[data-rb-practice-mode='" + mode + "']";
    await go(page, "/rubik/cong-thuc/oll-27", link);
    const destination = await page.locator(link).getAttribute("href");
    assert.ok(destination.includes("case=oll-27"), destination);
    assert.ok(destination.includes("mode=" + mode), destination);
    await page.locator(link).click();
    const challenge = page.locator("[data-trainer-body]");
    if (mode === "recognize") {
      await challenge.locator("[data-answer]").first().waitFor();
      assert.ok((await challenge.locator("[data-answer='OLL 27']").count()) === 1, "the chosen recognition case should have OLL 27 as a possible answer");
      assert.equal(await challenge.locator(".rubik-cube-cell").count(), 54);
    } else if (mode === "recall") {
      await challenge.locator("[data-recall]").waitFor();
      assert.match(await challenge.locator("h3").innerText(), /OLL 27/);
      assert.equal(await challenge.locator(".rubik-cube-cell").count(), 54);
    } else {
      await challenge.locator("[data-turn-practice] .rubik-cube-stage").waitFor();
      assert.equal(await challenge.locator("[data-turn-practice] .rubik-cube-cell").count(), 54);
      assert.match(await challenge.locator("h3").innerText(), /OLL 27/);
    }
    assert.equal(await page.locator("[data-exercise]").inputValue(), mode);
    await noOverflow(page);
  }
}

async function expectCase(page, id) {
  const card = page.locator(sessionCase);
  if (id) await page.locator(sessionCase + '[data-rb-session-case="' + id + '"]').waitFor();
  else await card.waitFor();
  await card.locator(".rubik-cube-stage").waitFor();
  const selected = await card.getAttribute("data-rb-session-case");
  if (id) assert.equal(selected, id);
  assert.equal(await card.locator(".rubik-cube-cell").count(), 54);
  return selected;
}

async function expectSession(page, expected) {
  await page.waitForFunction(({ key, expected }) => {
    const record = JSON.parse(localStorage.getItem(key) || "{}").sessions?.["3x3x3"];
    return JSON.stringify(record?.results) === JSON.stringify(expected);
  }, { key: progressKey, expected });
  return (await progress(page)).sessions["3x3x3"];
}

async function checkScheduledReview(page) {
  const schedule = page.locator("[data-rb-schedule-review]");
  const status = page.locator("[data-rb-case-review]");
  await go(page, "/rubik/cong-thuc/oll-27", "[data-rb-schedule-review]");
  assert.equal(await status.textContent(), "Chưa có lịch ôn");
  await schedule.click();
  await status.filter({ hasText: "Đến hạn ôn" }).waitFor();
  assert.equal(await schedule.getAttribute("aria-disabled"), "true");
  assert.equal(await schedule.textContent(), "Đã xếp lịch ôn");
  const queued = (await progress(page)).reviews["oll-27"];
  assert.ok(queued.due > 0 && queued.due <= Date.now());
  assert.equal(queued.correct + queued.wrong, 0, "scheduling alone must not grade the case");

  await go(page, "/rubik/cong-thuc?group=oll", "[data-rb-session-launch]");
  const launch = page.locator("[data-rb-session-launch]");
  assert.equal(await launch.textContent(), "Ôn bộ OLL");
  const href = await launch.getAttribute("href");
  const route = href.slice(1);
  const params = new URLSearchParams(route.split("?")[1]);
  assert.equal(params.get("group"), "oll");
  assert.ok(params.get("start"), "a library launch has a unique token");
  await launch.click();
  await expectCase(page, "oll-27");
  const first = await expectSession(page, []);
  assert.equal(first.group, "oll");
  assert.equal(first.launch, params.get("start"));
  for (const id of first.ids) {
    await expectCase(page, id);
    await page.locator("[data-rb-session-skip]").click();
  }
  const expected = first.ids.map(() => "skipped");
  const completed = await expectSession(page, expected);
  await page.locator("[data-rb-session-summary]").waitFor();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-rb-session-summary]").waitFor();
  assert.deepEqual(await expectSession(page, expected), completed, "reload must not restart a completed launch");
  await go(page, "/rubik/cong-thuc?group=oll", "[data-rb-session-launch]");
  await go(page, route, "[data-rb-session-summary]");
  assert.deepEqual(await expectSession(page, expected), completed, "returning to the same link must keep its results");
  await noOverflow(page);
}

async function checkSession(page, mobile) {
  await page.evaluate((key) => {
    const now = Date.now();
    const row = (due, wrong, extra) => ({ due, wrong, correct: 0, streak: 0, ...extra });
    const reviews = {
      "oll-27": row(now - 7200000, 5),
      "oll-28": row(now - 3600000, 3),
      "oll-29": row(now + 3600000, 10),
      "oll-30": row(0, 0, { favorite: true })
    };
    localStorage.setItem(key, JSON.stringify({ version: 1, reviews, last: {}, lessons: {}, records: [] }));
  }, progressKey);

  // Both entry points are real links so the normal router and profile storage are exercised.
  if (mobile) {
    await go(page, "/rubik", "[data-rb-session-launch]");
  } else {
    await go(page, "/rubik/tien-trinh", "[data-rb-review-dashboard]");
  }
  const launch = page.locator("[data-rb-session-launch]").filter({ visible: true }).first();
  await launch.waitFor();
  assert.match(await launch.getAttribute("href"), /[?&]session=due(?:&|$)/);
  await launch.click();

  await expectCase(page, "oll-27");
  const start = await expectSession(page, []);
  assert.ok(start.ids.length >= 2 && start.ids.length <= 5, "finite session size: " + start.ids);
  assert.equal(new Set(start.ids).size, start.ids.length, "queue cannot repeat cases");
  assert.deepEqual(start.ids.slice(0, 2), ["oll-27", "oll-28"], "due cases first");
  assert.ok(!start.ids.includes("oll-29"), "future review must not fill the unseen slots");
  assert.match(await page.locator("[data-rb-session-position]").innerText(), /1/);
  const body = page.locator("[data-trainer-body]");
  const answer = body.locator("[data-answer]").filter({ hasText: /^OLL 27$/ });
  await answer.waitFor();
  await answer.click();
  await page.locator("[data-trainer-feedback][data-result='correct']").waitFor();
  const graded = await expectSession(page, ["correct"]);
  const firstRecord = (await progress(page)).reviews["oll-27"];
  assert.equal(graded.index, 1);
  assert.equal(firstRecord.correct, 1, "grade exactly once");
  assert.ok(firstRecord.due > Date.now(), "successful review reschedules the due date");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectCase(page, "oll-28");
  const current = await expectSession(page, ["correct"]);
  assert.equal(current.index, 1, "reload resumes after the graded case");
  assert.deepEqual(current.ids, start.ids);
  assert.equal((await progress(page)).reviews["oll-27"].correct, 1, "reload must not grade the first case again");

  const wrong = await body.locator("[data-answer]").evaluateAll((buttons, expected) =>
    buttons.find((button) => button.dataset.answer !== expected)?.dataset.answer, "OLL 28");
  assert.ok(wrong && wrong !== "OLL 28");
  await body.getByRole("button", { name: wrong, exact: true }).click();
  await page.locator("[data-trainer-feedback][data-result='incorrect']").waitFor();
  await expectSession(page, ["correct", "incorrect"]);
  assert.equal((await progress(page)).reviews["oll-28"].wrong, 4);
  await page.locator("[data-new-exercise]").click();

  const results = ["correct", "incorrect"];
  for (const id of start.ids.slice(2)) {
    await expectCase(page, id);
    const before = (await progress(page)).reviews[id];
    await page.locator("[data-rb-session-skip]").click();
    results.push("skipped");
    await expectSession(page, results);
    assert.deepEqual((await progress(page)).reviews[id], before, "skipping must not schedule a grade");
  }
  const summary = page.locator("[data-rb-session-summary]");
  await summary.waitFor();
  const summaryText = await summary.innerText();
  assert.match(summaryText, /đúng/i);
  assert.match(summaryText, /sai|chưa đúng/i);
  if (results.length > 2) assert.match(summaryText, /bỏ qua/i);
  await noOverflow(page);

  const retry = page.locator("[data-rb-session-retry]");
  await retry.click();
  await expectCase(page, "oll-28");
  const retried = await expectSession(page, []);
  assert.deepEqual(retried.ids, start.ids.slice(1), "retry queue contains incorrect and skipped cases without replaying the correct one");
}

async function checkLoop(page, variant) {
  const route = variant ? "/rubik/cong-thuc/clock-back" : "/rubik/cong-thuc/oll-27";
  const root = page.locator("[data-rb-case-player]");
  const stage = root.locator(variant ? ".rb-variant-stage" : ".rubik-cube-stage");
  const caster = root.locator(variant ? ".rb-variant-scene" : ".rubik-cube-volume");
  await go(page, route, "[data-rb-case-player]");
  await stage.waitFor();
  await root.locator(".rb-loop summary").click();
  const capture = () => caster.evaluate((node) => node.style.transform);
  const original = await capture();
  await stage.press("ArrowRight");
  const adjusted = await capture();
  assert.notEqual(adjusted, original);
  const start = variant ? 2 : 3;
  const end = start + 1;
  await root.locator("[data-rb-loop-start]").selectOption(String(start));
  await root.locator("[data-rb-loop-end]").selectOption(String(end));
  await root.locator("[data-player-speed]").selectOption("1.5");
  const enabled = root.locator("[data-rb-loop-toggle]");
  await enabled.check();
  assert.equal(Number(await root.locator("[data-player-step][aria-current=step]").getAttribute("data-player-step")), start - 1);
  await root.evaluate((player) => {
    const trace = [];
    player.qaTrace = trace;
    player.qaLoop = new MutationObserver(() => {
      const button = player.querySelector("[data-player-step][aria-current='step']");
      const current = Number(button?.dataset.playerStep);
      if (Number.isFinite(current) && trace.at(-1) !== current) trace.push(current);
    });
    player.qaLoop.observe(player, { attributes: true, subtree: true, attributeFilter: ["aria-current"] });
  });
  const play = root.locator("[data-player=play]");
  try {
    await play.press("Space");
    await page.waitForFunction(({ end }) => document.querySelector("[data-rb-case-player]").qaTrace.filter((step) => step === end).length >= 2, { end });
    await play.press("Space");
    const trace = await root.evaluate((player) => player.qaTrace);
    assert.ok(trace.every((step) => step >= start - 1 && step <= end), "playback left loop: " + trace);
    assert.deepEqual(trace.filter((step) => step !== start - 1).slice(0, 4), [start, end, start, end]);
    assert.equal(await capture(), adjusted, "loop must preserve the user camera");
    assert.equal(await play.getAttribute("aria-pressed"), "false");
    const pausedAt = await root.locator("[data-player-step][aria-current=step]").getAttribute("data-player-step");
    // Remain paused for longer than one turn at the selected 1.5× speed.
    await page.waitForTimeout(850);
    assert.equal(await root.locator("[data-player-step][aria-current=step]").getAttribute("data-player-step"), pausedAt);
    await root.locator("[data-player-step='0']").click();
    assert.equal(Number(await root.locator("[data-player-step][aria-current=step]").getAttribute("data-player-step")), 0, "manual seek outside the loop remains available");
    await play.press("Space");
    await root.locator("[data-rb-loop-end]").selectOption(String(start));
    assert.equal(await play.getAttribute("aria-pressed"), "true", "editing the range preserves playback");
    await enabled.uncheck();
    assert.equal(await play.getAttribute("aria-pressed"), "true", "disabling the loop continues regular playback");
    await page.waitForFunction((end) => Number(document.querySelector("[data-rb-case-player] [data-player-step][aria-current='step']")?.dataset.playerStep) > end, start);
    if (await play.getAttribute("aria-pressed") === "true") await play.press("Space");
    assert.equal(await capture(), adjusted, "manual seek and replay must preserve camera");
    await noOverflow(page);
  } finally {
    await root.evaluate((player) => {
      player.qaLoop.disconnect();
      delete player.qaLoop;
      delete player.qaTrace;
    });
  }
}

async function f2lGallery(page, ollCamera) {
  const model = page.locator("[data-rb-case-model='f2l-1']");
  await go(page, "/rubik/cong-thuc?group=f2l", "[data-rb-case-model='f2l-1']");
  await model.scrollIntoViewIfNeeded();
  const stage = model.locator(".rubik-cube-stage");
  await stage.waitFor();
  const f2lCamera = await model.locator(".rubik-cube-volume").evaluate((node) => node.style.transform);
  assert.notEqual(f2lCamera, ollCamera, "F2L and OLL need different recognition views");
  await model.locator("..").locator(".rb-case").click();
  const player = page.locator("[data-rb-case-player]");
  await timelineStep(player, 3).click();
  assert.equal(await timelineStep(player, 3).getAttribute("aria-current"), "step");
  await noOverflow(page);
}

async function cubeSizesGallery(page) {
  for (const [puzzle, id] of [
    ["2x2x2", "ortega-sune"], ["4x4x4", "parity4-oll"], ["5x5x5", "wings-5-2"],
    ["6x6x6", "wings-6-2"], ["7x7x7", "wings-7-2"], ["8x8x8", "large-8-center-cycle"],
    ["9x9x9", "large-9-center-cycle"], ["mirror", "mirror-align-top"]
  ]) {
    const target = "[data-rb-case-model='" + id + "']";
    await go(page, "/rubik/cong-thuc?puzzle=" + puzzle, target);
    const stage = page.locator(target);
    await stage.scrollIntoViewIfNeeded();
    await stage.locator(".rubik-cube-stage").waitFor();
    const tileSize = puzzle === "mirror" ? 3 : Number(puzzle[0]);
    const stickers = puzzle === "mirror" ? ".rubik-mirror-cell[data-color]" : ".rubik-cube-cell";
    assert.equal(await stage.locator(stickers).count(), 6 * tileSize ** 2, puzzle + " has six recognized faces");
  }
}

async function variantGallery(page, mobile) {
  for (const [puzzle, id] of [["pyraminx", "py-tip"], ["megaminx", "minx-eo-1"], ["skewb", "skewb-sledge"]]) {
    const target = "[data-rb-case-model='" + id + "']";
    await go(page, "/rubik/cong-thuc?puzzle=" + puzzle, target);
    await page.locator(target).scrollIntoViewIfNeeded();
    await page.waitForFunction((selector) => {
      const player = document.querySelector(selector + " twisty-player");
      const wrapper = player?.shadow?.querySelector("twisty-3d-scene-wrapper");
      const vantage = wrapper?.shadow?.querySelector("twisty-3d-vantage");
      const canvas = vantage?.shadow?.querySelector("canvas");
      const bounds = canvas?.getBoundingClientRect();
      return bounds?.width > 64 && bounds.height > 64 && canvas.width > 64 && canvas.height > 64;
    }, target);
  }

  for (const [puzzle, id, part] of [
    ["square1", "sq1-cut-right", ".rb-variant-square-plane"],
    ["clock", "clock-ur", ".rb-variant-clock-face"]
  ]) {
    const target = "[data-rb-case-model='" + id + "']";
    await go(page, "/rubik/cong-thuc?puzzle=" + puzzle, target);
    const model = page.locator(target);
    await model.scrollIntoViewIfNeeded();
    await model.locator(part).first().waitFor();
    await dragCube(page, model.locator(".rb-variant-stage"), model.locator(".rb-variant-scene"), mobile);
    await noOverflow(page);
  }
}

async function variantTurns(page) {
  const player = page.locator("[data-rb-case-player]");
  const firstFace = player.locator(".rb-variant-clock-face").first();
  await go(page, "/rubik/cong-thuc/clock-back", "[data-rb-case-player] .rb-variant-clock-face");
  const side = await firstFace.getAttribute("data-clock-side");
  await player.locator("[data-player-speed]").selectOption("1.5");
  await player.locator("[data-player='next']").click();
  await page.waitForFunction((before) =>
    document.querySelector("[data-rb-case-player] .rb-variant-clock-face")?.dataset.clockSide !== before, side);
  const hands = () => firstFace.locator(".rb-variant-dial").evaluateAll((dials) => dials.map((dial) => dial.dataset.hour).join(","));
  const beforeTurn = await hands();
  await timelineStep(player, 2).click();
  assert.notEqual(await hands(), beforeTurn, "Clock hands need to reflect the selected move");
  await player.locator("[data-player='reset']").click();
  assert.equal(await firstFace.getAttribute("data-clock-side"), side);

  await go(page, "/rubik/cong-thuc/sq1-cut-right", "[data-rb-case-player] .rb-variant-stage");
  const square = player.locator(".rb-variant-stage");
  const beforeCut = await square.getAttribute("aria-label");
  await player.locator("[data-player='next']").click();
  await timelineStep(player, 1).and(player.locator("[aria-current='step']")).waitFor();
  await player.locator("[data-player='next']").click();
  await timelineStep(player, 2).and(player.locator("[aria-current='step']")).waitFor();
  await page.waitForFunction((before) => {
    const label = document.querySelector("[data-rb-case-player] .rb-variant-stage")?.getAttribute("aria-label");
    return label && label !== before && label.includes("Lát giữa đang thẳng");
  }, beforeCut);
  await noOverflow(page);
}

async function innerLayer9x9(page) {
  await go(page, "/rubik/mo-phong?puzzle=9x9x9", ".rb-board .rubik-cube-cell");
  assert.equal(await page.locator("select[data-rb-puzzle]").inputValue(), "9x9x9");
  const snapshot = (cells) => cells.map((cell) => cell.dataset.color).join("");
  const stickers = ".rb-board .rubik-cube-cell";
  assert.equal(await page.locator(stickers).count(), 486);
  const initial = await page.locator(stickers).evaluateAll(snapshot);
  await page.locator(".rb-move-controls > summary").click();
  await page.locator("[data-rb-move-kind]").selectOption("inner");
  await page.locator("[data-rb-move-face]").selectOption("R");
  await page.locator("[data-rb-move-depth]").selectOption("8");
  await page.locator("[data-move='8R']").click();
  assert.match(await page.locator(".rb-player-status").textContent(), /1 nước/);
  await page.waitForFunction(({ stickers, initial }) => !document.querySelector(".rubik-cube-turn") &&
    [...document.querySelectorAll(stickers)].map((cell) => cell.dataset.color).join("") !== initial, { stickers, initial });
  await page.locator("[data-player='back']").click();
  await page.waitForFunction(({ stickers, initial }) => !document.querySelector(".rb-board [data-turn-phase]") &&
    [...document.querySelectorAll(stickers)].map((cell) => cell.dataset.color).join("") === initial, { stickers, initial });
  await noOverflow(page);
}

async function check(browser, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 960 }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: mobile ? "reduce" : "no-preference", serviceWorkers: "block"
  });
  try {
    await isolateRequests(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(site(), { waitUntil: "domcontentloaded" });
    await guest(page);
    await openFromSidebar(page);
    await page.waitForTimeout(1100); // The shell finishes its own route transition.
    await noOverflow(page);
    await hero(page, mobile);
    await page.screenshot({ path: path.join(output, mobile ? "mobile.png" : "desktop.png") });
    await page.locator(".rb-hero").getByRole("link", { name: "Bắt đầu học", exact: true }).click();
    await page.locator(".rb h2").filter({ hasText: "đọc ký hiệu" }).waitFor();
    await page.locator("[data-rb-compare] figure").first().waitFor();
    assert.equal(await page.locator("[data-rb-compare] figure").count(), 2);
    assert.deepEqual(await page.locator("[data-rb-compare] .rb-turn-arrow").allTextContents(), ["↻", "↺"]);
    await page.locator(".rb-step-stills summary").click();
    assert.equal(await page.locator(".rb-step-stills[open] figure").count(), 2);
    await clip(page.locator(".rb video").first());
    assert.equal(await page.locator('.rb video track[srclang="vi"]').count(), 1);
    await page.locator(".rb video").scrollIntoViewIfNeeded();
    await page.locator("[data-rb-video]").click();
    const original = await page.locator(".rb-video a[href*='youtube.com/watch']").getAttribute("href");
    const embedded = new URL(await page.locator(".rb iframe").getAttribute("src"));
    assert.equal(embedded.origin, "https://www.youtube-nocookie.com");
    assert.equal(embedded.pathname, "/embed/" + new URL(original).searchParams.get("v"));
    await page.locator("[data-rb-compare-move]").first().click();
    await page.locator(".rb [data-player='next']").click();
    await page.locator(".rb [aria-current='step']").waitFor();
    await page.locator("[data-rb-complete]").click();
    await page.locator("[data-rb-live]").filter({ hasText: "Đã lưu" }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-rb-complete][aria-pressed='true']").waitFor();
    await page.locator("[data-rb-compare] .rb-net").first().waitFor();
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, mobile ? "lesson-mobile.png" : "lesson-desktop.png") });

    const ollCamera = await formulaGallery(page, mobile);
    await page.locator("[data-rb-case-compare] .rb-net").first().waitFor();
    await page.locator("[data-rb-enlarge]").first().click();
    await page.locator(".rb-dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-rb-favorite]").click();
    await page.locator("[data-rb-review]").selectOption("known");
    await page.locator("[data-rb-local-clip]").click();
    await clip(page.locator(".rb video"));
    await page.locator("[data-rb-variant]").selectOption("1");
    assert.match(await page.locator("[data-rb-formula]").textContent(), /y'/);

    await f2lGallery(page, ollCamera);
    if (!mobile) await cubeSizesGallery(page);
    await variantGallery(page, mobile);
    await variantTurns(page);
    await innerLayer9x9(page);

    await go(page, "/rubik/mo-phong?puzzle=mirror", "[data-player='mode']");
    assert.match(await page.locator(".rb select[data-rb-puzzle] option:checked").textContent(), /Mirror/);
    await page.locator(".rb [data-move='R']").click();
    assert.match(await page.locator(".rb-player-status").textContent(), /1 nước/);
    await page.locator(".rb [data-player='back']").click();
    assert.match(await page.locator(".rb-player-status").textContent(), /đã về trạng thái giải/);
    await page.locator(".rb [data-player='mode']").click();
    assert.match(await page.locator(".rb [data-player='mode']").textContent(), /3D/);

    await go(page, "/rubik/giai-khoi", "[data-tile]");
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    assert.match(await page.locator("[data-solver-note]").textContent(), /chưa tô/);
    await page.locator("[data-fill]").click();
    await page.locator("[data-palette='U']").click();
    await page.locator("[data-tile='9']").click();
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    await page.locator("[data-solver-note]").filter({ hasText: /màu|không hợp lệ/ }).waitFor();
    await page.locator("[data-which]").selectOption("scramble");
    await page.locator("[data-scramble-form] textarea").fill("R U2 F' L D2 B");
    await page.getByRole("button", { name: "Tìm lời giải" }).click();
    await page.locator("[data-solver-note]").filter({ hasText: "Đã kiểm tra lời giải" }).waitFor({ timeout: 40000 });
    const solverPlayer = page.locator("[data-rb-solver-player]");
    await solverPlayer.locator(".rb-board").waitFor();
    await noOverflow(page);
    const solverTimeline = solverPlayer.locator(".rb-token-list");
    const solutionEnd = solverTimeline.locator("[data-player-step]").last();
    await timelineStep(solverPlayer, 0).press("End");
    assert.equal(await solutionEnd.getAttribute("aria-current"), "step");
    const track = await solverTimeline.evaluate(({ clientWidth, scrollWidth, scrollLeft }) => ({ clientWidth, scrollWidth, scrollLeft }));
    if (track.scrollWidth > track.clientWidth + 1) assert.ok(track.scrollLeft > 0, "long solver timeline scrolls to its final move");
    assert.ok(await solverPlayer.locator(".rubik-cube-cell").evaluateAll((cells) => {
      const colors = cells.map((cell) => cell.dataset.color);
      return colors.length === 54 && [0, 9, 18, 27, 36, 45].every((start) =>
        colors.slice(start, start + 9).every((color) => color === colors[start]));
    }), "seeking to the final move solves all six faces");
    await noOverflow(page);

    await go(page, "/rubik/luyen-tap", "[data-answer]");
    await page.locator("[data-answer]").first().click();
    await page.locator("[data-trainer-feedback]").filter({ hasText: /Đúng|Chưa đúng/ }).waitFor();
    await page.locator("[data-rb-answer-review] figure").first().waitFor();

    await go(page, "/rubik/cong-thuc/mirror-align-top", "[data-rb-case-compare] img");
    const compare = page.locator("[data-rb-case-compare]");
    await compare.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const stills = [...document.querySelectorAll("[data-rb-case-compare] img")];
      return stills.length === 2 && stills.every((image) => image.complete && image.naturalWidth >= 320);
    });
    await page.locator("[data-rb-enlarge]").first().click();
    await page.locator(".rb-dialog[open] img").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("[data-rb-local-clip]").click();
    await clip(page.locator(".rb video"));
    await page.screenshot({ path: path.join(output, mobile ? "mirror-mobile.png" : "mirror-desktop.png") });

    await go(page, "/rubik/cong-thuc/py-tip", "[data-rb-case-compare] img");
    await page.getByRole("link", { name: "Tự xoay ca này" }).click();
    await page.locator('[data-turn-practice] [data-special-move="u"]').click();
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /1\/1/);
    await page.locator("[data-rb-demo]").click();
    await page.locator("[data-rb-review-player] twisty-player").waitFor();
    await page.locator("[data-exercise]").selectOption("recall");
    await page.locator("[data-recall]").fill("u u u u");
    await page.locator("[data-recall]").press("Enter");
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /2\/2/);
    await page.locator("[data-recall]").press("Enter");
    await noOverflow(page);

    await go(page, "/rubik/luyen-tap?puzzle=square1&case=sq1-cut-right", "[data-turn-practice] [data-special-move]");
    await page.locator('[data-turn-practice] [data-special-move="/"]').click();
    await page.locator("[data-turn-practice] .rb-player-status").filter({ hasText: "chắn đường cắt" }).waitFor();
    await page.locator('[data-turn-practice] [data-special-move="(-1,0)"]').click();
    await page.locator('[data-turn-practice] [data-special-move="/"]').click();
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    await page.locator("[data-exercise]").selectOption("recall");
    await page.locator("[data-recall]").fill("(-1,0) / / /");
    await page.locator("[data-recall]").press("Enter");
    await page.locator("[data-trainer-feedback][data-result=correct]").waitFor();
    assert.match(await page.locator("[data-rb-tally]").textContent(), /2\/2/);

    await go(page, "/rubik/luyen-tap?puzzle=4x4x4&case=parity4-pll", "[data-turn-practice] [data-move='2R2']");
    assert.ok(await page.locator("[data-turn-practice] [data-move='Uw2']").isVisible());

    await go(page, "/rubik/dong-ho", "[data-clock]");
    await page.waitForFunction(() => !document.querySelector(".rb [data-start]").disabled);
    await page.locator("[data-clock]").focus();
    await page.keyboard.press("Space");
    await page.locator("[data-start]").filter({ hasText: "Dừng và lưu" }).waitFor();
    await page.waitForTimeout(280);
    await page.keyboard.press("Space");
    await page.locator(".rb-timer-list li").first().waitFor();
    await page.locator("[data-penalty]").selectOption("+2");
    assert.ok(parseFloat((await page.locator(".rb-timer-list strong").textContent()).replace(",", ".")) >= 2);

    await go(page, "/rubik/tien-trinh", ".rb-coverage");
    await page.locator(".rb").getByRole("link", { name: "OLL 27" }).waitFor();
    assert.equal(await page.locator(".rb-coverage").count(), 14);
    for (const name of ["Rubik 8×8", "Rubik 9×9"]) {
      assert.equal(await page.locator(".rb-coverage > summary").filter({ hasText: name }).count(), 1);
    }
    await noOverflow(page);
    assert.deepEqual(errors, []);
    console.log("PASS", mobile ? "mobile 375px, cảm ứng giả lập, giảm chuyển động" : "desktop", "trang tổng quan 3D, khôi phục bộ lọc và cuộn, OLL/F2L, chọn nước và đổi góc, Square-1/Clock, lớp trong 9×9, bài học, bộ giải, luyện tập, đồng hồ, tiến trình");
  } finally {
    await context.close();
  }
}

async function compactLayout(context, name) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(site("/rubik/cong-thuc?group=oll"), { waitUntil: "domcontentloaded" });
  await guest(page);
  await page.locator("[data-filter='query']").fill("OLL 27");
  const card = page.locator(".rb-case-card").filter({ has: page.locator("[data-rb-case-model='oll-27']") });
  await card.scrollIntoViewIfNeeded();
  await card.locator(".rubik-cube-stage").press("ArrowRight");
  await noOverflow(page);
  await card.locator(".rb-case").click();

  const player = page.locator("[data-rb-case-player]");
  const visual = page.locator(".rb-case-study .rb-visual");
  const comparison = page.locator("[data-rb-case-compare]");
  assert.ok((await visual.boundingBox()).y < (await comparison.boundingBox()).y, "show the player above recognition diagrams in compact layouts");
  const next = player.locator("[data-player='next']");
  await next.waitFor();
  assert.ok((await next.boundingBox()).height >= 44);
  await timelineStep(player, 2).press("Enter");
  assert.equal(await timelineStep(player, 2).getAttribute("aria-current"), "step");
  await noOverflow(page);
  await player.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, name + ".png") });
  assert.deepEqual(errors, []);
}

async function tablet(browser) {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, serviceWorkers: "block"
  });
  try {
    await isolateRequests(context);
    await compactLayout(context, "tablet-820");
    console.log("PASS tablet 820px, điều khiển bàn phím, bố cục mô hình và không tràn ngang");
  } finally {
    await context.close();
  }
}

async function chromiumZoom() {
  const temporary = fs.realpathSync(os.tmpdir());
  const profile = fs.mkdtempSync(path.join(temporary, "hh-rubik-qa-zoom-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      ...browserOptions, args: [...browserOptions.args, "--window-size=1440,960"], viewport: null, serviceWorkers: "block"
    });
    const options = await context.newPage();
    await options.goto("chrome://settings/appearance", { waitUntil: "domcontentloaded" });
    await options.waitForFunction(() => Boolean(window.chrome?.settingsPrivate));
    const nativeRatio = await options.evaluate(() => devicePixelRatio);
    await options.evaluate(() => chrome.settingsPrivate.setDefaultZoom(2));
    await options.close();
    await isolateRequests(context);
    await compactLayout(context, "zoom-200");
    const page = context.pages().at(-1);
    const zoomedRatio = await page.evaluate(() => devicePixelRatio);
    assert.equal(Math.round(100 * zoomedRatio / nativeRatio), 200, "use browser zoom, not a narrowed window alone");
    console.log("PASS Chromium zoom thật 200%, thao tác 3D và bố cục không tràn ngang");
  } finally {
    if (context) await context.close();
    const resolved = fs.realpathSync(profile);
    if (path.dirname(resolved) === temporary && path.basename(resolved).startsWith("hh-rubik-qa-zoom-")) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

async function recordGuide(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }, serviceWorkers: "block",
    recordVideo: { dir: path.join(output, "recordings"), size: { width: 1280, height: 900 } }
  });
  let video;
  try {
    await isolateRequests(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    video = page.video();
    await page.goto(site("/rubik/cong-thuc/oll-27"), { waitUntil: "domcontentloaded" });
    await guest(page);
    const player = page.locator("[data-rb-case-player]");
    await timelineStep(player, 0).waitFor();
    await player.scrollIntoViewIfNeeded();
    const stage = player.locator(".rubik-cube-stage");
    await page.waitForTimeout(600);
    await dragCube(page, stage, stage.locator(".rubik-cube-volume"), false);
    await page.waitForTimeout(600);
    await player.locator("[data-player='play']").click();
    await timelineStep(player, 4).and(player.locator("[aria-current='step']")).waitFor();
    await player.locator("[data-player='play']").click();
    await page.waitForTimeout(700);
    await player.locator("[data-player='camera']").click();
    await timelineStep(player, 0).click();
    await page.waitForTimeout(450);
  } finally {
    await context.close();
  }
  if (video) {
    await video.saveAs(path.join(output, "keo-xoay-va-phat-oll-27.webm"));
    await video.delete();
  }
}

async function checkReviewAndLoops(browser, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 960 }, hasTouch: mobile, isMobile: mobile,
    reducedMotion: mobile ? "reduce" : "no-preference", serviceWorkers: "block"
  });
  try {
    await isolateRequests(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(site("/rubik"), { waitUntil: "domcontentloaded" });
    await guest(page);
    await checkQuickLinks(page);
    await checkScheduledReview(page);
    await checkSession(page, mobile);
    await checkLoop(page, false);
    if (!mobile) await checkLoop(page, true);
    assert.deepEqual(errors, []);
    console.log("PASS", mobile ? "mobile 375px reduced motion" : "desktop",
      "practice modes, persistent review, A/B keyboard playback and contained layout");
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    if (process.env.HH_QA_MODE !== "review") {
      await check(browser, false);
      await check(browser, true);
      await tablet(browser);
      if (process.env.HH_QA_VIDEO) await recordGuide(browser);
    }
    await checkReviewAndLoops(browser, false);
    await checkReviewAndLoops(browser, true);
  } finally {
    await browser.close();
  }
  if (process.env.HH_QA_MODE !== "review") await chromiumZoom();
})().catch((error) => { console.error(error); process.exitCode = 1; });
