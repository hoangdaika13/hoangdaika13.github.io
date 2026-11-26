"""Render the 8×8 and 9×9 library cases. Requires Node, Pillow and FFmpeg."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import runpy
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
ENCODE = runpy.run_path(str(ROOT / "scripts" / "build-rubik-clips.py"))["encode"]
EXPORT = """
import { LARGE_CASE_ROWS } from './rubik-large-cases.mjs';
import { COLORS, solvedFaces, applyMoves, parseMoves } from './rubik-engine.mjs';
const selected = new Set(process.argv.slice(1));
const cases = LARGE_CASE_ROWS.filter(c => !selected.size || selected.has(c.id) || selected.has(c.group));
if (!cases.length) throw Error("No matching case or group.");
const frames = cases.map(c => {
  const size = Number(c.puzzle[0]);
  const baseline = applyMoves(solvedFaces(size), 'x2', size);
  const initial = applyMoves(solvedFaces(size), c.setup, size);
  const moves = parseMoves(c.algorithm, size);
  const states = [initial];
  for (const move of moves) states.push(applyMoves(states.at(-1), move, size));
  if (initial === baseline || states.at(-1) !== baseline) throw Error(c.id + ": invalid demonstration");
  return { id: c.id, name: c.name, size, moves, states };
});
console.log(JSON.stringify({ colors: COLORS, frames }));
"""


def main():
    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", EXPORT, "--", *sys.argv[1:]], cwd=ROOT
    )
    data = json.loads(raw)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name in pool.map(lambda item: ENCODE(item, data["colors"], True), data["frames"]):
            print("Generated " + name)


if __name__ == "__main__":
    main()
