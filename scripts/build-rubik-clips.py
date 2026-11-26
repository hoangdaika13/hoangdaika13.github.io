"""Render local Rubik teaching clips from the same sticker engine as the lesson.
Requires Node, Python + Pillow, and ffmpeg with libx264. Run from the repository root.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import math
import os
import subprocess

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "assets" / "rubik" / "clips"
W, H = 384, 216
FPS = 4
BACKGROUND = "#101524"
PANEL = "#1a2236"
TEXT = "#f2f5ff"
SECONDARY = "#aab8d3"
ACCENT = "#95b6ff"
FACES = "URFDLB"
FACE_NAMES = dict(zip(FACES, ["Trên", "Phải", "Trước", "Dưới", "Trái", "Sau"]))
FACE_GEOMETRY = {
    "F": (53, 104, 1, 0, 0, 1),
    "U": (89, 68, 1, 0, -0.6, 0.6),
    "R": (113, 104, 0.6, -0.6, 0, 1),
}
SIDE_LABELS = "BLFR"

EXPORT_FRAMES = r"""
import { CASES } from './rubik-cases.mjs';
import { COLORS, solvedFaces, applyMoves, parseMoves } from './rubik-engine.mjs';
const selections = process.argv.slice(1);
// The dedicated large-cube builder renders native-palette cases.
const cases = CASES.filter(c => !c.nativePalette && /^([2-9])x\1x\1$/.test(c.puzzle) &&
  (!selections.length || selections.includes(c.id) || selections.includes(c.group)));
const frames = cases.map(c => {
  const size = Number(c.puzzle[0]);
  const initial = applyMoves(solvedFaces(size), c.setup, size);
  const moves = parseMoves(c.algorithm, size);
  const states = [initial];
  for (const move of moves) states.push(applyMoves(states.at(-1), move, size));
  return { id: c.id, name: c.name, puzzle: c.puzzle, size, moves, states };
});
// Keep the notation tied to the viewer's axes. Reorienting the color
// scheme by x2 puts white underneath while preserving adjacent colors.
const colors = { ...COLORS, U: COLORS.D, D: COLORS.U, F: COLORS.B, B: COLORS.F };
console.log(JSON.stringify({ colors, frames }));
"""


def available_fonts(size, bold=False):
    win = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = [
        str(win / ("segoeuib.ttf" if bold else "segoeui.ttf")),
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default(size)


FONTS = {
    "title": available_fonts(18, True),
    "move": available_fonts(38, True),
    "line": available_fonts(13),
    "label": available_fonts(12, True),
}


def sticker_at(state, size, face, row, column):
    return state[FACES.index(face) * size**2 + row * size + column]


def draw_cube(draw, size, state, colors, active):
    # Large reference view of the upper, front and right faces.
    cube_length = 60
    gap = max(0.025, 0.016 * size)
    for face in "FUR":
        ox, oy, ux, uy, vx, vy = FACE_GEOMETRY[face]

        def project(u, v):
            return (ox + (ux * u + vx * v) * cube_length, oy + (uy * u + vy * v) * cube_length)

        draw.polygon([project(0, 0), project(1, 0), project(1, 1), project(0, 1)], fill="#0d1220")
        for row in range(size):
            for col in range(size):
                left, top = (col + gap) / size, (row + gap) / size
                right, bottom = (col + 1 - gap) / size, (row + 1 - gap) / size
                vertices = [project(left, top), project(right, top), project(right, bottom), project(left, bottom)]
                fill = colors[sticker_at(state, size, face, row, col)]
                draw.polygon(vertices, fill=fill)
        if face == active:
            draw.line(
                [project(0, 0), project(1, 0), project(1, 1), project(0, 1), project(0, 0)],
                fill=ACCENT,
                width=2,
            )

    for label, pos in [("U", (24, 82)), ("F", (31, 133)), ("R", (152, 116))]:
        draw.text(pos, label, font=FONTS["label"], fill=ACCENT if label == active else SECONDARY)


def draw_upper_strip(draw, size, state, colors):
    # Side stickers in recognition order are useful for OLL, PLL, and F2L.
    tile = min(10, 49 // size)
    dx = 27
    for face in SIDE_LABELS:
        draw.text((dx, 185), face, font=FONTS["label"], fill=SECONDARY)
        left = dx + 13
        for index in range(size):
            x = left + index * tile
            fill = colors[sticker_at(state, size, face, 0, index)]
            draw.rounded_rectangle([x, 186, x + tile - 2, 196], radius=2, fill=fill)
        dx += 85


def fitted_title(draw, item):
    title = item["name"]
    short = item["size"]
    draw.text((25, 19), title, font=FONTS["title"], fill=TEXT)
    draw.text((324, 23), f"{short}×{short}", font=FONTS["label"], fill=ACCENT)


def draw_frame(item, colors, index):
    size = item["size"]
    states = item["states"]
    moves = item["moves"]
    active_move = moves[index] if index < len(moves) else ""
    if active_move and any(face in active_move for face in FACES):
        face = next(face for face in FACES if face in active_move)
    else:
        face = ""

    image = Image.new("RGB", (W, H), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((11, 10, W - 12, H - 10), radius=13, fill=PANEL, outline="#303b59")
    fitted_title(draw, item)

    draw_cube(draw, size, states[index], colors, face)
    draw_upper_strip(draw, size, states[index], colors)
    draw.line((190, 62, 190, 163), fill="#34415d")
    draw.text((211, 65), "TRẠNG THÁI BAN ĐẦU" if index == 0 else
              "ĐÃ THỰC HIỆN XONG" if index == len(moves) else "NƯỚC TIẾP THEO", font=FONTS["label"], fill=ACCENT)
    if active_move:
        draw.text((211, 85), active_move, font=FONTS["move"], fill=TEXT)
        if face:
            draw.text((211, 137), "Mặt " + FACE_NAMES[face].lower(), font=FONTS["line"], fill=SECONDARY)
    else:
        draw.text((211, 99), "Kết quả", font=FONTS["title"], fill=TEXT)
        draw.text((211, 137), f"{len(moves)} nước", font=FONTS["line"], fill=SECONDARY)
    draw.rounded_rectangle((210, 160, 353, 164), radius=2, fill="#384664")
    fraction = index / max(1, len(moves))
    if fraction > 0:
        draw.rounded_rectangle((210, 160, math.ceil(210 + 143 * fraction), 164), radius=2, fill=ACCENT)
    return image.tobytes()


def encode(item, colors, force):
    target = DEST / (item["id"] + ".mp4")
    if target.exists() and target.stat().st_size > 256 and not force:
        return target.name
    frames = []
    for i in range(len(item["states"])):
        repeats = 5 if i == len(item["states"]) - 1 else 4 if i == 0 else 2
        frames.extend([draw_frame(item, colors, i)] * repeats)
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-i", "-", "-an",
            "-c:v", "libx264", "-threads", "1", "-preset", "fast", "-crf", "28",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
        ],
        input=b"".join(frames),
        check=True,
    )
    return target.name


def update_manifest():
    ids = sorted(file.stem for file in DEST.glob("*.mp4") if file.stat().st_size > 256)
    diagrams = ROOT / "assets" / "rubik" / "diagrams"
    special = sorted(id for id in ids if (diagrams / f"{id}-before.webp").is_file() and
                     (diagrams / f"{id}-after.webp").is_file())
    lines = [
        "// Generated by the Rubik media authoring utilities.",
        "export const CASE_CLIPS = new Set(" + json.dumps(ids, ensure_ascii=False, indent=2) + ");",
        "export const SPECIAL_DIAGRAMS = new Set(" + json.dumps(special, ensure_ascii=False, indent=2) + ");",
        "",
    ]
    (ROOT / "rubik-media.mjs").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", nargs="*", help="Case or group IDs. Default renders all cases.")
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-manifest", action="store_true", help="Keep the current media manifest when another build will refresh it.")
    args = parser.parse_args()

    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", EXPORT_FRAMES, "--", *args.cases],
        cwd=ROOT,
    )
    data = json.loads(raw.decode("utf-8"))
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        for i, name in enumerate(pool.map(lambda item: encode(item, data["colors"], args.force), data["frames"]), 1):
            if i == 1 or i % 50 == 0 or i == len(data["frames"]):
                print(f"{i}/{len(data['frames'])}: {name}", flush=True)
    if not args.skip_manifest:
        update_manifest()


if __name__ == "__main__":
    main()
