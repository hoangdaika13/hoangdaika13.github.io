// Authoring utility. Requires Playwright, Chromium and ffmpeg.
// HH_RUBIK_PLAYWRIGHT may point at playwright-core and HH_RUBIK_CHROMIUM at a local Chromium executable.
import { createServer } from "node:http";
import { readFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SPECIAL_CASE_ROWS, SPECIAL_GROUP_ROWS } from "../rubik-special-cases.mjs";
import { Alg, puzzles } from "../vendor/rubik-cubing/special.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HH_RUBIK_PLAYWRIGHT || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "assets/rubik");
const selections = new Set(process.argv.slice(2));
const selected = SPECIAL_CASE_ROWS.filter((item) => !selections.size || selections.has(item.id) || selections.has(item.group));
const GROUPS = new Map(SPECIAL_GROUP_ROWS.map(([id, , puzzle]) => [id, puzzle]));

const html = [
  '<!doctype html><html lang="vi"><meta charset="utf-8"><style>',
  'body{margin:0;background:#101524;color:#f2f5ff;font:15px "Segoe UI",sans-serif}',
  'main{width:544px;height:306px;box-sizing:border-box;padding:12px;background:#101524;}',
  'article{height:100%;box-sizing:border-box;border-radius:14px;border:1px solid #303b59;background:#1a2236;padding:14px;}',
  'h1{font-size:22px;margin:0 0 12px;} section{display:grid;grid-template-columns:332px 1fr;gap:13px;align-items:center;}',
  '#puzzle{position:relative;width:332px;height:210px;background:#f4f6fc;border-radius:8px;overflow:hidden;}',
  '#puzzle > svg{position:absolute;inset:0;display:block;width:100%;height:100%;}',
  'twisty-player{display:block;width:100%;height:100%;} strong{display:block;font-size:14px;color:#95b6ff;}',
  '#move{display:block;font-size:26px;font-weight:700;margin-top:8px;overflow-wrap:anywhere;} small{display:block;color:#aab8d3;margin-top:6px;}',
  '</style><main><article><h1></h1><section><div id="puzzle"></div><div aria-live="polite"><strong id="phase"></strong><span id="move"></span><small></small></div></section></article></main></html>'
].join("");

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  if (u.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }
  if (!/^\/vendor\/rubik-cubing\/[A-Za-z0-9/._-]+$/u.test(u.pathname) || u.pathname.includes("..")) {
    res.writeHead(404).end();
    return;
  }
  try {
    const fullPath = resolve(root, "." + u.pathname);
    res.setHeader("content-type", "text/javascript; charset=utf-8");
    res.end(readFileSync(fullPath));
  } catch {
    res.writeHead(404).end();
  }
});

const WEDGE_PAIRS = [[0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23]];
const WEDGE_CUTS = [[11, 0], [5, 6], [23, 12], [17, 18]];

function checkCut(wedges) {
  for (const [a, b] of WEDGE_CUTS) {
    for (const [x, y] of WEDGE_PAIRS) {
      if ((wedges[a] === x && wedges[b] === y) || (wedges[a] === y && wedges[b] === x)) {
        throw new Error("Invalid Square-1 slice across a corner.");
      }
    }
  }
}

function modelStates(solved, setup, moves, puzzle) {
  let pattern = solved;
  const states = [];
  for (const move of [...setup, ...moves]) {
    if (puzzle === "square1" && move === "/") checkCut(pattern.patternData.WEDGES.pieces);
    pattern = pattern.applyAlg(move);
    states.push(pattern);
  }
  if (states[setup.length - 1].isIdentical(solved) || !states.at(-1).isIdentical(solved)) {
    throw new Error("Case setup and algorithm fail the intended end state.");
  }
  return states.slice(setup.length - 1);
}

function readMoves(text) {
  const arr = [];
  for (const move of Alg.fromString(text).experimentalLeafMoves()) {
    if (move.family === "U_SQ_") arr.push("(" + move.amount + ",0)");
    else if (move.family === "D_SQ_") {
      const pair = /^\((-?\d+),0\)$/u.exec(arr.at(-1));
      if (pair) arr[arr.length - 1] = "(" + pair[1] + "," + move.amount + ")";
      else arr.push("(0," + move.amount + ")");
    } else arr.push(move.toString());
  }
  return arr;
}

function ffmpeg(args, input) {
  const status = spawnSync("ffmpeg", ["-y", "-v", "error", ...args], { input });
  if (status.status !== 0) throw new Error(String(status.stderr || status.error || status.status));
}

async function render(page, row, origin) {
  const puzzle = GROUPS.get(row.group);
  const model = await puzzles[puzzle].kpuzzle();
  const stateMoves = readMoves(row.setup);
  const demoMoves = readMoves(row.algorithm);
  const states = modelStates(model.defaultPattern(), stateMoves, demoMoves, puzzle);
  await page.goto(origin);
  await page.evaluate(async ({ puzzle, setup, title }) => {
    const { TwistyPlayer } = await import("/vendor/rubik-cubing/special.mjs");
    const player = new TwistyPlayer({
      puzzle, visualization: "2D", experimentalSetupAlg: setup, background: "none",
      hintFacelets: "none", controlPanel: "none", viewerLink: "none"
    });
    player.style.width = "332px";
    player.style.height = "210px";
    document.querySelector("h1").textContent = title;
    document.querySelector("#puzzle").replaceChildren(player);
    window.demo = player;
  }, { puzzle, setup: row.setup, title: row.name });
  // Capture the state-rendered SVG from the pinned viewer. Give the exported
  // diagram explicit dimensions independent of the player's control layout.
  await page.waitForFunction(() => window.demo.shadow
    ?.querySelector("twisty-2d-scene-wrapper")?.shadow?.querySelector("twisty-2d-puzzle")?.shadow?.querySelector("svg"));
  const frames = [];
  for (let i = 0; i <= demoMoves.length; i++) {
    await page.evaluate(async ({ prefix, total, i, token, expected }) => {
      window.demo.alg = prefix;
      window.demo.jumpToEnd();
      document.querySelector("#phase").textContent = i === 0 ? "Ban đầu" : i === total ? "Kết quả" : "Nước tiếp theo";
      document.querySelector("#move").textContent = token || "Hoàn thành";
      document.querySelector("small").textContent = i + "/" + total + " nước";
      for (let attempt = 0; attempt < 24; attempt++) {
        const pattern = await window.demo.experimentalModel.currentPattern.get();
        if (JSON.stringify(pattern.patternData) === expected) break;
        if (attempt === 23) throw new Error("Unexpected puzzle state in frame " + i);
        await new Promise(requestAnimationFrame);
      }
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      const svg = window.demo.shadow.querySelector("twisty-2d-scene-wrapper")
        .shadow.querySelector("twisty-2d-puzzle").shadow.querySelector("svg");
      const copy = svg.cloneNode(true);
      copy.style.width = "100%";
      copy.style.height = "100%";
      const output = document.querySelector("#puzzle");
      output.querySelector("svg")?.remove();
      output.append(copy);
    }, { prefix: demoMoves.slice(0, i).join(" "), total: demoMoves.length, i, token: demoMoves[i], expected: JSON.stringify(states[i].patternData) });
    const frame = await page.locator("main").screenshot({ animations: "disabled" });
    frames.push(...Array(i === 0 || i === demoMoves.length ? 3 : 1).fill(frame));
    if (i === 0 || i === demoMoves.length) {
      const image = await page.locator("div#puzzle").screenshot({ animations: "disabled" });
      ffmpeg(["-f", "image2pipe", "-c:v", "png", "-i", "pipe:0", "-frames:v", "1", "-c:v", "libwebp",
        resolve(assets, "diagrams", row.id + (i === 0 ? "-before" : "-after") + ".webp")], image);
    }
  }
  ffmpeg(["-f", "image2pipe", "-framerate", "2", "-c:v", "png", "-i", "pipe:0", "-c:v", "libx264",
    "-preset", "fast", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    resolve(assets, "clips", row.id + ".mp4")], Buffer.concat(frames));
}

function manifest() {
  const clips = readdirSync(resolve(assets, "clips")).filter((name) => name.endsWith(".mp4")).map((name) => name.slice(0, -4)).sort();
  const diagrams = new Set(readdirSync(resolve(assets, "diagrams")));
  const hasDiagrams = SPECIAL_CASE_ROWS.filter(({ id }) => diagrams.has(id + "-before.webp") && diagrams.has(id + "-after.webp")).map(({ id }) => id);
  writeFileSync(resolve(root, "rubik-media.mjs"), "// Generated by the Rubik media authoring utilities.\n" +
    "export const CASE_CLIPS = new Set(" + JSON.stringify(clips, null, 2) + ");\n" +
    "export const SPECIAL_DIAGRAMS = new Set(" + JSON.stringify(hasDiagrams, null, 2) + ");\n");
}

mkdirSync(resolve(assets, "clips"), { recursive: true });
mkdirSync(resolve(assets, "diagrams"), { recursive: true });
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.HH_RUBIK_CHROMIUM || undefined, headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking"]
  });
  const page = await browser.newPage({ viewport: { width: 544, height: 306 }, deviceScaleFactor: 1 });
  if (process.env.HH_RUBIK_DEBUG) {
    page.on("pageerror", (error) => console.log("PAGE", error.message));
    page.on("console", (entry) => console.log(entry.type(), entry.text()));
    page.on("response", (response) => { if (response.status() >= 400) console.log(response.status(), response.url()); });
  }
  for (const row of selected) {
    try {
      await render(page, row, origin);
      console.log("Generated", row.id);
    } catch (error) {
      console.error(row.id + ": " + error.message);
      process.exitCode = 1;
    }
  }
  manifest();
} finally {
  await browser?.close();
  server.close();
}
