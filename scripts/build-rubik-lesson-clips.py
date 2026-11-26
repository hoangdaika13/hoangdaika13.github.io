"""Build the self-hosted Rubik lesson videos and Vietnamese WebVTT tracks."""

import argparse
import json
from pathlib import Path
import runpy
import subprocess


ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "assets" / "rubik" / "lessons"
EXTRACT_FRAMES = """
import { LESSON_MOVIES } from './rubik-lessons.mjs';
import { COLORS, solvedFaces, applyMoves, parseMoves } from './rubik-engine.mjs';
const selected = new Set(process.argv.slice(1));
const items = LESSON_MOVIES.filter(clip => !selected.size || selected.has(clip.id)).map(clip => {
  const size = Number(clip.puzzle[0]);
  const moves = parseMoves(clip.algorithm, size);
  const states = [applyMoves(solvedFaces(size), clip.setup, size)];
  for (const move of moves) states.push(applyMoves(states.at(-1), move, size));
  return { id: clip.id, name: clip.label, size, moves, states };
});
console.log(JSON.stringify({ colors: COLORS, items }));
"""


def timestamp(frame, frames_per_second):
    millis = frame * 1000 // frames_per_second
    seconds, fraction = divmod(millis, 1000)
    minutes, second = divmod(seconds, 60)
    hours, minute = divmod(minutes, 60)
    return f"{hours:02}:{minute:02}:{second:02}.{fraction:03}"


def describe_move(item, index):
    if index == len(item["moves"]):
        return "Đối chiếu kết quả với phần mô tả của bài học."
    move = item["moves"][index]
    if item["id"] == "notation":
        direction = "ngược chiều" if move.endswith("'") else "thuận chiều"
        return f"{move} · Xoay mặt phải {direction} kim đồng hồ khi nhìn thẳng vào mặt đó."
    return f"Nước {index + 1}/{len(item['moves'])}: {move}"


def write_track(item, frames_per_second):
    # The case renderer holds the opening, intermediate and closing poses
    # for four, two and five frames respectively.
    track = ["WEBVTT", ""]
    cursor = 0
    for index in range(len(item["states"])):
        frames = 5 if index == len(item["states"]) - 1 else 4 if index == 0 else 2
        start = timestamp(cursor, frames_per_second)
        cursor += frames
        track.extend([f"{start} --> {timestamp(cursor, frames_per_second)}", describe_move(item, index), ""])
    (DEST / (item["id"] + ".vtt")).write_text("\n".join(track).rstrip() + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lesson_ids", nargs="*", help="Render only these lessons. Omit to render all.")
    args = parser.parse_args()
    renderer = runpy.run_path(ROOT / "scripts" / "build-rubik-clips.py")
    encode = renderer["encode"]
    encode.__globals__["DEST"] = DEST
    payload = subprocess.check_output(["node", "--input-type=module", "-e", EXTRACT_FRAMES, "--", *args.lesson_ids], cwd=ROOT)
    data = json.loads(payload.decode("utf-8"))
    missing = set(args.lesson_ids) - {item["id"] for item in data["items"]}
    if missing:
        parser.error("Unknown lesson IDs: " + ", ".join(sorted(missing)))
    DEST.mkdir(parents=True, exist_ok=True)
    for item in data["items"]:
        encode(item, data["colors"], force=True)
        write_track(item, renderer["FPS"])
        print(item["id"])


if __name__ == "__main__":
    main()
