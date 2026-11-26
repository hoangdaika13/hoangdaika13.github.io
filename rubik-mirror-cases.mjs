import { inverseMoves } from "./rubik-engine.mjs?v=3";

const guide = "https://www.youtube.com/watch?v=REs39blP02U";

export const MIRROR_GROUP_ROWS = [
  ["mirror-foundation", "Căn mặt và tầng đầu", "mirror", 5,
    "Tìm mặt tham chiếu, ghép cạnh với hai tâm và làm phẳng các khe góc.", guide],
  ["mirror-middle", "Chèn cạnh tầng giữa", "mirror", 2,
    "Đưa cạnh vào khe trước–phải hoặc trước–trái, rồi so độ phẳng của hai mặt bên.", guide],
  ["mirror-last", "Khôi phục tầng cuối", "mirror", 5,
    "Nhìn độ cao quanh tâm trên để định hướng, rồi so các dải bên để hoán vị.", guide],
];

// These are individual practice positions. Each starts one named sequence
// away from the completed shape so the learner can isolate its effect.
const rows = [
  ["mirror-align-top", "mirror-foundation", "Căn tầng trên nửa vòng", "Tầng trên lệch",
    "U2", "Đỉnh đã phẳng nhưng dải trên của các mặt bên chưa khớp. Giữ mặt trước cố định và xoay riêng tầng trên 180°."],
  ["mirror-align-right", "mirror-foundation", "Căn dải bên phải", "Mặt phải lệch",
    "R", "Tìm đường ghép dọc giữa dải phải và hai cột còn lại. Nhìn thẳng mặt phải, xoay dải phải 90° theo chiều kim đồng hồ."],
  ["mirror-cross-front", "mirror-foundation", "Đưa cạnh trước xuống đáy", "Cạnh trước",
    "F2", "Đối chiếu độ dày và chiều sâu của cạnh trước đang ở tầng trên. Xoay mặt trước 180°, rồi chạm cạnh vừa xuống để so với tâm đáy và tâm trước."],
  ["mirror-corner-right", "mirror-foundation", "Chèn góc vào khe phải", "Góc tầng đầu",
    "R U R' U'", "Giữ khe mục tiêu ở góc dưới, trước và phải. So ba kích thước của viên góc với các mặt kề. Sau chuỗi bốn nước, cả ba bề mặt phải liền với các ô sát bên."],
  ["mirror-corner-left", "mirror-foundation", "Chèn góc vào khe trái", "Góc tầng đầu",
    "L' U' L U", "Đặt khe mục tiêu ở dưới, trước và trái. Nhìn đường ghép sát tâm trước để chọn đúng góc, rồi theo dõi khe trái khép phẳng sau bốn nước."],
  ["mirror-edge-right", "mirror-middle", "Chèn cạnh sang phải", "Khe giữa phải",
    "U R U' R' U' F' U F", "Khe chưa phẳng nằm giữa tâm trước và tâm phải. Xác nhận hai chiều của viên cạnh trước khi bắt đầu. Sau chuỗi xoay, tầng đáy vẫn phẳng."],
  ["mirror-edge-left", "mirror-middle", "Chèn cạnh sang trái", "Khe giữa trái",
    "U' L' U L U F U' F'", "Tìm cạnh có hai kích thước tương ứng với hai tâm trước và trái. So mặt trước và dải bên trái để kiểm tra cạnh đã vào đúng khe."],
  ["mirror-cross-line", "mirror-last", "Dấu cộng từ đường ngang", "Hai cạnh đối diện",
    "F R U R' U' F'", "Hai cạnh ngang bằng tâm trên nằm về phía trái và phải. Giữ chúng trên một đường ngang khi nhìn từ mặt trước. Kết quả cần có cả bốn cạnh đúng độ cao."],
  ["mirror-cross-elbow", "mirror-last", "Dấu cộng từ hình chữ L", "Hai cạnh kề",
    "F U R U' R' F'", "Nhìn từ trên, hai cạnh ngang bằng tâm nằm ở phía sau và trái. Giữ nguyên hướng đó trước khi chạy chuỗi. So cả bốn mép quanh tâm ở kết quả."],
  ["mirror-corners-sune", "mirror-last", "Chỉnh góc · Sune", "Một góc trước–trái",
    "R U R' U R U2 R'", "Dấu cộng trên đã phẳng và góc trước–trái ngang bằng tâm. Cầm đúng hướng của mẫu, rồi kiểm tra cả bốn góc sau lượt xoay."],
  ["mirror-corners-antisune", "mirror-last", "Chỉnh góc · Anti-Sune", "Một góc sau–phải",
    "R U2 R' U' R U' R'", "Góc đã ngang bằng tâm nằm ở sau–phải, đối diện góc đã phẳng trong mẫu Sune. Bắt đầu bằng R rồi U2 và đối chiếu cả tầng trên sau chuỗi."],
  ["mirror-edges-cycle", "mirror-last", "Đổi vòng ba cạnh cuối", "Ba cạnh lệch bề rộng",
    "R U' R U R U R U' R' U' R2", "Các góc đã đúng và cạnh phía sau đã khớp. So bề rộng của ba cạnh trên các mặt phải, trước và trái, rồi giữ cạnh phía sau ở vị trí đó khi bắt đầu."],
];

export const MIRROR_CASE_ROWS = rows.map(([id, group, name, shape, algorithm, tip]) => ({
  id, group, name, shape, setup: inverseMoves(algorithm, 3), algorithm, tip,
  difficulty: group === "mirror-last" ? "Trung cấp" : "Cơ bản"
}));
