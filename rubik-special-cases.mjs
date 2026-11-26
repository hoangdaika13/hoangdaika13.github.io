// Selected practice positions for the non-cubic puzzles. Reader guidance is original.
const pyraminx = "https://speedcubing.org/pages/pyraminx-written-tutorial";
const megaminx = "https://www.cubeskills.com/tutorials/intermediate-megaminx-techniques";
const skewb = "https://meep.cubing.net/skewb.html";
const square = "https://www.worldcubeassociation.org/regulations/#article-12-notation";
const squareEdges = "https://sarah.cubing.net/square-1/ep";
const squareCorners = "https://sarah.cubing.net/square-1/cp";
const clock = "https://www.worldcubeassociation.org/regulations/#12g";

export const SPECIAL_GROUP_ROWS = [
  ["py-basics", "Đỉnh và cạnh Pyraminx", "pyraminx", 6, "Mẫu luyện khớp đỉnh, chèn cạnh và sửa ba cạnh cuối.", pyraminx],
  ["minx-eo", "Định hướng cạnh Megaminx", "megaminx", 3, "Ba nhóm hình cạnh cuối trong lộ trình bốn lượt. Xoay U để hình trùng với mẫu.", megaminx],
  ["minx-co", "Định hướng góc Megaminx", "megaminx", 8, "Tám mẫu định hướng góc được dùng trong bài bốn lượt. Căn mặt trên trước khi thực hiện.", megaminx],
  ["skewb-basics", "Thao tác Skewb", "skewb", 3, "Ba bài kiểm tra ảnh hưởng của chuỗi xoay trục đến góc và tâm.", skewb],
  ["sq1-basics", "Lát cắt và hoán vị Square-1", "square1", 5, "Mẫu tập nhìn khe, xoay tầng và hai tình huống hoán vị.", square],
  ["clock-basics", "Điều khiển kim Clock", "clock", 4, "Luyện các nhóm kim, bánh xoay và đổi mặt.", clock],
];

export const SPECIAL_CASE_ROWS = [
  {
    id: "py-tip", group: "py-basics", name: "Khớp đỉnh trên", shape: "Đỉnh nhỏ",
    setup: "u'", algorithm: "u", tip: "Đối chiếu ba màu của đỉnh nhỏ với phần trục sát bên dưới. Chữ u thường chỉ xoay đỉnh nhỏ."
  },
  {
    id: "py-insert-right", group: "py-basics", name: "Chèn cạnh từ phải", shape: "Cạnh nền",
    setup: "L R' L' R", algorithm: "R' L R L'", tip: "Giữ mặt đang ghép ở dưới. Đặt cạnh mẫu bên phải ngay trên vùng cần chèn rồi kiểm tra hai màu khi chạy công thức."
  },
  {
    id: "py-insert-left", group: "py-basics", name: "Chèn cạnh từ trái", shape: "Cạnh nền",
    setup: "R' L R L'", algorithm: "L R' L' R", tip: "So màu cạnh với hai mặt bên. Giữ hướng như hình để cạnh mẫu nằm bên trái trước khi xoay."
  },
  {
    id: "py-cycle-a", group: "py-basics", name: "Đổi vòng ba cạnh · A", shape: "Chu kỳ ba cạnh",
    setup: "R U' R' U' R U' R'", algorithm: "R U R' U R U R'", tip: "Ba cạnh cần đổi chỗ nằm quanh cùng một đỉnh. Xác định màu phụ của từng viên để phân biệt hai chiều của chu kỳ."
  },
  {
    id: "py-cycle-b", group: "py-basics", name: "Đổi vòng ba cạnh · B", shape: "Chu kỳ ba cạnh",
    setup: "R U R' U R U R'", algorithm: "R U' R' U' R U' R'", tip: "Đây là chiều ngược với mẫu A. So thứ tự màu bên quanh đỉnh trước khi bắt đầu."
  },
  {
    id: "py-flip", group: "py-basics", name: "Lật hai cạnh cuối", shape: "Hai cạnh lệch hướng",
    setup: "L' U L U' L R' L' R", algorithm: "R' L R L' U L' U' L", tip: "Hai cạnh đã nằm đúng vị trí nhưng màu nằm sang bên kia. Giữ nguyên hướng khối trên hình khi chạy công thức."
  },
  {
    id: "skewb-sledge", group: "skewb-basics", name: "Sledgehammer", shape: "Xoay hai trục",
    setup: "L R' L' R", algorithm: "R' L R L'", tip: "Đối chiếu trục R và L theo ký hiệu góc cố định. Theo dõi một tâm được đẩy đi và một góc đổi hướng."
  },
  {
    id: "skewb-hedge", group: "skewb-basics", name: "Hedgeslammer", shape: "Xoay hai trục",
    setup: "R' L R L'", algorithm: "L R' L' R", tip: "So sánh với sledgehammer để thấy thứ tự hai trục bị đổi. Giữ nguyên hướng cầm giữa các nước."
  },
  {
    id: "skewb-double", group: "skewb-basics", name: "Hai lượt sledgehammer", shape: "Chu kỳ tâm",
    setup: "L R' L' R L R' L' R", algorithm: "R' L R L' R' L R L'", tip: "So màu tâm trước và sau mỗi lượt bốn nước. Trạng thái mẫu minh họa một chu kỳ tâm khi góc đang ở đúng vị trí."
  },
  {
    id: "sq1-cut", group: "sq1-basics", name: "Lát cắt đầu tiên", shape: "Phục hồi hình",
    setup: "/", algorithm: "/", tip: "Kiểm tra cả hai tầng có khe thẳng hàng. Dấu / là xoay lát cắt 180°."
  },
  {
    id: "sq1-cut-right", group: "sq1-basics", name: "Căn một nấc về phải", shape: "Phục hồi hình",
    setup: "/ (1,0)", algorithm: "(-1,0) /", tip: "Quan sát khe trên bị lệch một nấc. Xoay tầng trên 30° ngược rồi mới thực hiện lát cắt."
  },
  {
    id: "sq1-cut-left", group: "sq1-basics", name: "Căn một nấc về trái", shape: "Phục hồi hình",
    setup: "/ (-1,0)", algorithm: "(1,0) /", tip: "Đây là mẫu căn khe theo chiều ngược. Tầng dưới giữ nguyên khi tọa độ thứ hai bằng 0."
  },
  {
    id: "sq1-edge-cycle", group: "sq1-basics", name: "Chu kỳ ba cạnh trên", shape: "Hoán vị cạnh",
    setup: "(1,0) / (-3,0) / (-1,0) / (0,3) / (1,0) / (3,0) / (-1,0) / (0,-3) /",
    algorithm: "/ (0,3) / (1,0) / (-3,0) / (-1,0) / (0,-3) / (1,0) / (3,0) / (-1,0)",
    tip: "Giữ hình khối vuông như mẫu, rồi so thứ tự ba cạnh trên với tâm bên trước khi áp dụng.", source: squareEdges
  },
  {
    id: "sq1-corner-parity", group: "sq1-basics", name: "Hoán vị góc có parity", shape: "Parity góc",
    setup: "/ (3,3) / (-1,0) / (-2,0) / (-4,0) / (4,0) / (-2,0) / (1,0) / (-3,-3) /",
    algorithm: "/ (3,3) / (-1,0) / (2,0) / (-4,0) / (4,0) / (2,0) / (1,0) / (-3,-3) /",
    tip: "Dùng mô phỏng để kiểm tra khe cắt trước từng dấu /. Ví dụ chỉ áp dụng cho hoán vị góc đúng như hình.", source: squareCorners
  },
  {
    id: "clock-ur", group: "clock-basics", name: "Bánh phải phía trên", shape: "Nhóm góc phải",
    setup: "UR1-", algorithm: "UR1+", tip: "Quan sát bốn kim trong nhóm phải–trên ở mặt trước và kim tương ứng ở mặt sau."
  },
  {
    id: "clock-align", group: "clock-basics", name: "Căn đồng thời mặt trước", shape: "Toàn mặt",
    setup: "ALL3-", algorithm: "ALL3+", tip: "Khi các kim mặt trước đang cùng giờ, cả nhóm có thể cùng tiến ba nấc."
  },
  {
    id: "clock-top-bottom", group: "clock-basics", name: "Tách nhóm trên và dưới", shape: "Hai nhóm",
    setup: "D1+ U1-", algorithm: "U1+ D1-", tip: "Theo dõi các kim nằm ở phần giao nhau của hai nhóm. Nước thứ hai xoay ngược nước đầu ở phần giao."
  },
  {
    id: "clock-back", group: "clock-basics", name: "Căn nhóm kim mặt sau", shape: "Lật mặt",
    setup: "y2 ALL3- y2", algorithm: "y2 ALL3+ y2", tip: "Thực hiện y2 để đổi mặt, quay nhóm kim rồi trở lại góc nhìn ban đầu."
  }
];

const minxOrientation = [
  ["minx-eo", "Hai cạnh lệch · A", "F R U R' U' F'", "F U R U' R' F'"],
  ["minx-eo", "Hai cạnh lệch · B", "F U R U' R' F'", "F R U R' U' F'"],
  ["minx-eo", "Bốn cạnh lệch", "F R U2 R2 F R F' U2' F'", "F U2 F R' F' R2' U2' R' F'"],
  ["minx-co", "Mẫu góc 1", "R U R' U R U R' U2' R U' R'", "R U R' U2 R U' R' U' R U' R'"],
  ["minx-co", "Mẫu góc 2", "F R U2 R' U' R U' R' F'", "F R U R' U R U2' R' F'"],
  ["minx-co", "Mẫu góc 3", "R U2 R' U R U2 R'", "R U2' R' U' R U2' R'"],
  ["minx-co", "Mẫu góc 4", "R U R' U' R' F R U R U' R' F'", "F R U R' U' R' F' R U R U' R'"],
  ["minx-co", "Mẫu góc 5", "R U R' U R U2' R'", "R U2 R' U' R U' R'"],
  ["minx-co", "Mẫu góc 6", "R' U' R U' R' U2 R", "R' U2' R U R' U R"],
  ["minx-co", "Mẫu góc 7", "R U2 R' U' R U' R'", "R U R' U R U2' R'"],
  ["minx-co", "Mẫu góc 8", "R U R' U2 R U2 R'", "R U2' R' U2' R U' R'"],
];
let edges = 0, corners = 0;
for (const [group, name, algorithm, setup] of minxOrientation) {
  const edge = group === "minx-eo";
  SPECIAL_CASE_ROWS.push({
    id: group + "-" + (edge ? ++edges : ++corners), group, name, algorithm, setup,
    shape: edge ? "Định hướng cạnh" : "Định hướng góc",
    tip: edge ? "So dấu ngôi sao và dải màu cạnh trên năm mặt kề. Mỗi lượt xoay mặt là 72°." :
      "Giữ ngôi sao trên cùng màu với tâm. Đối chiếu các viên góc đã hướng đúng và vị trí màu trên dải bên."
  });
}
