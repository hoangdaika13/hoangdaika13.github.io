import { inverseMoves } from "./rubik-engine.mjs?v=2";

const format = (size) => size + "×" + size;
const puzzleOf = (size) => size + "x" + size + "x" + size;
const sourceFor = (size) => size === 8 ? "https://www.youtube.com/watch?v=VMa-gfu0cnY" : "https://www.youtube.com/watch?v=SkPti_jZ3r0";
const moveWingPair = (d) => [
  d + "R2", "B2", "U2", d + "L", "U2", d + "R'", "U2", d + "R",
  "U2", "F2", d + "R", "F2", d + "L'", "B2", d + "R2"
].join(" ");

export const LARGE_GROUP_ROWS = [8, 9].flatMap((size) => [
  ["large-" + size + "-centers", "Sửa tâm " + format(size), puzzleOf(size), 2,
    "Thử giao hoán hai lớp trong và sửa hai ô lạc màu ở cặp mặt cuối.", sourceFor(size)],
  ["large-" + size + "-wings", "Ghép cạnh cuối " + format(size), puzzleOf(size), 3,
    "Sửa một cặp cánh đối xứng theo đúng độ sâu, giữ nguyên tâm và các cánh còn lại.", sourceFor(size)]
]).concat([["large-8-parity", "Parity sau thu gọn 8×8", "8x8x8", 2,
  "Nhận diện một cạnh ghép lật hướng và hai cạnh ghép đối diện đổi chỗ.", sourceFor(8)]]);

function build(size, group, slug, name, shape, algorithm, tip, target) {
  return {
    id: "large-" + size + "-" + slug, puzzle: puzzleOf(size), group: "large-" + size + "-" + group,
    name, shape, algorithm, tip, target,
    setup: "x2 " + inverseMoves(algorithm, size),
    source: sourceFor(size), difficulty: group === "parity" ? "Nâng cao" : "Trung cấp"
  };
}

export const LARGE_CASE_ROWS = [8, 9].flatMap((size) => [
  build(size, "centers", "center-cycle", "Tâm · Giao hoán hai lớp trong", "Sáu ô tâm",
    "3R 2U 3R' 2U'",
    "Giữ mặt vàng ở trên và mặt trắng ở dưới. So các ô tâm lạc màu ở sáu mặt, rồi theo dõi lớp thứ ba từ phải và lớp thứ hai từ trên. Viền cạnh và góc vẫn giữ nguyên sau chuỗi.",
    "centers"),
  build(size, "centers", "center-fix", "Tâm cuối · Hai ô lạc màu", "Hai ô tâm",
    "2R U 2L' U' 3R U 2L U' 2R' 3R'",
    "Cầm như ảnh: một ô sai trên mặt vàng, một ô sai ở tâm mặt trước. Chuỗi đưa hai ô về đúng màu tâm. Kiểm tra riêng vị trí lệch hàng và lệch cột trước khi dùng.",
    "centers"),
  ...[2, 3, 4].map((depth) => build(size, "wings", "wing-" + depth, "Cạnh cuối · Lớp " + depth,
    "Cặp cánh đối xứng", moveWingPair(depth),
    "Đặt cạnh đang sửa ở trên–trước. Hai cánh sai đứng cách hai đầu cạnh cùng một khoảng. " +
      depth + "R và " + depth + "L là một lát cắt ở độ sâu " + depth +
      ", tính từ mặt tương ứng. So các cánh còn lại và dải màu tâm sau chuỗi.",
    "wings-" + depth))
]).concat([
  build(8, "parity", "oll-parity", "OLL parity · Một cạnh lật", "Sáu mảnh cạnh lật",
    "4Rw2 R2 B2 U2 4Lw L' U2 4Rw' R U2 4Rw R' U2 F2 4Rw R' F2 4Lw' L B2 4Rw2 R2",
    "Cầm cả cạnh ghép đang lật ở trên–trước và kiểm tra đủ sáu mảnh đều cùng hướng với nhau. 4Rw xoay bốn lớp từ phải; R' trả lại riêng tầng ngoài, vì vậy cặp nước tác động lên ba lớp bên trong.",
    "oll-parity"),
  build(8, "parity", "pll-parity", "PLL parity · Hai cạnh đối diện", "Trên–trước và trên–sau",
    "2R2 3R2 4R2 U2 2R2 3R2 4R2 4Uw2 2R2 3R2 4R2 4Uw2 U2",
    "Tầng trên đã cùng màu nhưng cả hai cạnh trên–trước và trên–sau đứng nhầm chỗ. Căn hai cạnh đối diện theo ảnh. Mỗi 4Uw2 xoay bốn lớp từ mặt trên đúng 180°.",
    "pll-parity")
]);
