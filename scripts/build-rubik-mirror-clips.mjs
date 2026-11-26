// Requires Playwright, Chromium and ffmpeg. HH_RUBIK_PLAYWRIGHT and
// HH_RUBIK_CHROMIUM can point to local installations.
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MIRROR_CASE_ROWS } from "../rubik-mirror-cases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "assets/rubik");
const clips = resolve(assets, "clips");
const diagrams = resolve(assets, "diagrams");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HH_RUBIK_PLAYWRIGHT || "playwright");
const selections = new Set(process.argv.slice(2));
const cases = MIRROR_CASE_ROWS.filter((item) => !selections.size || selections.has(item.id) || selections.has(item.group));
const fps = 8;
const frameTimes = [60, 155, 250, 345, 440];

const html = `<!doctype html><html lang="vi"><meta charset="utf-8">
<style>
* { box-sizing: border-box; }
body { margin:0; color:#f1f6ff; font:15px "Segoe UI",system-ui,sans-serif; background:#11182a; }
main { width:640px; height:360px; padding:12px; }
article { height:100%; padding:14px; border-radius:16px; border:1px solid #364665; background:#1b253d; }
header { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:11px; }
h1 { margin:0; font-size:23px; line-height:1.15; }
header span { color:#a9c8ff; font-size:13px; white-space:nowrap; }
section { display:grid; grid-template-columns:364px 1fr; align-items:center; gap:18px; }
#cube { position:relative; width:364px; height:270px; overflow:hidden; border:1px solid #435474; border-radius:11px; background:radial-gradient(ellipse at 48% 36%,#435575,#18243d 76%); }
#cube .rubik-cube-stage { height:100%; aspect-ratio:auto!important; }
#cube .rubik-cube-volume { width:30%!important; }
#axes { position:absolute; inset:auto 14px 10px; display:flex; justify-content:space-between; color:#ccddf4; font-size:12px; font-weight:600; }
#axes span { padding:2px 5px; border-radius:5px; background:#14223be0; }
#phase { color:#a9c8ff; font-size:13px; }
#move { display:block; font-size:38px; line-height:1.15; margin:5px 0; }
#counter { color:#c1cde2; font-size:14px; }
progress { width:100%; height:7px; border:0; accent-color:#99b9f6; }
</style>
<main><article><header><h1></h1><span>Mirror Cube</span></header><section>
<div id="cube"><div id="surface"></div><div id="axes"><span>F · Trước</span><span>U · Trên</span><span>R · Phải</span></div></div>
<div><strong id="phase"></strong><strong id="move"></strong><small id="counter"></small><p><progress></progress></p></div>
</section></article></main>
</html>`;

const moduleNames = new Set(["rubik-engine.mjs", "rubik-special.mjs"]);
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }
  const file = url.pathname.slice(1);
  if (!moduleNames.has(file)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("content-type", "text/javascript; charset=utf-8");
  res.end(readFileSync(resolve(root, file)));
});

function ffmpeg(args, input) {
  const result = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { input });
  if (result.status !== 0) throw new Error(String(result.stderr || result.error || result.status));
}

function image(name, data) {
  ffmpeg(["-f", "image2pipe", "-c:v", "png", "-i", "pipe:0", "-frames:v", "1", "-c:v", "libwebp",
    resolve(diagrams, name + ".webp")], data);
}

async function render(page, item, origin) {
  await page.goto(origin);
  const moves = await page.evaluate(async ({ name, setup, algorithm }) => {
    const engine = await import("/rubik-engine.mjs");
    let state = engine.applyMoves(engine.solvedFaces(), setup);
    const moves = engine.parseMoves(algorithm);
    const surface = document.querySelector("#surface");
    surface.style.height = "100%";
    const player = engine.renderCube3D(surface, state, 3, { mirror: true });
    document.querySelector("h1").textContent = name;
    const phase = document.querySelector("#phase");
    const token = document.querySelector("#move");
    const counter = document.querySelector("#counter");
    const progress = document.querySelector("progress");
    progress.max = moves.length;
    function updateLabels(index, move) {
      phase.textContent = index === 0 ? "TRẠNG THÁI MẪU" : index > moves.length ? "KẾT QUẢ" : "ĐANG XOAY";
      token.textContent = move || (index === 0 ? "Trước" : "Đã khớp");
      counter.textContent = Math.min(index, moves.length) + "/" + moves.length + " nước";
      progress.value = Math.min(index, moves.length);
    }
    updateLabels(0);
    window.mirrorMedia = {
      advance(index, move) {
        state = engine.applyMoves(state, move);
        player.update(state, { move, duration: 500 });
        updateLabels(index, move);
        const animation = surface.getAnimations({ subtree: true })[0];
        animation?.pause();
        return !!animation;
      },
      seek(ms) {
        const animation = surface.getAnimations({ subtree: true })[0];
        if (animation) animation.currentTime = ms;
      },
      settle() {
        player.update(state);
      },
      finish() {
        if (state !== engine.solvedFaces()) throw Error("The example did not return to the reference shape.");
        updateLabels(moves.length + 1);
      }
    };
    return moves;
  }, item);
  const full = page.locator("main");
  const cube = page.locator("#cube");
  const before = await cube.screenshot();
  const frames = Array(7).fill(await full.screenshot());
  for (const [index, move] of moves.entries()) {
    const animated = await page.evaluate(([i, token]) => window.mirrorMedia.advance(i, token), [index + 1, move]);
    if (animated) {
      for (const timestamp of frameTimes) {
        await page.evaluate((time) => window.mirrorMedia.seek(time), timestamp);
        frames.push(await full.screenshot());
      }
    }
    await page.evaluate(() => window.mirrorMedia.settle());
    frames.push(...Array(animated ? 2 : frameTimes.length + 2).fill(await full.screenshot()));
  }
  await page.evaluate(() => window.mirrorMedia.finish());
  const after = await cube.screenshot();
  if (before.equals(after)) throw Error("The before and after illustrations are visually identical.");
  image(item.id + "-before", before);
  image(item.id + "-after", after);
  frames.push(...Array(10).fill(await full.screenshot()));
  ffmpeg(["-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "pipe:0",
    "-c:v", "libx264", "-threads", "1", "-preset", "fast", "-crf", "26", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", resolve(clips, item.id + ".mp4")], Buffer.concat(frames));
}

if (!cases.length) throw Error("No matching Mirror Cube case IDs or groups.");
mkdirSync(clips, { recursive: true });
mkdirSync(diagrams, { recursive: true });
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.HH_RUBIK_CHROMIUM || undefined,
    headless: true,
    args: ["--disable-background-networking"]
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  for (const item of cases) {
    await render(page, item, origin);
    console.log("Generated " + item.id);
  }
} finally {
  await browser?.close();
  server.close();
}
