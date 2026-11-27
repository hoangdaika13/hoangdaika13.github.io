import { LARGE_CASE_ROWS } from "./rubik-large-cases.mjs?v=3";

export const LARGE_PUZZLES = [
  { id: "8x8x8", name: "Rubik 8×8", description: "Ghép tâm 6×6, cạnh sáu mảnh và xử lý hai dạng parity sau thu gọn." },
  { id: "9x9x9", name: "Rubik 9×9", description: "Dùng tâm cố định, ghép cạnh bảy mảnh từ giữa ra ngoài và sửa từng cặp cánh cuối." }
];

const videos = {
  8: { id: "VMa-gfu0cnY", label: "Cubelelo · Hướng dẫn giải 8×8", edgeTime: 508 },
  9: { id: "SkPti_jZ3r0", label: "twistypuzzling · Hướng dẫn giải 9×9", edgeTime: 4621 }
};

function source(size, chapter) {
  const { id, label, edgeTime } = videos[size];
  const link = "https://www.youtube.com/watch?v=" + id;
  const start = chapter ? edgeTime : 0;
  return {
    sources: [{ label, url: link }],
    video: {
      id, label, start, source: link, chapters: chapter ? [
        { label: size === 8 ? "Bắt đầu ghép cạnh" : "Cạnh ghép thứ 11", time: start,
          caption: "Quan sát cách nhận diện đúng độ sâu của các cánh trước khi đưa các mảnh về cạnh ghép." }
      ] : [
        { label: "Toàn bộ lượt giải", time: 0, caption: "Theo dõi lần lượt ghép khối tâm, ghép cạnh và giải bằng các tầng ngoài." }
      ]
    }
  };
}

function sample(id, title, text) {
  const item = LARGE_CASE_ROWS.find((example) => example.id === id);
  return { title, text, setup: item.setup, algorithm: item.algorithm };
}

function exercise(id, goal) {
  const { setup, algorithm } = LARGE_CASE_ROWS.find((entry) => entry.id === id);
  return { goal, setup, algorithm };
}

export const LARGE_LESSONS = [
  {
    id: "8x8-reduction", puzzle: "8x8x8", level: "Nâng cao",
    title: "8×8 · Thu gọn tâm 6×6 và cạnh sáu mảnh",
    objective: "Dùng một góc làm mốc thứ tự màu, ghép sáu tâm và đưa cạnh ghép về trạng thái tương đương 3×3.",
    prerequisite: "7x7-reduction", caseGroups: ["large-8-centers", "large-8-wings"],
    guide: [
      { title: "Chọn mặt tham chiếu trước khi ghép tâm", text: "Khối 8×8 có tâm 6×6 di động. Tìm một viên góc có mặt trắng và so thứ tự hai màu bên để biết chúng nằm ở mặt nào. Giữ trắng ở dưới và vàng ở trên trong các ví dụ. Sau khi ghép hai tâm đối diện, dùng góc làm mốc để kiểm tra cả bốn tâm còn lại." },
      { title: "Ghép từng thanh sáu ô", text: "Tạo các thanh sáu ô trên mặt đang dùng làm chỗ làm việc, rồi lần lượt đưa vào tâm cần hoàn thành. Cất thanh đã đúng khỏi lát sắp xoay trước khi chuyển thanh tiếp theo. Chừa hai mặt cuối làm không gian xử lý những ô lạc màu." },
      sample("large-8-center-fix", "Sửa ô lạc màu ở hai tâm cuối", "Mẫu cho thấy một ô lệch ở tâm trên và một ô ở tâm trước. Đối chiếu hình trước/sau và theo dõi hai lát trong. Tâm vốn đã cùng màu ở các mặt khác cần giữ nguyên ở kết quả."),
      sample("large-8-wing-3", "Ghép cạnh theo ba lớp cánh", "Sáu mảnh tạo thành ba cặp đối xứng. Ghép theo đúng độ sâu 2, 3 và 4 tính từ ngoài, cất cạnh đã ghép rồi trả lớp trong để phục hồi tâm. Mẫu này sửa riêng cặp cánh lớp 3 ở cạnh trên–trước."),
      { title: "Chuyển sang các nước lớp ngoài", text: "Kiểm tra đủ sáu tâm đồng màu và mười hai cạnh ghép, mỗi cạnh có sáu mảnh cùng hướng. Khi đó dùng cách giải 3×3 với sáu tầng ngoài. Nếu gặp một cạnh ghép lật hoặc hai cạnh ghép đối diện đổi chỗ, mở bài parity 8×8." }
    ],
    exercise: exercise("large-8-center-fix", "Đưa hai ô lạc về đúng tâm và giữ tất cả cạnh nguyên dạng."),
    mistake: "Đếm nhầm 3R thành 3Rw. 3R chỉ một lớp ở độ sâu 3 từ phải. 3Rw xoay ba lớp liên tiếp, kể cả mặt phải.",
    ...source(8, false)
  },
  {
    id: "8x8-parity", puzzle: "8x8x8", level: "Nâng cao",
    title: "8×8 · OLL và PLL parity sau khi ghép cạnh",
    objective: "Nhận diện đúng cạnh ghép bị lật hoặc hai cạnh ghép đổi chỗ và kiểm tra khối sau mỗi công thức.",
    prerequisite: "8x8-reduction", caseGroups: ["large-8-parity", "large-8-wings"],
    guide: [
      sample("large-8-oll-parity", "Một cạnh ghép bị lật", "Giữ cả cạnh ghép bị lật ở trên–trước. Tất cả sáu mảnh trong cạnh đó đều cùng hướng sai. Nếu chỉ một cặp cánh lệch, chọn công thức ghép cánh theo độ sâu trước."),
      sample("large-8-pll-parity", "Hai cạnh ghép đối diện cần đổi", "Tầng trên đã cùng màu, còn hai cạnh ghép trên–trước và trên–sau đứng sai chỗ. Dùng mẫu kia để phân biệt với cạnh bị lật. Kiểm tra lại PLL sau khi sửa parity."),
      { title: "Đọc từng cặp nước trước khi xoay", text: "4Rw xoay bốn lớp tính từ phải. 4Rw R' để lại mặt ngoài như cũ và tác động lên ba lát trong. Dù nhìn thấy bốn lớp chuyển động ở nước đầu, vẫn cần thực hiện cả hai nước." }
    ],
    exercise: exercise("large-8-pll-parity", "Khôi phục hai cạnh ghép đối diện. Kiểm tra cả dải cạnh và tâm ở mặt trước lẫn mặt sau."),
    mistake: "Chạy công thức lật cả cạnh khi chỉ có một cặp cánh lệch. Hãy kiểm tra đủ sáu mảnh trước khi chọn ca.",
    ...source(8, true)
  },
  {
    id: "9x9-reduction", puzzle: "9x9x9", level: "Nâng cao",
    title: "9×9 · Thu gọn tâm 7×7 và cạnh bảy mảnh",
    objective: "Dùng viên tâm giữa và mảnh cạnh giữa làm mốc cho các vòng tâm và cánh.",
    prerequisite: "7x7-reduction", caseGroups: ["large-9-centers", "large-9-wings"],
    guide: [
      { title: "Căn màu và giữ tâm cố định", text: "Viên chính giữa mỗi mặt xác định màu của tâm 7×7. Bắt đầu với cụm 3×3 quanh tâm đó rồi mở ra cụm 5×5 và vòng ngoài. Giữ trắng ở dưới và vàng ở trên như hình khi thử các nước mẫu." },
      sample("large-9-center-cycle", "Thử giao hoán hai lớp trong", "Lớp 3R và 2U đi qua các vị trí tâm lệch trong hình. Xem chuỗi thay đổi sáu ô tâm nhưng giữ cạnh và góc. Dùng ví dụ để luyện đếm lớp từ đúng mặt."),
      sample("large-9-center-fix", "Phục hồi tâm cuối", "Dùng một mặt gần tâm cần sửa để đặt ô lạc màu. So hai vị trí lệch trong ảnh trước khi thực hiện; xong chuỗi, sáu tâm cần đồng màu."),
      sample("large-9-wing-2", "Ghép từ mảnh giữa ra ngoài", "Mỗi cạnh có một mảnh giữa và ba cặp cánh. Ghép cặp gần nhất ở lớp 4 rồi lớp 3 và lớp 2, giữ mảnh giữa làm mốc. Mẫu sửa riêng cặp xa nhất ở lớp 2."),
      { title: "Đếm mười hai cạnh rồi giải phần 3×3", text: "Nhìn cả hai mặt của từng cạnh ghép. Mảnh giữa và sáu cánh cần trùng cả hai màu. Cất các cạnh đã ghép, khôi phục lớp trong, rồi chuyển sang giải bằng nước lớp ngoài." }
    ],
    exercise: exercise("large-9-center-cycle", "Sửa sáu ô tâm đã đặt lệch. Kiểm tra bốn cạnh quanh mặt trước giữ nguyên."),
    mistake: "So cánh chỉ bằng hai màu mà quên độ sâu. Cánh đúng màu nhưng ở sai vòng sẽ không ghép được với mảnh giữa.",
    ...source(9, false)
  },
  {
    id: "9x9-wings", puzzle: "9x9x9", level: "Nâng cao",
    title: "9×9 · Sửa từng cặp cánh ở cạnh cuối",
    objective: "Phân biệt cặp gần mảnh giữa, cặp trung gian và cặp sát hai đầu.",
    prerequisite: "9x9-reduction", caseGroups: ["large-9-wings"],
    guide: [
      sample("large-9-wing-4", "Cặp gần mảnh giữa · lớp 4", "Đặt cạnh lỗi trên–trước. Hai mảnh sát bên viên giữa là cặp thuộc lớp 4 khi đếm từ hai phía. Công thức đưa cặp đó về đúng hướng và giữ viên giữa."),
      sample("large-9-wing-3", "Cặp trung gian · lớp 3", "Đặt cạnh như mẫu và đếm từ cả hai đầu trước khi chạy. Các cánh lớp 2 và lớp 4 vẫn ở đúng vị trí sau chuỗi."),
      sample("large-9-wing-2", "Cặp sát đầu · lớp 2", "Hai mảnh sát hai góc là cặp lớp 2. So màu của mỗi mảnh với cả tâm trên và tâm trước, rồi xem kết quả từ cả hai mặt."),
      { title: "Xem lại cạnh sau mỗi lượt", text: "Nếu vẫn còn một cặp cánh sai, xác định độ sâu mới và chọn đúng ca. Khi cả bảy mảnh đồng nhất, chuyển sang bước giải 3×3." }
    ],
    exercise: exercise("large-9-wing-3", "Sửa đúng cặp cánh trung gian. Mảnh giữa và các cặp còn lại phải giữ nguyên."),
    mistake: "Nhầm mảnh giữa với một cánh gần tâm và xoay lát 5R. Ba cặp trong bài thuộc các lớp 2, 3 và 4.",
    ...source(9, true)
  }
];
