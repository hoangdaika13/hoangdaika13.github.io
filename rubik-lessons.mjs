// Original Vietnamese course. Video chapters refer to the uploader's own timestamps.
export const PUZZLES = [
  { id: "3x3x3", name: "Rubik 3×3", description: "Từ nước xoay đầu tiên đến CFOP, Roux và ZZ." },
  { id: "2x2x2", name: "Rubik 2×2", description: "Nhận diện góc, giải theo từng tầng và học Ortega." },
  { id: "4x4x4", name: "Rubik 4×4", description: "Ghép tâm, ghép cạnh, Reduction, Yau và parity." },
  { id: "5x5x5", name: "Rubik 5×5", description: "Tâm 3×3, cạnh ba mảnh và tình huống cạnh cuối." },
  { id: "6x6x6", name: "Rubik 6×6", description: "Giữ đúng thứ tự tâm màu và phân biệt các lớp trong." },
  { id: "7x7x7", name: "Rubik 7×7", description: "Ghép thanh tâm, cạnh năm mảnh và thu gọn về 3×3." },
  { id: "pyraminx", name: "Pyraminx", description: "Khối tam giác với đỉnh, trục và sáu cạnh." },
  { id: "megaminx", name: "Megaminx", description: "Khối 12 mặt, bắt đầu với ngôi sao năm cánh." },
  { id: "skewb", name: "Skewb", description: "Các mặt xoay quanh trục đi qua góc." },
  { id: "square1", name: "Square-1", description: "Đưa khối về hình vuông trước khi sắp các viên." },
  { id: "mirror", name: "Mirror Cube", description: "Nhận diện tâm, cạnh và góc theo kích thước." },
  { id: "clock", name: "Clock", description: "Học cách nút và bánh xoay tác động lên đồng hồ." }
];

const MAIN = "https://jperm.net/3x3";
const CUBESKILLS = "https://www.cubeskills.com/tutorials/";
const NORTH = "Cơ bản";
const NEXT = "Trung cấp";
const EXPERT = "Nâng cao";
const CUBE = "3x3x3";
const source = (label, url) => ({ label, url });

function youtube(id, label, start, end, caption) {
  const link = "https://www.youtube.com/watch?v=" + id;
  return { id, label, start, end, source: link, chapters: caption ? [{ label, time: start, caption }] : [] };
}

function example(title, text, setup, algorithm, extras = {}) {
  return { title, text, setup, algorithm, ...extras };
}

function tutorial(id, puzzle, title, objective, guide, options) {
  return {
    id, puzzle, title, objective, guide,
    level: options.level || NORTH,
    prerequisite: options.prerequisite || "",
    mistake: options.mistake,
    exercise: options.exercise || { goal: "Thực hành theo ví dụ và đối chiếu kết quả được mô tả trong bài." },
    sources: options.sources,
    video: options.video,
    caseGroups: options.caseGroups?.slice()
  };
}

const mainVideo = (label, start, end, caption) => youtube("7Ron6MN45LY", "J Perm · " + label, start, end, caption);
const mainSources = [
  source("J Perm · Giải 3×3 theo tầng", MAIN),
  source("CubeSkills · Giải 3×3 cơ bản", CUBESKILLS + "the-beginners-method-for-solving-the-rubiks-cube")
];
const cfopSources = [
  source("J Perm · CFOP", "https://jperm.net/3x3/cfop"),
  source("CubeSkills · Lớp cuối bốn lượt", CUBESKILLS + "4-look-last-layer")
];
const rouxTutorial = source("Kian Mansour · Hướng dẫn Roux", "https://sites.google.com/view/kianroux/roux-tutorial");

// The 3×3 demos start from engine colors with x2 applied: white on D, yellow on U.
// Compare other sources by face position; they sometimes use a different grip.
const whiteDown = "x2";
const turn = "R U R' U'";
const insertRight = "U R U' R' U' F' U F";
const insertLeft = "U' L' U L U F U' F'";
const orientEdges = "F R U R' U' F'";
const swapEdges = "R U R' U R U2 R' U";
const placeCorners = "U R U' L' U R' U' L";
const twist = "R' D' R D";
const sune = "R U R' U R U2 R'";
const tperm = "R U R' U' R' F R2 U' R' U' R U R' F'";
const f2lSeparated = "U' R U R' U2 R U' R'";
const rouxLastEdges = "U M' U' M";
const zzBlocks = "L' U L R U' R'";
const edgeLine = "F U R U' R' F'";
const edgeElbow = edgeLine + " " + edgeLine;
const edgeDot = edgeElbow + " U2 " + edgeLine;
const cornerTwistSetup = "x2 U D' R' D R D' R' D R D' R' D R D' R' D R U' D' R' D R D' R' D R";
const finishCornerTwists = [twist, twist, "U", twist, twist, twist, twist, "U'"].join(" ");

const BEGINNER = [
  tutorial("notation", CUBE, "Cầm khối trắng dưới và đọc ký hiệu", "Tập sáu mặt, dấu nháy, nước 180°, lớp giữa, hai lớp và xoay toàn khối.", [
    example("Đặt tâm trắng ở đáy", "Đặt tâm trắng ở mặt D, tâm vàng ở mặt U và quay một mặt bên về phía bạn làm F. Tâm có một màu, cạnh có hai màu, góc có ba màu. Nhớ rằng U và D chỉ vị trí mặt theo tay cầm; tên đó có thể đổi khi xoay cả khối.", whiteDown, ""),
    example("Mặt phải R và R'", "Theo dõi góc trên–trước–phải. Nhìn thẳng vào mặt phải để xác định chiều quay. R đi 90° thuận chiều kim đồng hồ, R' đi 90° ngược chiều. Hai hình dùng cùng một góc nhìn.", whiteDown, "R", {
      comparison: [
        { label: "R · thuận chiều", setup: whiteDown, algorithm: "R", marker: { face: "R", cell: 0 }, arrow: "clockwise" },
        { label: "R' · ngược chiều", setup: whiteDown, algorithm: "R'", marker: { face: "R", cell: 0 }, arrow: "counterclockwise" }
      ],
      quiz: {
        prompt: "Khi nhìn thẳng vào mặt phải, ký hiệu nào xoay ngược chiều kim đồng hồ?",
        options: ["R", "R'", "R2"], answer: 1,
        feedback: "Dấu nháy đổi chiều quay. R2 là nửa vòng, theo chiều nào cũng đến cùng vị trí."
      }
    }),
    example("Mặt trên U và mặt đáy D", "Nhìn từ phía trên để đọc U và từ dưới đáy nhìn lên để đọc D. Cùng dấu nhưng hai mặt có hướng quay ngược nhau khi nhìn từ mặt trước. Từng cặp nước trong mô phỏng trả lớp về chỗ cũ.", whiteDown, "U U' D D'"),
    example("Mặt trước F và mặt sau B", "Đọc F khi nhìn vào mặt trước. Để đọc B, tưởng tượng đứng đối diện mặt sau rồi mới xác định chiều kim đồng hồ. Theo dõi một góc ở mỗi lần quay.", whiteDown, "F F' B B'"),
    example("Mặt phải R và mặt trái L", "Đọc mỗi nước từ góc nhìn trực diện mặt đang xoay. Trong lượt R, hai lớp bên trái đứng yên. Trong lượt L, hai lớp bên phải đứng yên.", whiteDown, "R R' L L'"),
    example("Nửa vòng và cách đọc nhóm nước", "Số 2 là 180°, từ hai chiều đều cho cùng kết quả. Đọc từ trái sang phải. Sau hai lượt R2, mặt phải trở lại khởi đầu. Bốn nước cuối là nhóm đưa một số góc trắng vào khe trước–phải.", whiteDown, "R2 R2 " + turn),
    example("Lớp giữa M, E, S", "M nằm giữa L và R, lấy chiều L. E nằm giữa D và U, lấy chiều D. S nằm giữa F và B, lấy chiều F. Các lớp ngoài đứng yên trong từng nước. Sau mỗi cặp, kiểm tra lại tâm trắng ở D.", whiteDown, "M M' E E' S S'"),
    example("Xoay hai lớp cùng lúc", "Rw xoay lớp phải và lớp sát nó theo chiều R. Tương tự, Uw/Dw, Fw/Bw và Lw lấy tên theo mặt ngoài. Tua từng nước để so sánh số lớp di chuyển với một nước mặt ngoài.", whiteDown, "Rw Rw' Lw Lw' Uw Uw' Dw Dw' Fw Fw' Bw Bw'"),
    example("Xoay toàn khối theo x, y, z", "x cùng chiều R, y cùng chiều U, z cùng chiều F. Cả khối đổi góc cầm và các tên mặt được đọc lại từ góc mới. Dùng y hoặc y' nếu muốn đổi mặt trước mà vẫn giữ trắng dưới. Chạy hết từng cặp để trở lại góc cầm ban đầu.", whiteDown, "x x' y y' z z'")
  ], {
    mistake: "Lấy chiều quay theo góc nhìn trước cho mọi mặt. Hãy tưởng tượng nhìn trực diện từng mặt đang xoay.",
    exercise: { goal: "Mặt phải đã xoay một phần tư vòng. Hãy chọn nước ngược để đưa nó về vị trí ban đầu.", setup: "x2 R", algorithm: "R'" },
    sources: [source("WCA · Quy ước ký hiệu", "https://www.worldcubeassociation.org/regulations/#article-12-notation"), source("J Perm · Ký hiệu", "https://jperm.net/3x3/moves"), ...mainSources],
    video: youtube("emOpNhejJXo", "CubeSkills · Ký hiệu", 0, 212, "Đổi góc cầm để nhìn trực diện mặt đang xoay. Đọc dấu nháy và số 2 trước khi xoay.")
  }),
  tutorial("white-cross", CUBE, "Dấu cộng trắng", "Đưa đủ bốn cạnh trắng vào mặt trắng và khớp bốn màu bên với tâm.", [
    example("Tìm cạnh đúng", "Giữ tâm trắng ở D. Cạnh trắng trên mặt U có thêm một màu bên. Căn U cho màu bên trùng với tâm ngay dưới nó. Trong mẫu, cạnh đã khớp tâm F; xoay F2 để đưa trắng xuống đáy.", "x2 F2", "F2"),
    example("Lắp hai cạnh trực tiếp", "Trong mẫu hai cạnh trắng đã ở trên mặt F và R, mỗi cạnh khớp tâm bên của mình. Đưa cạnh phải xuống bằng R2, rồi cạnh trước bằng F2. Nếu cạnh mới chưa khớp, căn lớp U trước khi xoay 180°. Chọn mặt xoay sao cho không kéo cạnh trắng đã giải ra khỏi đáy.", "x2 F2 R2", "R2 F2"),
    example("So sánh màu cạnh với tâm", "Cả hai hình đều có bốn cạnh trắng ở đáy. Dùng hàng dưới của mỗi mặt bên để kiểm tra. Hình đúng có màu cạnh giữa khớp tâm ở cả bốn phía.", "x2 D", "D'", {
      comparison: [
        { label: "Cạnh trắng ở đáy, màu bên lệch tâm", setup: "x2 D" },
        { label: "Dấu cộng đúng, đủ bốn màu bên khớp tâm", setup: whiteDown }
      ],
      quiz: {
        prompt: "Hình nào đã hoàn thành dấu cộng trắng?",
        options: ["Hình có màu bên lệch tâm", "Hình đủ bốn màu bên khớp tâm"], answer: 1,
        feedback: "Bốn cạnh trắng cần đúng cả hướng lẫn vị trí. Kiểm tra từng mặt bên trước khi chuyển bài."
      }
    }),
    example("Cách bông hoa quanh tâm vàng", "Nếu mới tập, gom bốn cạnh trắng quanh tâm vàng U trước. Với từng cánh hoa, căn U cho màu bên khớp tâm cùng màu rồi xoay mặt bên 180°. Trong mẫu bốn cánh đã được căn, thử làm lần lượt L2 B2 R2 F2. Cuối bước, dấu cộng nằm quanh tâm trắng ở đáy.", "x2 F2 R2 B2 L2", "L2 B2 R2 F2"),
    example("Đặt lại một cạnh ở tầng giữa", "Cạnh trắng đích đang ở khe trước–trái. Quan sát màu bên của nó, rồi thử xoay F để đưa cạnh về giữa mặt trước và đáy. Tua để phân biệt cạnh ở giữa với góc kề nó.", "x2 F'", "F")
  ], {
    prerequisite: "notation",
    mistake: "Dừng khi vừa thấy dấu cộng trắng. Kiểm tra màu ô cạnh ở hàng dưới với tâm trên cả bốn mặt bên.",
    exercise: { goal: "Khớp cạnh trắng của mặt trước và mặt phải.", setup: "x2 F2 R2", algorithm: "R2 F2" },
    sources: mainSources,
    video: mainVideo("Dấu cộng trắng", 20, 104, "Video nguồn minh họa dấu cộng ở trên. Đối chiếu cách khớp màu bên với tâm; mô phỏng của bài giữ tâm trắng ở đáy.")
  }),
  tutorial("white-corners", CUBE, "Góc trắng và tầng đầu", "Hoàn thành bốn góc trắng. Cả hàng sát mặt trắng của mỗi mặt bên phải cùng màu.", [
    example("Giữ nguyên dấu cộng ở đáy", "Tiếp tục cầm trắng ở D, vàng ở U. Tìm một góc trắng ở tầng trên. Hai màu còn lại cho biết hai tâm bên cạnh ô đích. Căn U để đưa góc lên trên ô đó, rồi đổi mặt trước bằng y nếu cần đưa khe về phía trước–phải.", whiteDown, ""),
    example("Đưa góc xuống khe phải", "Đưa góc vào vị trí trên–trước–phải, ngay trên ô đích. Dùng trọn bộ R U R' U' rồi kiểm tra. Lặp theo hướng của miếng góc đến khi trắng nằm dưới.", "x2 U R U' R'", turn),
    example("Lấy góc mắc ở đáy", "Đặt góc sai tại dưới–trước–phải, dùng một bộ bốn nước để đưa lên. Sau đó tìm hai tâm đúng, đưa nó đến phía trên khe cần lắp rồi thử lại.", "x2 R U R' U'", "U R U' R'")
  ], {
    prerequisite: "white-cross",
    mistake: "Đúng mặt trắng nhưng sai hàng màu bên. Hãy kiểm tra đủ ba màu trên từng góc.",
    exercise: { goal: "Lắp góc trước–phải và kiểm tra dấu cộng còn nguyên.", setup: "x2 U R U' R'", algorithm: turn },
    sources: mainSources,
    video: mainVideo("Tầng đầu", 104, 240, "Khớp hai màu bên của góc với tâm rồi lặp đủ bốn nước để đưa góc về khe.")
  }),
  tutorial("middle-edges", CUBE, "Ghép cạnh tầng giữa", "Giữ nguyên tầng trắng và chèn bốn cạnh giữa vào đúng vị trí.", [
    example("Chọn trái hay phải", "Tìm cạnh trên cùng không chứa màu vàng. Xoay U để màu trước khớp tâm trước. Màu còn lại ở trên sẽ cho biết cạnh cần đi sang trái hay sang phải.", "x2 F' U' F U R U R' U'", ""),
    example("Chèn sang phải", "Giữ viên cần chèn ở vị trí trên–trước và tâm đích ở bên phải. Sau chuỗi, kiểm tra cạnh đã khớp cả tâm trước lẫn tâm phải.", "x2 F' U' F U R U R' U'", insertRight),
    example("Chèn sang trái", "Giữ viên ở trên–trước và để tâm đích phía trái. Dùng chuỗi đối xứng. Nếu cạnh cần tìm mắc sai dưới tầng giữa, dùng một lượt chèn để đưa nó lên rồi căn lại.", "x2 F U F' U' L' U' L U", insertLeft)
  ], {
    prerequisite: "white-corners",
    mistake: "Chèn một viên có màu vàng xuống tầng giữa; hãy chọn viên có hai màu thuộc các tâm bên.",
    exercise: { goal: "Chèn cạnh phải và xác nhận tầng trắng vẫn khớp.", setup: "x2 F' U' F U R U R' U'", algorithm: insertRight },
    sources: mainSources,
    video: mainVideo("Cạnh tầng giữa", 240, 345, "Khớp màu trước với tâm. Nhìn màu hướng lên để chọn chuỗi chèn sang trái hoặc phải.")
  }),
  tutorial("yellow-cross", CUBE, "Định hướng bốn cạnh vàng", "Tạo dấu cộng vàng trên đỉnh và giữ hai tầng đầu đã giải.", [
    example("Đọc hình trên đỉnh", "Chỉ nhìn bốn ô cạnh quanh tâm vàng. Chúng có thể tạo chấm, chữ L, đường thẳng hoặc dấu cộng. Màu các góc chưa ảnh hưởng đến bước này.", "x2 F U R U' R' F'", ""),
    example("Đường ngang", "Căn hai cạnh vàng nằm ngang khi nhìn từ phía trên. Chạy chuỗi để cả bốn cạnh quay vàng lên.", "x2 " + edgeLine, orientEdges),
    example("Chữ L", "Đặt hai cạnh vàng về phía sau và trái. Chạy chuỗi một lần để có đường ngang rồi thêm một lần để ra dấu cộng.", "x2 " + edgeElbow, orientEdges + " " + orientEdges),
    example("Chấm vàng ở tâm", "Chạy một lượt để đổi ra dạng chữ L. Trong ví dụ, cần căn U2 để đưa chữ L về sau và trái. Từ đó chạy lại hai lượt.", "x2 " + edgeDot, [orientEdges, "U2", orientEdges, orientEdges].join(" ")),
    example("Kiểm tra trước khi chuyển bước", "Cả bốn cạnh vàng hướng lên thì qua bài tiếp. Màu cạnh bên có thể còn lệch tâm và sẽ được xử lý sau.", "x2", "")
  ], {
    prerequisite: "middle-edges",
    mistake: "Dùng các ô góc để nhận dạng chữ L hoặc đặt đường thẳng theo chiều dọc.",
    exercise: { goal: "Định hướng bốn cạnh vàng từ trạng thái mẫu.", setup: "x2 F U R U' R' F'", algorithm: orientEdges },
    sources: mainSources,
    video: mainVideo("Dấu cộng vàng", 345, 388, "Nhìn bốn cạnh trên, nhận dạng hình rồi xoay theo hướng được minh họa.")
  }),
  tutorial("yellow-edges", CUBE, "Khớp màu bên của cạnh vàng", "Sắp bốn cạnh vàng vào đúng tâm bên mà vẫn giữ dấu cộng.", [
    example("Căn thử mặt trên", "Để vàng phía trên và xoay U để thử các vị trí. Nếu có đủ bốn cạnh khớp tâm, chuyển bài. Nếu chỉ khớp hai cạnh, xác định chúng nằm kề nhau hay đối diện.", "x2 R U2 R' U' R U' R'", ""),
    example("Hai cạnh đúng kề nhau", "Giữ hai cạnh đúng ở phía sau và phía phải. Chuỗi dưới đây có thêm U để trở về cách căn của ví dụ. Căn lại U nếu bốn màu bên đã vào đúng thứ tự.", "x2 U' R U2 R' U' R U' R'", swapEdges),
    example("Hai cạnh đúng đối diện", "Nếu không tìm được cặp kề đúng, dùng công thức để đổi dạng rồi xoay U tìm cặp kề. Trong mẫu, căn U' để chạy lượt đầu và U2 để đưa hai cạnh khớp về phía sau và phải trước lượt thứ hai.", "x2 U' R U2 R' U' R U' R' U2 U' R U2 R' U' R U' R' U", ["U'", swapEdges, "U2", swapEdges].join(" "))
  ], {
    prerequisite: "yellow-cross",
    mistake: "Thấy dấu cộng vàng và bỏ qua các màu bên. Kiểm tra màu cạnh ở chính giữa từng mặt bên.",
    exercise: { goal: "Khớp tất cả màu cạnh bên trong mẫu kề nhau.", setup: "x2 U' R U2 R' U' R U' R'", algorithm: swapEdges },
    sources: mainSources,
    video: mainVideo("Khớp cạnh vàng", 388, 438, "Xoay mặt trên để tìm các cạnh đã khớp rồi cầm khối theo cặp cạnh đúng.")
  }),
  tutorial("place-corners", CUBE, "Đưa góc vàng về đúng vị trí", "Xác định và đặt đúng bộ ba màu cho mỗi ô góc, trước khi xoay hướng viên.", [
    example("Nhìn bộ ba màu", "Góc đúng vị trí khi ba màu của nó là ba màu tâm liền kề. Màu vàng có thể hướng sang bên. Tìm đủ ba màu trước khi đánh giá viên góc.", "x2 L' U R U' L U R' U'", ""),
    example("Giữ góc đúng ở trên–trước–phải", "Nếu đã có một góc đúng vị trí, đổi hướng cầm cả khối quanh trục đứng để góc đó nằm trên–trước–phải rồi thực hiện chuỗi. Có thể cần lặp một lượt nữa.", "x2 L' U R U' L U R' U'", placeCorners),
    example("Khi chưa có góc nào đúng", "Thực hiện chuỗi từ một hướng bất kỳ để tạo góc đúng, sau đó chuyển góc đó đến vị trí giữ cố định. Các cạnh phải khớp trước khi làm bước này.", "x2 L' U R U' L U R' U' y2 L' U R U' L U R' U' y2", "")
  ], {
    prerequisite: "yellow-edges",
    mistake: "Đánh giá chỉ theo hướng vàng. Bước này xét vị trí theo bộ ba màu, chưa xét hướng.",
    exercise: { goal: "Đặt lại ba góc còn sai, giữ nguyên góc trước–phải.", setup: "x2 L' U R U' L U R' U'", algorithm: placeCorners },
    sources: mainSources,
    video: mainVideo("Vị trí góc vàng", 438, 501, "Tìm góc có bộ ba màu khớp các tâm, giữ nó trước–phải rồi hoán vị ba góc còn lại.")
  }),
  tutorial("twist-corners", CUBE, "Định hướng góc vàng và hoàn thành", "Xoay hướng góc vàng khi cả bốn góc đã đúng vị trí.", [
    example("Giữ khối cố định", "Bản minh họa giữ vàng ở trên. Đưa góc sai hướng đến trên–trước–phải. Thực hiện đủ bộ R' D' R D, lặp đến khi vàng hướng lên ở góc đó. Video nguồn dùng cách cầm vàng ở dưới và nhóm nước tương ứng.", cornerTwistSetup, twist + " " + twist),
    example("Chuyển sang góc kế tiếp", "Chỉ xoay U để đưa góc tiếp theo đến trên–trước–phải. Những tầng còn lại có thể trông xáo tạm thời. Làm trọn mỗi bộ bốn nước và giữ nguyên hướng cầm.", cornerTwistSetup, finishCornerTwists),
    example("Căn lớp cuối", "Khi mọi góc đã hướng vàng lên, căn U để dải màu bên thẳng với tâm. Kiểm tra sáu mặt đều thống nhất màu.", "x2 U", "U'")
  ], {
    prerequisite: "place-corners",
    mistake: "Xoay toàn khối để đổi góc hoặc dừng giữa bộ bốn nước. Hãy hoàn tất bộ, sau đó chỉ xoay lớp chứa góc vàng.",
    exercise: { goal: "Hoàn thành hai góc của mẫu, rồi kiểm tra cả sáu mặt.", setup: cornerTwistSetup, algorithm: finishCornerTwists },
    sources: mainSources,
    video: mainVideo("Xoay hướng góc vàng", 501, 558, "Video cầm vàng phía dưới. Hoàn thành từng bộ bốn nước, chỉ xoay mặt vàng để đưa góc tiếp theo tới khe thao tác.")
  })
];


// These teaching arrangements cover the line, elbow and dot in separate
// examples. Each step has a fixed checkpoint derived from the whole solve.
const sampleMoves = [
  ["R2 B2", turn, insertRight, orientEdges, swapEdges, placeCorners, finishCornerTwists],
  ["L2 D2 F2 D2", "L' U' L U", insertLeft, orientEdges + " " + orientEdges, swapEdges, placeCorners, finishCornerTwists],
  ["D B2 D' L2", turn + " " + turn, insertRight + " y2 " + insertRight + " y2",
   [orientEdges, "U2", orientEdges, orientEdges].join(" "), swapEdges, placeCorners, finishCornerTwists]
];
const checkpoints = [
  ["Dấu cộng trắng dưới đáy", "Giữ tâm trắng ở D và tâm vàng ở U. Kiểm tra các cạnh trắng bằng bốn ô giữa của hàng dưới: màu từng ô phải khớp tâm bên."],
  ["Tầng đầu", "Giữ trắng ở đáy. Đưa góc qua khe đúng và kiểm tra cả hàng dưới ở bốn mặt bên."],
  ["Cạnh tầng giữa", "Giữ nguyên tầng trắng đã giải. Căn cạnh đích theo tâm trước rồi chèn sang đúng khe bên trái hoặc phải."],
  ["Dấu cộng vàng", "Nhận diện bốn cạnh quanh tâm vàng trước khi chọn hướng cầm. Kiểm tra hai tầng đầu vẫn giữ nguyên."],
  ["Khớp cạnh vàng", "Chọn cặp cạnh đúng, rồi đổi vị trí các cạnh còn lại. So màu ở cả bốn mặt bên."],
  ["Đặt góc vàng", "Dựa vào bộ ba màu để xác định ô đích. Màu vàng ở góc có thể đang hướng ngang."],
  ["Xoay góc và hoàn thành", "Xoay đủ bốn nước ở cùng một vị trí. Dùng U đưa góc kế vào khe thao tác, rồi căn lớp cuối."]
];

function reverseSequence(sequence) {
  return sequence.split(" ").reverse().map((token) =>
    token.endsWith("2") ? token : token.endsWith("'") ? token.slice(0, -1) : token + "'"
  ).join(" ");
}

const exampleVideos = [
  youtube("DepFQpJ5KqU", "J Perm · Ví dụ giải trọn khối", 0, undefined, "Theo dõi cách khớp mặt bên khi làm dấu cộng và cách lấy cạnh kẹt ra khỏi tầng giữa."),
  youtube("STRO01yO_Ks", "Tommy Cherry · Ví dụ giải với bông hoa", 47, 649, "Bắt đầu ở phần xáo khối. Tiếp theo, gom bốn cạnh trắng quanh tâm vàng."),
  youtube("MmHu7bvsIsE", "CubeHead · Ví dụ phương pháp cơ bản", 0, undefined, "Dừng ở cuối mỗi giai đoạn. Đối chiếu màu các tâm bên trước khi chuyển bước.")
];
exampleVideos[1].chapters = [
  { label: "Xáo khối", time: 47, caption: "Chuẩn bị trạng thái ban đầu." },
  { label: "Bông hoa", time: 74, caption: "Gom cạnh trắng quanh tâm vàng." },
  { label: "Dấu cộng trắng", time: 141, caption: "Khớp từng màu bên trước khi đặt cạnh vào mặt trắng." },
  { label: "Tầng trắng", time: 186, caption: "Nhìn đủ ba màu để tìm khe cho mỗi góc." },
  { label: "Cạnh tầng giữa", time: 302, caption: "Dựa vào màu hướng lên để chọn trái hoặc phải." },
  { label: "Dấu cộng vàng", time: 412, caption: "Xét bốn cạnh xung quanh tâm vàng." },
  { label: "Khớp cạnh vàng", time: 455, caption: "Đối chiếu màu bên với tâm." },
  { label: "Vị trí góc", time: 521, caption: "Khớp bộ ba màu rồi mới xoay hướng góc." },
  { label: "Hoàn thành", time: 598, caption: "Xoay đủ nhóm bốn nước và kiểm tra toàn bộ sáu mặt." }
];
const WALKTHROUGHS = exampleVideos.map((video, index) => {
  const sequence = sampleMoves[index];
  const algorithm = sequence.join(" ");
  const setup = "x2 " + reverseSequence(algorithm);
  const guide = checkpoints.map(([title, text], step) =>
    example(title, text, [setup, ...sequence.slice(0, step)].join(" "), sequence[step])
  );
  guide.unshift(example("Một lượt giải trọn khối",
    "Bắt đầu với trắng ở đáy và vàng ở trên. Ba lượt mẫu dùng các trạng thái xáo khác nhau để luyện đường ngang, chữ L và chấm vàng. Video nguồn có lượt xáo và có thể dùng góc cầm khác; hãy đối chiếu mục tiêu từng bước.",
    setup, algorithm
  ));
  return tutorial(index ? "walkthrough-" + (index + 1) : "walkthrough", CUBE,
    "Giải mẫu 3×3 · Lượt " + (index + 1), "Tự giải một trạng thái mới và nhìn lại từng điểm kiểm tra.", guide, {
    prerequisite: "twist-corners",
    mistake: "Tiếp tục dù một tầng đã giải bị thay đổi. Hãy quay lại điểm kiểm tra gần nhất và tìm viên đi sai.",
    exercise: { goal: "Giải trạng thái xáo mẫu rồi kiểm tra sáu mặt.", setup, algorithm },
    sources: [source(video.label, video.source), ...mainSources],
    video
  });
});

const ADVANCED = [
  tutorial("cfop-cross", CUBE, "CFOP · Lập kế hoạch dấu cộng", "Tự dự đoán vị trí bốn cạnh và giải dấu cộng ở mặt dưới.", [
    example("Từ cách theo tầng đến CFOP", "Vẫn làm dấu cộng trắng ở D. Sau đó ghép từng cặp góc–cạnh (F2L) để giải hai tầng cùng lúc. Đến mặt vàng, làm OLL để đổi hướng và PLL để đổi vị trí. Tập 2-look OLL và 2-look PLL trước khi học trọn các nhóm."),
    example("Đọc bốn cạnh trước khi xoay", "Tìm cả bốn cạnh trắng và theo dõi thứ tự màu bên quanh tâm. Trong mẫu, cạnh trước và phải đang ở U và đã khớp tâm; lên kế hoạch R2 F2 rồi thực hiện liên tục.", "x2 F2 R2", "R2 F2"),
    example("Căn đáy giữa một nhóm nước", "Trong thế này cần xoay D2 để trả hai cạnh trắng đã xuống về đúng tâm bên. Sau đó giải hai cạnh còn ở U bằng B2 và R2. Nhìn màu bên ở hàng dưới để xác nhận cả bốn cạnh.", "x2 R2 B2 D2", "D2 B2 R2")
  ], {
    level: NEXT, prerequisite: "white-cross", sources: cfopSources,
    exercise: { goal: "Căn đáy, sau đó hoàn thành hai cạnh trắng còn thiếu.", setup: "x2 R2 B2 D2", algorithm: "D2 B2 R2" },
    mistake: "Dừng sau mỗi cạnh để tìm lại vị trí của các cạnh vừa di chuyển.",
    video: youtube("IWXpkfwimo0", "J Perm · Luyện dấu cộng", 0, undefined, "Theo dõi quan hệ giữa bốn cạnh trước khi lập kế hoạch.")
  }),
  tutorial("cfop-f2l", CUBE, "CFOP · Ghép cặp F2L", "Tìm đúng cạnh và góc, ghép chúng thành một cặp rồi đưa vào khe.", [
    example("Tìm đúng cặp và khe đích", "Giữ dấu cộng trắng ở D. Chọn góc có trắng và tìm cạnh mang hai màu bên của góc đó. Hai màu bên cũng cho biết khe đích. Khi cả hai viên nằm trên, dùng U và một khe còn trống để ghép chúng."),
    example("Chèn cặp trước–phải", "Căn U để đưa cặp tới vị trí chèn. Mở khe bằng R, đưa cặp qua khe bằng U' rồi đóng khe bằng R'. Kiểm tra cả góc dưới lẫn cạnh giữa đã khớp hai tâm bên.", "x2 R U R' U'", "U R U' R'"),
    example("Ghép hai viên đang tách rời", "Theo dõi góc trắng và cạnh đích riêng rẽ cho đến khi chúng nằm cạnh nhau. Tua sau từng nước để thấy nhóm U' R U R' đổi vị trí tương đối. Nhóm U2 R U' R' đưa cặp qua khe trước–phải.", whiteDown + " " + reverseSequence(f2lSeparated), f2lSeparated),
    example("Giữ dấu cộng khi tìm cặp kế tiếp", "Mỗi lần ghép xong, kiểm tra hai ô của khe và bốn cạnh dấu cộng. Giảm tốc ở cặp đang chèn để quan sát cặp sau. Nếu cần đổi mặt trước, dùng y để giữ tâm trắng ở đáy.")
  ], {
    level: NEXT, prerequisite: "white-corners", sources: [source("J Perm · F2L", "https://jperm.net/3x3/cfop/f2l"), ...cfopSources],
    caseGroups: ["f2l"],
    mistake: "Xoay nhiều mặt để đuổi theo hai viên. Đưa chúng về vùng trên bằng một khe chưa giải.",
    exercise: { goal: "Ghép góc và cạnh đang tách rời, chèn vào khe trước–phải.", setup: whiteDown + " " + reverseSequence(f2lSeparated), algorithm: f2lSeparated },
    video: youtube("aKM5AqKyrX8", "Bullet Cubing · F2L trực quan", 0, undefined, "Quan sát cách ghép cạnh với góc trước khi chèn.")
  }),
  tutorial("cfop-oll", CUBE, "CFOP · Định hướng lớp cuối", "Từ dấu cộng vàng và Sune đến nhận diện toàn bộ OLL.", [
    example("2-look OLL · Làm dấu cộng vàng", "Giữ hai tầng dưới đã giải và chỉ nhìn bốn cạnh lớp U. Đặt đường ngang theo trục trái–phải rồi chạy công thức. Với hình chữ L hoặc chấm, học hướng cầm riêng ở bài dấu cộng vàng.", "x2 F U R U' R' F'", orientEdges),
    example("Nhận diện Sune", "Ở mẫu này cạnh đã hướng đúng và một góc đã có vàng trên mặt. Căn đúng hướng mẫu trước khi chạy công thức.", "x2 R U2 R' U' R U' R'", sune),
    example("Phân biệt Sune và Anti-Sune", "Cả hai đều có một góc vàng hướng lên. Nhìn thêm màu vàng ở mặt bên sau khi căn đúng hình. Chọn công thức theo vị trí góc và dải bên. Ví dụ này dùng Anti-Sune đảo chiều tác dụng của Sune.", whiteDown + " " + sune, reverseSequence(sune)),
    example("Tiến tới OLL một lượt", "Khi nhận ra ba mẫu cạnh và bảy mẫu góc của 2-look OLL, học tiếp từng nhóm trong 57 mẫu OLL. Đối chiếu mặt trên và ô vàng trên các mặt bên. Từng mẫu phải giữ hai tầng đầu.")
  ], {
    level: NEXT, prerequisite: "cfop-f2l", sources: [source("CubeSkills · OLL", CUBESKILLS + "oll-algorithms"), ...cfopSources],
    caseGroups: ["oll2", "oll"],
    mistake: "Nhận diện chỉ bằng mặt trên ở những ca có cùng hình nhưng khác dải màu bên.",
    exercise: { goal: "Chạy Sune từ đúng hướng và xác nhận cả mặt vàng đồng màu.", setup: "x2 R U2 R' U' R U' R'", algorithm: sune },
    video: youtube("sEhKsFCmRU4", "Bullet Cubing · 2-look OLL", 0, undefined, "Nhận diện mẫu cạnh và mẫu góc ở hai lượt riêng.")
  }),
  tutorial("cfop-pll", CUBE, "CFOP · Hoán vị lớp cuối", "Nhận diện dải góc và cạnh, thực hiện PLL và căn lớp trên.", [
    example("Nhìn các dải ở bên", "Sau OLL, nhìn qua ít nhất hai mặt bên. Cặp ô góc cùng màu trên một mặt giúp nhận diện nhóm. Kiểm tra cả ô giữa hai góc để phân biệt cạnh đã đúng."),
    example("T-perm", "Mô hình cho ví dụ một cặp góc và một cặp cạnh đổi chỗ. Giữ đúng hướng trước khi chạy chuỗi; căn U sau công thức nếu cần.", "x2 F R U' R' U R U R2 F' R U R U' R'", tperm),
    example("2-look PLL · Làm góc trước rồi đến cạnh", "Dùng nhóm đổi góc ở lượt đầu. Khi bốn góc đã đúng vị trí, xem hướng đổi vòng của ba cạnh. Trong mẫu Ua, giữ một cạnh đúng theo hướng trước khi thực hiện chuỗi.", "x2 R2 U R U R' U' R' U' R' U R'", "R U' R U R U R U' R' U' R2"),
    example("Căn U sau công thức", "Khi lớp vàng đã đồng màu và mỗi hàng trên ở mặt bên đồng màu, thử U, U' hoặc U2 để các hàng thẳng màu tâm. Mẫu này cần U'. Luyện chắc 2-look PLL rồi học các nhóm trong bộ 21 PLL.", "x2 U", "U'")
  ], {
    level: NEXT, prerequisite: "cfop-oll", sources: [source("CubeSkills · PLL", CUBESKILLS + "pll-algorithms"), ...cfopSources],
    caseGroups: ["pll2", "pll"],
    mistake: "Thực hiện đúng công thức nhưng cầm sai mặt trước hoặc bỏ qua bước căn U.",
    exercise: { goal: "Đọc vị trí các góc và cạnh của mẫu T rồi hoàn thành PLL.", setup: whiteDown + " " + reverseSequence(tperm), algorithm: tperm },
    video: youtube("J8p6JVLyGHo", "Bullet Cubing · 2-look PLL", 0, undefined, "Nhìn dấu hiệu bên ngoài trước khi chọn phép đổi góc hoặc cạnh.")
  }),
  tutorial("roux", CUBE, "Roux · Hai khối bên và sáu cạnh", "Hiểu trật tự khối trái, khối phải, CMLL và LSE.", [
    example("Khối 1×2×3 bên trái", "Lấy trắng dưới làm mốc. Dùng tâm trái, cạnh dưới–trái và hai cặp góc–cạnh để tạo khối. Trong mẫu còn thiếu một cặp, xoay L rồi đặt lại để nối cặp vào khối.", "x2 L' U' L U", "U' L' U L"),
    example("Khối bên phải", "Giữ khối trái và tận dụng U, R, Rw hoặc M để dựng khối phải. Mẫu này luyện một cặp của khối phải. Sau khi chèn, kiểm tra hai dải bên liền mạch. Hai khe trước và sau của đáy vẫn có thể dành cho lớp giữa.", "x2 R U' R'", "R U R'"),
    example("CMLL · Giải cả hướng và vị trí góc", "Khi hai khối bên đã xong, đọc bốn góc lớp U và chọn ca CMLL. Mẫu này có bốn góc giải được bằng Sune. Hãy xem lại sáu cạnh còn lại sau bước CMLL.", whiteDown + " " + reverseSequence(rouxLastEdges) + " " + reverseSequence(sune), sune),
    example("LSE · Dùng M và U cho sáu cạnh", "Giữ hai khối và bốn góc đã giải. LSE thường chia thành định hướng sáu cạnh, đặt hai cạnh UL/UR, rồi sắp bốn cạnh còn lại. Nước M có thể tạm di chuyển tâm trắng. Trong mẫu ngắn, quan sát bốn góc sau khi hoàn thành cả nhóm.", whiteDown + " " + reverseSequence(rouxLastEdges), rouxLastEdges)
  ], {
    level: EXPERT, prerequisite: "cfop-f2l", sources: [rouxTutorial],
    caseGroups: ["cmll"],
    exercise: { goal: "Giải thế sáu cạnh mẫu bằng M và U, giữ hai khối bên.", setup: whiteDown + " " + reverseSequence(rouxLastEdges), algorithm: rouxLastEdges },
    mistake: "Cố ghép dấu cộng đáy như CFOP ngay từ đầu, hạn chế các nước lớp giữa hữu ích.",
    video: youtube("pj_IsOCJS3k", "Kian Mansour · Khối đầu tiên", 0, undefined, "Ghép một khối nhỏ rồi nối cạnh–góc còn lại để hoàn thành khối bên.")
  }),
  tutorial("zz", CUBE, "ZZ · Định hướng cạnh từ đầu", "Hiểu cách định hướng cạnh trước khi xây hai khối F2L.", [
    example("Chọn hệ quy chiếu cố định", "Giữ trắng dưới, vàng trên và giữ một mặt trước cố định. Cạnh đúng hướng khi có thể đưa về ô đích bằng U, D, R, L với góc cầm đó. Bốn mặt này giữ hướng cạnh; một nước 90° ở F hoặc B đổi hướng bốn cạnh trên mặt vừa xoay.", "x2 F", "F'"),
    example("EOLine · Hai cạnh đúng ở đáy", "Đưa cạnh lệch về F hoặc B để sửa hướng. Khi đủ 12 cạnh đã đúng hướng, đặt DF và DB tạo đường trước–sau dưới đáy. Trong mẫu, F' sửa bốn cạnh và trả DF về cạnh DB đã đúng.", "x2 R2 L2 F", "F'"),
    example("EOCross · Bốn cạnh đúng ở đáy", "Nếu theo biến thể EOCross, hoàn thành cả bốn cạnh của dấu cộng trắng sau khi bảo đảm hướng cạnh. Từ thế EOLine mẫu, L2 và R2 đưa hai cạnh bên về đáy và giữ hướng của cả 12 cạnh.", "x2 R2 L2", "L2 R2"),
    example("Ghép hai khối sau EO", "Giữ DF và DB ở đáy. Dùng U, R và L để giải hai bên và giữ hướng cạnh. Tua thử nửa đầu để quan sát bên trái rồi nửa sau để quan sát bên phải. Khi hai tầng dưới hoàn thành, mặt vàng đã có dấu cộng; tiếp tục định hướng góc rồi làm PLL.", whiteDown + " " + reverseSequence(zzBlocks), zzBlocks)
  ], {
    level: EXPERT, prerequisite: "cfop-f2l", sources: [source("Conrad Rider · ZZ", "https://cube.crider.co.uk/zz.php")],
    exercise: { goal: "Sửa bốn cạnh lệch để trả lại đường DF–DB ở đáy.", setup: "x2 R2 L2 F", algorithm: "F'" },
    mistake: "Đổi mặt trước giữa lúc phân loại cạnh. Giữ khối cố định trong cả bước EO.",
    video: { ...youtube("4Wrm2MGrRS8", "Joseph Hale · Học ZZ", 44), chapters: [
      { label: "EO và đường đáy", time: 44, caption: "Định hướng cạnh và giữ một mặt trước cố định." },
      { label: "Hai khối F2L", time: 384, caption: "Dùng các mặt trái, phải và trên để dựng khối." },
      { label: "Định hướng lớp cuối", time: 639, caption: "Các cạnh đã được định hướng từ bước đầu." },
      { label: "Hoán vị lớp cuối", time: 695, caption: "Đọc màu bên và sắp góc, cạnh." }
    ] }
  }),
  tutorial("finger-tricks", CUBE, "Kỹ thuật ngón tay và giải một tay", "Tập các nhóm nước ngắn với thế cầm ổn định.", [
    example("Đẩy U bằng ngón trỏ", "Đỡ đáy bằng các ngón còn lại. Dùng ngón trỏ đẩy lớp trên, giữ hai lớp bên dưới đứng yên và tập ở tốc độ vừa phải.", whiteDown, "U U' U2"),
    example("Giảm đổi thế cầm", "Tập R U R' U' thành một nhịp, chỉ tăng tốc khi mỗi nước đều dừng đúng vị trí. Khi giải một tay, dùng ngón trỏ hoặc ngón út theo thế cầm thoải mái.", whiteDown, turn),
    example("Theo dõi trong lúc xoay", "Đặt mục tiêu hạn chế thời gian dừng. Giảm tốc độ khi chưa nhận ra cặp tiếp theo rồi giữ nhịp đều.")
  ], {
    level: NEXT, prerequisite: "notation", sources: [source("J Perm · Finger tricks", "https://jperm.net/3x3/fingertricks"), source("J Perm · Giải một tay", "https://jperm.net/oh")],
    exercise: { goal: "Thực hiện năm lần nhóm bốn nước ở cùng một thế cầm." },
    mistake: "Tăng tốc khi các lớp chưa vào đúng vị trí, khiến những nước tiếp theo bị kẹt.",
    video: youtube("mUF3aPDTO-4", "J Perm · Xoay và giải một tay", 0, undefined, "Quan sát ngón nào giữ khối và ngón nào thực hiện nước xoay.")
  }),
  tutorial("commutators-bld", CUBE, "Làm quen commutator và giải bịt mắt", "Hiểu tác dụng của A B A' B' và cách nhớ đường đi của viên.", [
    example("Thử một commutator", "Chọn A = R, B = U. Dùng A rồi B, sau đó hoàn tác từng nhóm theo thứ tự A', B'. So sánh viên nào trở về và viên nào còn thay đổi.", whiteDown, turn),
    example("Lập mã ghi nhớ", "Chọn một ô đệm. Nhìn viên đang nằm ở ô đó, tìm ô đích của nó và tiếp tục theo viên ở ô đích. Gắn cùng một chữ cho mỗi vị trí qua mọi lượt."),
    example("Tập dưới sự quan sát", "Vừa nhìn vừa tập một chu trình ngắn. Nói đúng các vị trí theo thứ tự rồi chạy chuỗi đã học. Khi đổi chu trình, xử lý mọi viên còn sai trước khi kiểm tra toàn khối.")
  ], {
    level: EXPERT, prerequisite: "notation", sources: [source("J Perm · Giải bịt mắt", "https://jperm.net/bld")],
    mistake: "Đổi bảng chữ hoặc ô đệm giữa chừng làm mất dấu một chu trình.",
    exercise: { goal: "Theo dõi một chu trình ba viên trong khi vẫn nhìn khối." },
    video: youtube("9KPqwwKNldc", "J Perm · Các chu trình 3-Style", 0, undefined, "Quan sát thao tác chuẩn bị, nhóm nước chính và hoàn tác.")
  })
];


const largerIntro = source("CubeSkills · Giải 4×4 theo Reduction", CUBESKILLS + "beginners-method-for-solving-the-4x4-cube");
const yauSource = source("J Perm · Yau 4×4", "https://jperm.net/4x4");
const largerSources = [source("CubeSkills · Khối lớn 6×6 và 7×7", CUBESKILLS + "big-cube-tutorials"), source("J Perm · 5×5", "https://jperm.net/tutorials/5x5/")];
const twoSource = source("J Perm · 2×2", "https://jperm.net/2x2");
const pyraminxSource = source("Speedcube · Pyraminx từng bước", "https://www.speedcube.com.au/blogs/speedcubing-solutions/how-to-solve-a-pyraminx-easy-to-follow-beginners-steps");
const skewbSource = source("GAN · Hướng dẫn Skewb", "https://www.gancube.com/pages/gancube-tutorials-skewb");
const minxSource = source("CubeSkills · Megaminx cơ bản", CUBESKILLS + "beginner-megaminx-tutorial");

const MORE = [
  tutorial("pocket-basic", "2x2x2", "Giải 2×2 từ bốn góc đầu tiên", "Giải tầng đầu, đặt rồi định hướng bốn góc còn lại.", [
    example("Tầng đầu", "Chọn một góc trắng để làm mốc. Hai góc đứng cạnh nhau phải chung cả màu trắng và màu của cạnh tiếp giáp. Giữ trắng bên dưới, đặt góc cần lắp lên trên khe phải, rồi lặp nhóm bốn nước đến khi góc khớp.", "x2 U R U' R'", turn),
    example("Đặt tầng cuối", "Chọn góc vàng mà hai màu bên trùng với hai màu ở tầng trắng ngay dưới nó. Đặt góc này ở trên–trước–phải, rồi dùng chuỗi đổi ba góc. Khi chưa có góc đúng, căn U rồi kiểm tra lại.", "x2 L' U R U' L U R' U'", placeCorners),
    example("Xoay các góc còn lại", "Với vàng trên, giữ góc cần xoay ở trên–trước–phải và lặp nhóm R' D' R D đến khi nó hướng đúng. Xoay U sang góc kế tiếp, giữ nguyên hướng của cả khối. Căn U khi đã đồng màu.")
  ], {
    mistake: "Dựa riêng vào màu trên để đánh giá góc; ở 2×2 cần so cả hai màu bên với các góc đã giải.",
    exercise: { goal: "Tạo tầng đầu với bốn mặt bên khớp, rồi làm đủ sáu mặt." },
    sources: [twoSource], video: youtube("N_X9zADW4M0", "J Perm · Giải mẫu 2×2", 0, undefined, "Đọc cả ba màu của mỗi viên góc, sau đó theo dõi lượt giải từ đầu đến cuối.")
  }),
  tutorial("pocket-ortega", "2x2x2", "2×2 · Ortega và PBL", "Giải theo ba bước gồm một mặt, OLL và hoán vị cả hai tầng.", [
    example("Một mặt cùng màu", "Chọn màu dễ tạo mặt nhất. Xếp bốn ô cùng màu về một mặt; các dải hai ô ở bên có thể còn khác màu. Đặt mặt đã làm xuống dưới."),
    example("OLL", "Đếm góc có màu đích hướng lên và nhìn các ô phía bên để chọn ca OLL. Chẳng hạn với mẫu Sune, giữ đúng hướng và thực hiện chuỗi dưới đây.", "x2 R U2 R' U' R U' R'", sune),
    example("PBL", "Xem từng tầng có cặp góc cùng màu bên hay không. Nếu có, căn cặp về phía chỉ định của công thức. Nếu thiếu cặp ở một tầng, kiểm tra trường hợp đổi chéo. Chọn công thức PBL theo cả hai tầng rồi căn mặt cuối.")
  ], {
    level: NEXT, prerequisite: "pocket-basic", sources: [source("J Perm · Ortega và các phương pháp 2×2", "https://jperm.net/2x2/faster"), source("J Perm · PBL", "https://jperm.net/algs/2x2/pbl")],
    exercise: { goal: "Tạo một mặt nhanh rồi xác định kiểu hoán vị của cả hai tầng." },
    mistake: "Đọc PBL từ một tầng duy nhất, bỏ sót kiểu hoán vị ở tầng dưới.",
    video: youtube("z2gOUzMmY3w", "J Perm · Hướng dẫn Ortega", 0, undefined, "Quan sát cách tạo một mặt rồi phân loại mẫu hoán vị của cả hai tầng.")
  }),
  tutorial("pocket-eg", "2x2x2", "2×2 · Chọn CLL, EG-1 hoặc EG-2", "Phân loại trạng thái mặt đã tạo để chọn đúng bộ công thức.", [
    example("CLL", "Tạo một tầng hoàn chỉnh ở đáy. Cả bốn dải màu bên của tầng dưới đã khớp. Dùng CLL xử lý hướng và vị trí bốn góc tầng trên cùng lúc."),
    example("EG-1", "Tầng dưới có cùng màu đáy và cần đổi một cặp góc kề nhau. Căn cặp màu bên theo hướng của bộ công thức trước khi nhìn OLL."),
    example("EG-2", "Tầng dưới có cùng màu đáy và cần đổi một cặp góc đối diện. Nhận diện hướng góc trên sau khi đã xác nhận đúng nhóm dưới, rồi áp dụng công thức.")
  ], {
    level: EXPERT, prerequisite: "pocket-ortega", sources: [source("J Perm · Phương pháp 2×2 nâng cao", "https://jperm.net/2x2/faster")],
    exercise: { goal: "Nhìn các dải màu bên phía dưới và gọi đúng nhóm ở ba trạng thái." },
    mistake: "Chọn công thức theo mẫu mặt trên mà chưa kiểm tra kiểu hoán vị tầng dưới.",
    video: youtube("30IF6qW3cNg", "J Perm · Phương pháp EG", 0, undefined, "Đọc tình trạng của tầng dưới trước khi xác định kiểu góc tầng trên.")
  }),
  tutorial("4x4-reduction", "4x4x4", "4×4 · Ghép tâm và cạnh theo Reduction", "Ghép sáu tâm 2×2 và mười hai cặp cạnh để dùng cách giải 3×3.", [
    example("Xác định màu tâm", "Tâm 4×4 di chuyển được. Dùng ba màu của một góc để biết thứ tự các mặt kề. Ghép hai thanh 1×2 cùng màu rồi nối thành ô tâm 2×2."),
    example("Ghép và cất cạnh", "Tìm hai mảnh cạnh có cùng bộ màu, đặt vào hai lớp khác nhau gần phía trước. Xoay lớp trong để chúng liền nhau, chuyển cặp đã ghép ra vùng làm việc và trả lớp trong để phục hồi tâm."),
    example("Thu gọn về 3×3", "Sau khi có đủ mười hai cạnh cặp, chỉ xoay lớp ngoài. Coi bốn ô tâm là một tâm và một cặp cạnh là một viên, rồi giải theo lộ trình 3×3. Xem bài parity nếu kết quả tầng cuối có kiểu lật hoặc đổi chỗ đặc trưng của khối chẵn.")
  ], {
    prerequisite: "twist-corners", sources: [largerIntro, yauSource],
    exercise: { goal: "Ghép hai mảnh cạnh có cùng màu và trả lớp trong để tâm về nguyên dạng." },
    mistake: "Ghép đủ sáu tâm nhưng sai thứ tự quanh khối. Hãy so với ba mặt của một viên góc.",
    video: youtube("1M9DE1WyzO4", "J Perm · Giải mẫu 4×4", 0, undefined, "Video minh họa Yau. Dừng để xem riêng kỹ thuật ghép tâm và ghép cạnh dùng chung.")
  }),
  tutorial("4x4-yau", "4x4x4", "4×4 · Yau theo từng giai đoạn", "Giữ ba cạnh của dấu cộng trong quá trình làm các tâm còn lại.", [
    example("Hai tâm đối diện", "Ghép tâm màu nền và tâm đối diện trước. Để hai tâm đã giải ở hai bên trong lúc ghép ba cạnh của dấu cộng."),
    example("Ba cạnh và bốn tâm còn lại", "Cất ba cạnh đã ghép ngay theo thứ tự của màu bên. Chừa trống vị trí dấu cộng cuối để thao tác. Ghép bốn tâm còn lại mà vẫn giữ ba cạnh đã cất."),
    example("Đóng dấu cộng", "Đặt dấu cộng ở dưới, chừa vị trí còn thiếu phía trước. Ghép cạnh thứ tư rồi hoàn thiện các cạnh còn lại. Chuyển sang giải theo các lớp ngoài.")
  ], {
    level: NEXT, prerequisite: "4x4-reduction", sources: [yauSource],
    exercise: { goal: "Hoàn thành hai tâm đối diện và đúng ba cạnh dấu cộng trước khi ghép các tâm còn lại." },
    mistake: "Ghép cả bốn cạnh dấu cộng quá sớm, mất ô thao tác dùng khi ghép tâm.",
    video: youtube("KWOZHbDdOeo", "J Perm · Yau 4×4", 0, undefined, "Theo dõi thứ tự hai tâm, ba cạnh đầu, bốn tâm còn lại rồi ghép cạnh.")
  }),
  tutorial("4x4-parity", "4x4x4", "4×4 · Nhận diện OLL và PLL parity", "Phân biệt cạnh lật với hai cạnh bị đổi chỗ sau khi ghép cạnh.", [
    example("OLL parity", "Sau khi ghép đủ cạnh, một cạnh kép có thể hướng ngược. Đặt cạnh đó trên–trước để áp dụng công thức OLL parity. Nếu lẫn với OLL thường, kiểm tra riêng hai mảnh của mỗi cạnh và trạng thái tâm."),
    example("PLL parity", "Mặt trên đã định hướng nhưng hoán vị tương đương đổi chỗ đúng hai cạnh kép. Đặt hai cạnh ở vị trí yêu cầu của công thức, thực hiện parity rồi nhận diện PLL mới nếu cần."),
    example("Đọc số lớp", "Rw xoay đồng thời hai lớp bên phải. 2R chỉ lớp thứ hai tính từ bên phải, còn R chỉ lớp ngoài cùng. Đọc đúng ký hiệu trước khi sao chép một công thức.")
  ], {
    level: NEXT, prerequisite: "4x4-reduction", sources: [yauSource, source("CubeSkills · 4×4 cơ bản", CUBESKILLS + "beginners-method-for-solving-the-4x4-cube")],
    exercise: { goal: "So sánh ảnh parity trong thư viện và chọn trường hợp theo dấu hiệu nhận diện." },
    mistake: "Làm đồng thời hai công thức parity dù khối mới chỉ biểu hiện một dạng.",
    video: youtube("KWOZHbDdOeo", "J Perm · PLL parity 4×4", 546, undefined, "Xác định hai cạnh kép cần đổi chỗ rồi nhận diện lại PLL sau công thức.")
  }),
  tutorial("5x5-reduction", "5x5x5", "5×5 · Tâm 3×3, cạnh ba mảnh và cạnh cuối", "Thu gọn 5×5 về các viên tương đương 3×3.", [
    example("Tạo ba thanh tâm", "Dựa vào ô tâm giữa để xác định màu của mặt. Ghép thanh xuyên giữa trước rồi thêm hai thanh ngoài. Dùng một mặt chưa làm làm vùng nối thanh."),
    example("Ghép thành cạnh ba mảnh", "Xác định cạnh giữa và hai cánh cùng bộ màu. Xếp các mảnh theo đúng hướng trước khi nối. Cất cạnh đã ghép rồi khôi phục lớp trong."),
    example("Cạnh cuối", "Khi hết chỗ cất, xử lý hai cạnh cuối cùng theo vị trí các cánh. Nếu chỉ một cạnh còn có cánh đảo hướng, đưa cạnh đó đến trên–trước và đối chiếu trường hợp 5×5 trước khi chạy công thức."),
    example("Giải phần 3×3", "Sau khi cả sáu tâm đồng màu và cả mười hai cạnh đều đủ ba mảnh, giữ nguyên các lớp trong và hoàn thành khối bằng nước lớp ngoài.")
  ], {
    prerequisite: "4x4-reduction", sources: largerSources,
    exercise: { goal: "Ghép một cạnh giữa với hai cánh cùng màu. Kiểm tra ba mảnh đúng thứ tự khi nhìn từ hai mặt." },
    mistake: "Ghép mảnh đúng hai màu nhưng ở sai phía của viên giữa. So hướng cả hai mặt.",
    video: { ...youtube("d1I-jJlVwB4", "J Perm · Giải 5×5", 0, undefined, "Quan sát các thanh tâm và cách giữ mảnh cạnh khi đổi lớp."), chapters: [
      { label: "Khó ở hai tâm cuối", time: 183, caption: "Dùng mặt còn trống để ghép thanh rồi khôi phục phần đã hoàn thành." },
      { label: "Trường hợp cạnh cuối", time: 386, caption: "Đặt cạnh đang sai lên trên–trước trước khi làm công thức." }
    ] }
  }),
  tutorial("6x6-reduction", "6x6x6", "6×6 · Giải tâm và bốn mảnh cạnh", "Giữ đúng sơ đồ tâm trên khối chẵn và phân biệt các lớp trong.", [
    example("Tâm 4×4 theo thanh", "Chọn hai tâm đối diện. Ghép các thanh bốn ô và đặt theo thứ tự để chừa vị trí thao tác. Dùng một góc làm mốc kiểm tra ba màu tâm liền kề khi dựng các tâm còn lại."),
    example("Cạnh theo hai cặp đối xứng", "Mỗi cạnh có bốn mảnh. Tách cặp mảnh gần giữa với cặp xa giữa. Ghép đúng cặp có cùng khoảng cách tới tâm cạnh trước, sau đó nối chúng thành cạnh hoàn chỉnh."),
    example("Phục hồi tâm và xử lý parity", "Cất cạnh đã ghép trước khi trả các lớp trong. Sau khi thu gọn về 3×3, nếu gặp một cạnh kép lật hoặc kiểu hoán vị hai cạnh, sử dụng trường hợp parity được ghi riêng cho 6×6.")
  ], {
    prerequisite: "5x5-reduction", sources: largerSources,
    exercise: { goal: "Từ hai tâm đối diện, dựng thêm một tâm 4×4 và giữ các tâm đã xong." },
    mistake: "Nhầm lớp thứ hai và lớp thứ ba tính từ ngoài, khiến mảnh cùng màu không nằm cùng vị trí đối xứng.",
    video: youtube("SkZ9UadAOvQ", "J Perm · Hướng dẫn 6×6", 0, undefined, "Theo dõi thứ tự ghép tâm, cạnh và xử lý lớp cuối.")
  }),
  tutorial("7x7-reduction", "7x7x7", "7×7 · Giải tâm 5×5 và cạnh năm mảnh", "Thu gọn 7×7 bằng cách giữ mốc tâm và ghép cạnh từ trong ra ngoài.", [
    example("Tâm giữa làm chuẩn", "Nhận màu mặt từ viên tâm giữa. Dựng vùng tâm 3×3 quanh viên đó, sau đó bổ sung hai phía ngoài bằng thanh cùng màu. Dùng các nước thiết lập để giữ thanh đã ghép khi nối thanh mới."),
    example("Cạnh năm mảnh", "Tìm mảnh cạnh giữa, ghép cặp mảnh trong đối xứng quanh nó rồi ghép tiếp cặp mảnh ngoài. Chọn mảnh theo cả hai màu và khoảng cách từ điểm giữa cạnh."),
    example("Cạnh cuối và lớp ngoài", "Nếu còn vài mảnh cạnh sai, xử lý theo đúng lớp chứa mảnh đó và trả lớp trong sau mỗi lần. Kiểm tra từng cạnh nhìn từ hai phía; khi đủ cạnh mới giải như 3×3.")
  ], {
    prerequisite: "5x5-reduction", sources: largerSources,
    exercise: { goal: "Ghép một cụm cạnh giữa ba mảnh rồi thêm hai mảnh ngoài mà không phá cụm đã có." },
    mistake: "Đổi hai mảnh có cùng màu nhưng thuộc hai vòng cạnh khác nhau.",
    video: youtube("Uzqo_L-1BMM", "Thinkable · Hướng dẫn 7×7", 0, undefined, "Dừng sau mỗi cụm tâm hoặc cạnh để đối chiếu cách chọn lớp trong.")
  }),
  tutorial("pyraminx-basic", "pyraminx", "Pyraminx · Đỉnh, mặt đầu và ba cạnh cuối", "Hoàn thành khối tam giác bằng cách xử lý đỉnh, trục và cạnh.", [
    example("Khớp đỉnh và trục", "Xoay đỉnh nhỏ để màu khớp phần trục bên dưới. Chữ thường u, l, r, b chỉ các đỉnh. Chọn màu nền và xoay ba trục quanh mặt muốn tạo đến khi ba ô tâm cùng màu. Giữ mặt này ở dưới.", "u l'", "l u'"),
    example("Chèn cạnh nền sang phải", "Đưa cạnh lên trên khe trước, để hai màu khớp mặt đích. Mẫu dưới đây đưa cạnh xuống bằng nhóm bốn nước phía phải. Giữ đúng hướng cầm trước khi áp dụng.", "L R' L' R", "R' L R L'"),
    example("Chèn cạnh nền sang trái", "Căn cạnh cần chèn ở phía trái. Quan sát phần tầng đầu được phục hồi sau nước thứ tư.", "R' L R L'", "L R' L' R"),
    example("Chuyển vòng ba cạnh trên", "Sau tầng đầu, khớp trục và đỉnh phía trên. Dùng mẫu để xem thứ tự chuyển vòng, chạy tối đa hai lần để sắp cạnh rồi kiểm tra hướng từng cạnh. R/L/U/B là các lượt quanh trục 120°.", "R U' R' U' R U' R'", "R U R' U R U R'"),
    example("Đảo hướng hai cạnh cuối", "Khi cả ba cạnh đã ở đúng vị trí nhưng hai cạnh sai hướng, giữ cặp sai theo mẫu và lật chúng bằng chuỗi dưới đây.", "L' U L U' L R' L' R", "R' L R L' U L' U' L")
  ], {
    sources: [pyraminxSource, source("Speedcubing.org · Pyraminx", "https://speedcubing.org/pages/pyraminx-written-tutorial")],
    exercise: { goal: "Khớp các đỉnh trước rồi hoàn thành một mặt, kiểm tra dải màu bên của ba cạnh." },
    mistake: "Xoay nhầm cả trục khi chỉ cần khớp một đỉnh nhỏ.",
    video: youtube("0IRM4MQgvvA", "Speedcube · Giải Pyraminx cơ bản", 0, undefined, "Nhận biết nước xoay đỉnh nhỏ và nước xoay cả trục.")
  }),
  tutorial("megaminx-basic", "megaminx", "Megaminx · Ngôi sao và các tầng", "Áp dụng cách ghép cạnh–góc trên khối mười hai mặt.", [
    example("Ngôi sao năm cánh", "Đưa năm cạnh cùng màu vào mặt đầu, căn màu phụ của từng cạnh với tâm bên để tạo ngôi sao đúng. Trong mô phỏng, thử căn lại một mặt: mỗi nước quay ngũ giác 72° quanh tâm.", "U", "U'"),
    example("Mở rộng quanh dải giữa", "Chọn một mặt đang có một phần cạnh. Ghép cạnh với góc theo cặp, dùng các nước mở và đóng khe giống F2L. Mẫu dưới dùng một khe đã chuẩn bị để tập chèn đúng cặp.", "R U R' U'", "U R U' R'"),
    example("Ngôi sao lớp cuối", "Dùng một trong các chuỗi định hướng cạnh để đủ năm ô cùng màu quanh tâm trên. Mẫu cho thấy một dạng cần đảo hướng cạnh. Sau khi có ngôi sao, tiếp tục xử lý góc và sắp xếp cạnh theo hướng dẫn lớp cuối.", "F U R U' R' F'", "F R U R' U' F'")
  ], {
    prerequisite: "cfop-f2l", sources: [minxSource, source("CubeSkills · Lớp cuối Megaminx", CUBESKILLS + "intermediate-megaminx-techniques")],
    exercise: { goal: "Dựng ngôi sao đúng màu bên và chèn một cặp góc–cạnh mà giữ ngôi sao." },
    mistake: "Coi cả năm khe như bốn khe của 3×3. Luôn đối chiếu theo các tâm ngũ giác hiện tại.",
    video: youtube("oVRooYDvRqg", "J Perm · Giải Megaminx", 0, undefined, "Theo dõi cách tiếp tục từ kỹ thuật 3×3 sang các khu vực riêng của Megaminx.")
  }),
  tutorial("skewb-basic", "skewb", "Skewb · Góc, tâm và lớp cuối", "Giải một mặt, xử lý bốn góc bên kia rồi hoàn tất vị trí tâm.", [
    example("Cầm trục qua góc", "Để một góc quay về phía mình. Mỗi lượt xoay là 120° quanh một trục đi qua góc. Quan sát các viên đi cùng nhau khi đưa trục phải về vị trí cũ.", "R", "R'"),
    example("Mặt đầu", "Chọn tâm trắng và lắp bốn góc sao cho dải màu bên khớp. Khi dùng nhóm bốn nước, giữ đúng trục rồi kiểm tra sự thay đổi của các góc. Mẫu giúp luyện nhóm thao tác trước khi dùng nó trong lượt giải.", "L R' L' R", "R' L R L'"),
    example("Tâm còn lại", "Sau các góc, đếm số mặt đúng rồi vào bài chu kỳ tâm. Ở ví dụ này, hai lượt Sledgehammer cho thấy màu tâm có thể đổi chỗ trong khi vị trí góc giữ nguyên. Kiểm tra thêm hướng các góc trước khi kết luận chỉ còn tâm.", "L R' L' R L R' L' R", "R' L R L' R' L R L'")
  ], {
    sources: [skewbSource, source("Sarah Strong · Skewb cơ bản", "https://sarah.cubing.net/skewb/my-method")],
    exercise: { goal: "Xếp một mặt đúng cả màu tâm lẫn các dải màu góc ở bên." },
    mistake: "Đem ký hiệu R của 3×3 sang Skewb mà không đổi cách nhận biết trục.",
    video: youtube("rKhzNOIuUmQ", "GAN · Giải Skewb cơ bản", 0, undefined, "Đặt một góc hướng về mình để chọn đúng trục xoay.")
  }),
  tutorial("square1-basic", "square1", "Square-1 · Từ hình biến dạng về hình vuông", "Tách bước phục hồi hình khối khỏi bước sắp xếp các viên.", [
    example("Quy ước (a, b) và lát cắt", "Trong (a, b), a là số nấc 30° của tầng trên và b là của tầng dưới; dấu âm đổi chiều. Dấu / xoay lát cắt 180° khi hai khe thẳng hàng. Mẫu quay tầng trên ba nấc rồi cắt.", "", "(3,0) /"),
    example("Khôi phục dạng khối vuông", "Quan sát góc rộng hai nấc và cạnh rộng một nấc. Gom nhóm góc, xoay hai tầng để đưa khe về cùng vạch rồi cắt. Ví dụ đi ngược lượt cắt vừa làm bằng / rồi căn lại tầng trên.", "(3,0) /", "/ (-3,0)"),
    example("Vị trí và parity", "Khi hình vuông đã trở lại, định hướng và sắp góc trước, sau đó sắp cạnh. Nếu còn một cặp cạnh đổi chỗ, tra trường hợp parity Square-1 và làm lại bước căn cuối.")
  ], {
    sources: [source("Cube Master · Giải Square-1", "https://www.youtube.com/watch?v=IkmlMEHYyzI")],
    exercise: { goal: "Chỉ ra khe cắt của cả hai tầng và thực hiện một lần cắt hợp lệ." },
    mistake: "Cố xoay lát cắt khi khe chưa trùng nhau hoặc cố sắp màu trước khi khôi phục hình khối.",
    video: youtube("IkmlMEHYyzI", "Cube Master · Giải Square-1", 0, undefined, "Quan sát các khe thẳng hàng trước mỗi lượt cắt.")
  }),
  tutorial("mirror-basic", "mirror", "Mirror Cube · Giải theo kích thước", "Dùng quy trình 3×3 để đưa các viên có kích thước khác nhau về đúng vị trí.", [
    example("Tìm mặt tham chiếu", "Chọn một mặt có tâm cao hoặc thấp dễ nhận thấy. Dùng chiều cao và bề rộng của cạnh để tìm bốn viên ngang bằng với tâm. Thử căn cạnh trước trong mô phỏng.", "F2", "F2"),
    example("Lắp cạnh và góc", "Hai mặt của một cạnh phải phẳng với hai tâm liền kề. Góc cần khớp đủ ba kích thước. Đưa góc qua khe và quan sát mặt phẳng được khôi phục.", "x2 U R U' R'", turn),
    example("Lớp cuối theo hình dáng", "Nhận dấu cộng và góc đã định hướng bằng các bề mặt ngang bằng. Áp dụng thứ tự giải 3×3, rồi soi mặt bên để kiểm tra cả khối trở lại dạng lập phương.", "x2 " + edgeLine, orientEdges)
  ], {
    prerequisite: "twist-corners", sources: [source("Bullet Cubing · Mirror Blocks", "https://www.bulletcubing.com/video-courses")], caseGroups: ["mirror-foundation"],
    exercise: { goal: "Tìm đúng một cạnh, lắp và kiểm tra hai bề mặt phẳng với hai tâm." },
    mistake: "Chọn viên chỉ theo một chiều cao. Kiểm tra kích thước của cả hai mặt cạnh hoặc ba mặt góc.",
    video: youtube("REs39blP02U", "Bullet Cubing · Giải Mirror Blocks", 0, undefined, "Quan sát cách dùng độ cao và độ rộng thay cho màu.")
  }),
  tutorial("clock-basic", "clock", "Clock · Đưa các kim về 12 giờ", "Điều khiển các nhóm đồng hồ bằng nút và bánh xoay ở hai mặt.", [
    example("Thử tác dụng của một nút", "Clock có chín mặt đồng hồ ở mỗi bên và bốn nút. UR chỉ nhóm trên–phải. Mẫu đã xoay nhóm đó ba nấc theo chiều dương; thử xoay bù ba nấc để nhận ra những kim chuyển động cùng nhau.", "UR3+", "UR3-"),
    example("Dấu cộng mặt trước", "Ghép hướng của bốn kim quanh tâm với kim giữa, dùng các nhóm nối với nhau theo thứ tự trong video. Khi cả năm kim cùng chỉ một giờ, đưa chúng về 12 giờ."),
    example("Đổi mặt và hoàn thành góc", "Lật qua mặt sau theo hướng đã quy ước, giữ lại mốc mặt trước. Dùng y2 để đổi mặt trong mô phỏng. Khi giải thật, hoàn thành nhóm giữa, dùng các nhóm thích hợp cho góc và kiểm tra đủ mười tám vị trí.", "UR3+ y2", "y2 UR3-")
  ], {
    sources: [source("The Duke of Cubes · Clock", "https://www.youtube.com/watch?v=n5We_sCjBOc")],
    exercise: { goal: "Đổi vị trí một nút, dự đoán nhóm kim di chuyển và kiểm tra khi xoay một nấc." },
    mistake: "Đọc vị trí nút hoặc hướng quay trước khi lật khối rồi áp dụng trực tiếp cho mặt đối diện.",
    video: { ...youtube("n5We_sCjBOc", "The Duke of Cubes · Giải Clock", 60, undefined, "Ghép dấu cộng mặt trước rồi lật qua mặt sau theo cùng hướng."), chapters: [
      { label: "Dấu cộng trước", time: 60, caption: "Đưa năm kim ở giữa về cùng hướng." },
      { label: "Lật khối", time: 155, caption: "Đổi mặt để đọc nhóm đồng hồ phía sau." },
      { label: "Dấu cộng sau", time: 192, caption: "Hoàn thành nhóm giữa của mặt sau." },
      { label: "Bốn góc", time: 260, caption: "Chọn nhóm nút và đưa các kim góc về 12 giờ." }
    ] }
  })
];

const notationSource = source("WCA · Quy ước ký hiệu", "https://www.worldcubeassociation.org/regulations/#article-12-notation");
const minxLast = CUBESKILLS + "intermediate-megaminx-techniques";
const pyLast = source("Speedcubing.org · Các cạnh cuối", "https://speedcubing.org/pages/pyraminx-written-tutorial");
const skewbMethod = source("Sarah Strong · Xếp tâm Skewb", "https://sarah.cubing.net/skewb/my-method");
const squareEdges = source("Sarah Strong · Hoán vị cạnh Square-1", "https://sarah.cubing.net/square-1/ep");
const clockSource = source("The Duke of Cubes · Giải Clock", "https://www.youtube.com/watch?v=n5We_sCjBOc");
const mirrorSource = source("Bullet Cubing · Mirror Blocks", "https://www.bulletcubing.com/video-courses");
const wingFlip = "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2";
const wingFlipSetup = "2R2 B2 2L F2 2R' F2 U2 2R' U2 2R U2 2L' U2 B2 2R2";
const deeperWingFlip = wingFlip.replaceAll("2R", "3R").replaceAll("2L", "3L");
const deeperWingSetup = wingFlipSetup.replaceAll("2R", "3R").replaceAll("2L", "3L");
const pyrCycleA = "R U R' U R U R'";
const pyrCycleB = "R U' R' U' R U' R'";
const pyrFlip = "R' L R L' U L' U' L";
const pyrFlipSetup = "L' U L U' L R' L' R";
const sledge = "R' L R L'";
const hedge = "L R' L' R";
const skewbCenters = ["x", sledge, "x' y", sledge, sledge, "y' x'", sledge, "x"].join(" ");
const skewbCenterSetup = ["x'", hedge, "x y", hedge, hedge, "y' x", hedge, "x'"].join(" ");
const squareCycle = "/ (0,3) / (1,0) / (-3,0) / (-1,0) / (0,-3) / (1,0) / (3,0) / (-1,0)";
const squareCycleSetup = "(1,0) / (-3,0) / (-1,0) / (0,3) / (1,0) / (3,0) / (-1,0) / (0,-3) /";
const squareParity = "/ (3,3) / (-1,0) / (2,0) / (-4,0) / (4,0) / (2,0) / (1,0) / (-3,-3) /";
const squareParitySetup = "/ (3,3) / (-1,0) / (-2,0) / (-4,0) / (4,0) / (-2,0) / (1,0) / (-3,-3) /";

const WORKSHOPS = [
  tutorial("4x4-inner-turns", "4x4x4", "4×4 · Đọc lớp ngoài và lớp trong", "Phân biệt nước R, 2R và Rw trước khi ghép tâm hoặc xử lý parity.", [
    example("So sánh hai dải", "Nhìn mặt trước. Sau 2R chỉ dải thứ hai từ phải đổi màu; sau Rw cả dải ngoài cùng và dải kế bên đổi màu. Các bài trên trang dùng 2R cho đúng một lớp trong, còn Rw theo quy ước xoay rộng.", "2R", "2R'", {
      comparison: [
        { label: "2R · một lớp trong", setup: "2R" },
        { label: "Rw · hai lớp liền nhau", setup: "Rw" }
      ],
      quiz: {
        prompt: "Muốn chỉ trả lớp thứ hai tính từ bên phải, nên xoay nước nào?",
        options: ["R'", "Rw'", "2R'"], answer: 2, feedback: "Đếm từ mặt phải vào. 2R' chỉ trả đúng một lớp; Rw' quay cả hai lớp liền nhau."
      }
    }),
    example("Tách một nước xoay rộng", "Xoay R và 2R theo cùng chiều tương đương một lượt Rw. Hai lớp không chạm nhau nên đổi thứ tự vẫn được. Thử gỡ nước xoay rộng bằng hai lượt trả.", "Rw", "R' 2R'")
  ], {
    prerequisite: "4x4-reduction", sources: [notationSource, yauSource], caseGroups: ["parity4"],
    mistake: "Đọc 2R như R2. Số đứng trước chỉ vị trí lớp. Số đứng sau chỉ xoay 180°.",
    exercise: { goal: "Trả khối bị lệch hai dải về dạng đã giải bằng R' và 2R'.", setup: "Rw", algorithm: "R' 2R'" }
  }),
  tutorial("4x4-reduction-check", "4x4x4", "4×4 · Tâm đúng, cạnh đã ghép chưa?", "Kiểm tra từng điều kiện thu gọn trước khi giải như 3×3.", [
    example("Hai phép kiểm tra riêng", "Tâm mỗi mặt cần tạo ô 2×2 đồng màu và theo đúng thứ tự quanh một góc chuẩn. Sau đó nhìn hai mặt của từng cặp cạnh. Mẫu này có đủ tâm nhưng hai mảnh của cạnh trên–trước bị lật. Theo dõi dải đang đổi hướng, rồi xác nhận ô tâm trở lại nguyên vẹn.", wingFlipSetup, wingFlip),
    example("Hoán vị sau khi đã định hướng", "Khi mặt trên có cùng màu với tâm nhưng hai cạnh ghép đối diện lệch vị trí, xác định mẫu khác với một cạnh bị lật. Chạy chuỗi rồi đối chiếu màu bên trên cả hai cạnh.", "U2 Uw2 2R2 Uw2 2R2 U2 2R2", "2R2 U2 2R2 Uw2 2R2 Uw2 U2", {
      quiz: { prompt: "Chỉ quan sát mặt trên đã đủ để xác nhận PLL parity chưa?", options: ["Đủ, nếu mặt trên đồng màu", "Cần xem vị trí cạnh và màu các mặt bên"], answer: 1, feedback: "PLL parity là vấn đề vị trí. Màu bên mới chỉ ra cặp cạnh cần đổi chỗ." }
    })
  ], {
    level: NEXT, prerequisite: "4x4-inner-turns", sources: [largerIntro, yauSource], caseGroups: ["parity4"],
    mistake: "Bắt đầu giải theo 3×3 khi một cạnh chưa ghép đủ hai mảnh. Hãy kiểm tra theo vòng quanh khối.",
    exercise: { goal: "Thử khôi phục cạnh trên–trước theo mẫu một cạnh bị lật.", setup: wingFlipSetup, algorithm: wingFlip }
  }),
  tutorial("5x5-last-edge", "5x5x5", "5×5 · Cánh cạnh cuối bị đảo", "Đọc cạnh ba mảnh và giữ mảnh giữa khi sửa hai cánh của mẫu.", [
    example("Đọc hai mặt của cạnh", "Tìm cạnh trên–trước. Mảnh giữa đã khớp tâm, còn hai cánh hiện hai màu đổi phía. Quan sát từ trên và trước để khỏi nhầm một cánh bị lệch với cả cụm cạnh chưa ghép.", wingFlipSetup, wingFlip, {
      quiz: { prompt: "Ở ví dụ này, mảnh nào làm mốc khi tìm hai cánh?", options: ["Góc gần nhất", "Mảnh giữa cạnh", "Tâm của mặt đáy"], answer: 1, feedback: "Mảnh giữa cho biết bộ hai màu của cạnh và vị trí hai cánh ở hai bên." }
    }),
    example("Kiểm tra khi kết thúc", "Sau chuỗi, ba ô trên cạnh cùng khớp mỗi mặt liền kề. Chỉ rời bước ghép cạnh khi cả sáu tâm và mười hai cạnh đều đúng. Sau đó dùng nước lớp ngoài như khi giải 3×3.")
  ], {
    level: NEXT, prerequisite: "5x5-reduction", sources: largerSources, caseGroups: ["wings-5"],
    mistake: "Chạy công thức khi cạnh giữa nằm sai vị trí. Căn mảnh giữa đúng trước rồi so hai cánh theo mẫu.",
    exercise: { goal: "Sửa đúng hai cánh trên–trước. Giữ mảnh giữa khớp như ban đầu.", setup: wingFlipSetup, algorithm: wingFlip }
  }),
  tutorial("6x6-edge-orbits", "6x6x6", "6×6 · So hai vị trí cánh cạnh", "Chọn lớp thứ hai hoặc thứ ba theo hai mảnh lệch của cạnh bốn mảnh.", [
    example("Cặp xa giữa", "Đặt cạnh cần sửa ở trên–trước. Ở mẫu thứ nhất, hai mảnh sát góc bị đảo và hai mảnh gần giữa đã đúng. Đọc vị trí lớp từ mặt ngoài rồi thử công thức dành cho cặp này.", wingFlipSetup, wingFlip, {
      comparison: [{ label: "Hai mảnh sát góc · lớp thứ hai", setup: wingFlipSetup }, { label: "Hai mảnh gần giữa · lớp thứ ba", setup: deeperWingSetup }]
    }),
    example("Cặp gần giữa", "Mẫu thứ hai đổi cặp mảnh gần giữa. Công thức có cấu trúc tương tự nhưng thay nước lớp 2R/2L bằng 3R/3L. Đối chiếu dải cạnh sau khi sửa.", deeperWingSetup, deeperWingFlip, {
      quiz: { prompt: "Cặp mảnh gần giữa thuộc ví dụ nào?", options: ["Lớp thứ hai", "Lớp thứ ba"], answer: 1, feedback: "Đếm từ trái hoặc phải của cạnh. Hai mảnh trong cùng của cạnh 6×6 thuộc hai lớp thứ ba đối diện nhau." }
    })
  ], {
    level: NEXT, prerequisite: "6x6-reduction", sources: largerSources, caseGroups: ["wings-6"],
    mistake: "Chọn lớp theo màu thay vì vị trí của mảnh. Hai cặp có cùng bộ màu nhưng nằm ở khoảng cách khác nhau tới góc.",
    exercise: { goal: "Sửa cặp gần giữa ở cạnh trên–trước. Kiểm tra cả cặp ngoài sau khi kết thúc.", setup: deeperWingSetup, algorithm: deeperWingFlip }
  }),
  tutorial("7x7-edge-orbits", "7x7x7", "7×7 · Sửa cánh ngoài và cánh trong", "Tách năm mảnh cạnh thành mảnh giữa, hai cánh trong và hai cánh ngoài.", [
    example("Tách ba vị trí", "Nhìn dọc cạnh trên–trước. Mảnh chính giữa là mốc của cạnh. Hai mảnh sát mốc là cánh trong, hai mảnh giáp góc là cánh ngoài. Hãy so cả mặt trước và mặt trên trước khi chọn lớp.", deeperWingSetup, deeperWingFlip, {
      comparison: [{ label: "Đảo hai cánh ngoài", setup: wingFlipSetup }, { label: "Đảo hai cánh trong", setup: deeperWingSetup }]
    }),
    example("Khôi phục cánh ngoài", "Mẫu này cần nước lớp thứ hai. Mảnh chính giữa và hai cánh trong đã khớp. Chạy từng nước, sau đó kiểm tra cả năm mảnh từ hai mặt.", wingFlipSetup, wingFlip, {
      quiz: { prompt: "Khi đọc vị trí cánh trên cạnh 7×7, nên lấy viên nào làm mốc?", options: ["Một trong hai góc", "Mảnh chính giữa cạnh", "Cánh có màu sáng hơn"], answer: 1, feedback: "Mảnh chính giữa chia hai phía đối xứng. Từ đó phân được cánh trong và cánh ngoài." }
    })
  ], {
    level: NEXT, prerequisite: "7x7-reduction", sources: largerSources, caseGroups: ["wings-7"],
    mistake: "Nối cả hai cặp cánh vào nhầm thứ tự. Mỗi cánh phải đúng bộ màu và đúng khoảng cách tới mảnh giữa.",
    exercise: { goal: "Khôi phục cả năm mảnh trên–trước trong mẫu đảo cánh ngoài.", setup: wingFlipSetup, algorithm: wingFlip }
  }),
  tutorial("pyraminx-edge-cycles", "pyraminx", "Pyraminx · Hai chiều đổi vòng ba cạnh", "Đọc màu bên của ba cạnh cuối để chọn đúng chiều chu kỳ.", [
    example("Nhận ba cạnh cần đổi chỗ", "Giữ mặt đã giải ở đáy. Các đỉnh và trục đã đúng, còn ba cạnh quanh đỉnh trên ở sai vị trí. Theo dõi một cạnh có hai màu dễ nhận rồi dự đoán vị trí đúng của nó.", pyrCycleB, pyrCycleA, {
      comparison: [{ label: "Chu kỳ ba cạnh · chiều A", setup: pyrCycleB, caseId: "py-cycle-a" }, { label: "Chu kỳ ba cạnh · chiều B", setup: pyrCycleA, caseId: "py-cycle-b" }]
    }),
    example("Đảo chiều chu kỳ", "Hai mẫu có cùng ba vị trí chưa đúng. So thứ tự hai màu của từng cạnh quanh đỉnh rồi dùng mẫu khớp chiều di chuyển. Sau khi chạy, kiểm tra lại cả ba dải màu bên.", pyrCycleA, pyrCycleB, {
      quiz: { prompt: "Hai hình chu kỳ có thể giống nhau nếu chỉ đếm cạnh sai. Cần quan sát gì thêm?", options: ["Thứ tự màu bên của ba cạnh", "Màu của đỉnh nhỏ đã khớp"], answer: 0, feedback: "Hai chiều tác động lên cùng ba vị trí. Thứ tự của từng cạnh mới chỉ ra chiều chuyển." }
    })
  ], {
    level: NEXT, prerequisite: "pyraminx-basic", sources: [pyLast], caseGroups: ["py-basics"],
    mistake: "Chọn chiều theo số cạnh sai. Đánh dấu một cạnh và đọc chính xác nơi hai màu của nó phải đến.",
    exercise: { goal: "Đổi vòng đúng chiều và khôi phục cả ba cạnh quanh đỉnh.", setup: pyrCycleB, algorithm: pyrCycleA }
  }),
  tutorial("pyraminx-edge-flip", "pyraminx", "Pyraminx · Cạnh đúng chỗ nhưng sai hướng", "Nhận ra hai cạnh cần lật và phân biệt với chu kỳ ba cạnh.", [
    example("Kiểm tra đúng chỗ", "Hai cạnh đều nằm cạnh đúng hai tâm nhưng hai màu trên từng cạnh đổi phía. Cạnh còn lại trùng hướng. Xem hình mẫu, giữ đúng hướng rồi theo dõi cách chuỗi đưa màu về mặt tương ứng.", pyrFlipSetup, pyrFlip, {
      comparison: [{ label: "Cạnh đúng chỗ, hai cạnh sai hướng", setup: pyrFlipSetup, caseId: "py-flip" }, { label: "Cạnh sai chỗ, cần đổi vòng", setup: pyrCycleB, caseId: "py-cycle-a" }]
    }),
    example("Đối chiếu kết quả", "Quan sát từng cạnh từ hai mặt tam giác kề nhau. Các đỉnh nhỏ vẫn khớp phần trục. Chỉ chỉnh riêng đỉnh nhỏ nếu còn lệch; chữ thường dùng cho đỉnh.")
  ], {
    level: NEXT, prerequisite: "pyraminx-edge-cycles", sources: [pyLast], caseGroups: ["py-basics"],
    mistake: "Đổi vòng cạnh khi các viên đã nằm đúng vị trí. So bộ hai màu trước rồi mới kiểm tra hướng.",
    exercise: { goal: "Lật đúng hai cạnh, khôi phục màu ở cả hai mặt của mỗi cạnh.", setup: pyrFlipSetup, algorithm: pyrFlip }
  }),
  tutorial("megaminx-4look", "megaminx", "Megaminx · Đọc lớp cuối theo bốn lượt", "Đọc dấu ngôi sao, góc và hoán vị theo thứ tự của lộ trình bốn lượt.", [
    example("Lượt một · hướng cạnh", "Đếm năm cạnh cùng màu tâm trên để đọc hình ngôi sao. Mẫu này có hai cạnh chưa hướng đúng. Giữ vị trí các cạnh đó giống hình rồi theo dõi màu nào chuyển lên mặt trên.", "F U R U' R' F'", "F R U R' U' F'", {
      comparison: [{ label: "Hai cạnh lệch · mẫu A", setup: "F U R U' R' F'", caseId: "minx-eo-1" }, { label: "Hai cạnh lệch · mẫu B", setup: "F R U R' U' F'", caseId: "minx-eo-2" }]
    }),
    example("Lượt hai · hướng góc", "Khi ngôi sao đã đúng, nhìn mặt trên và dải màu của các góc ở năm mặt kề. Ví dụ dưới là một thế tập định hướng góc: các cạnh đã hướng đúng, còn ba góc cần đưa màu về trên.", "R U2 R' U' R U' R'", "R U R' U R U2' R'", {
      comparison: [{ label: "Mẫu góc 5", setup: "R U2 R' U' R U' R'", caseId: "minx-co-5" }, { label: "Mẫu góc 6", setup: "R' U2' R U R' U R", caseId: "minx-co-6" }]
    }),
    example("Lượt ba và bốn · đổi vị trí", "Khi mặt trên đồng màu, so màu bên của từng cạnh với tâm ở dưới. Dùng lượt hoán vị cạnh trước, rồi kiểm tra hai màu bên của từng góc và dùng lượt hoán vị góc. Hai mục tương ứng nằm trong bộ video CubeSkills bên dưới.")
  ], {
    level: NEXT, prerequisite: "megaminx-basic", sources: [source("CubeSkills · Bốn lượt lớp cuối Megaminx", minxLast)], caseGroups: ["minx-eo", "minx-co"],
    mistake: "Coi mặt trên đồng màu là đã giải xong lớp cuối. Kiểm tra màu bên của năm cạnh và năm góc.",
    exercise: { goal: "Thực hành thế ba góc lệch hướng. Kiểm tra ngôi sao vẫn đúng khi kết thúc.", setup: "R U2 R' U' R U' R'", algorithm: "R U R' U R U2' R'" }
  }),
  tutorial("skewb-center-cycle", "skewb", "Skewb · Đổi ba tâm, giữ nguyên góc", "Phân biệt thế chỉ còn ba tâm sai với thế có góc xoắn.", [
    example("Đọc tâm qua bốn góc", "Khi bốn ô góc của mỗi mặt đã cùng màu, chúng cho biết màu của tâm cần đặt. So sáu tâm với bốn góc xung quanh. Trong thế mẫu, ba tâm đổi vòng, toàn bộ góc đúng cả vị trí lẫn hướng.", skewbCenterSetup, skewbCenters, {
      comparison: [{ label: "Ba tâm lệch, các góc đã đúng", setup: skewbCenterSetup }, { label: "Tâm lệch kèm góc xoắn", setup: "L R' L' R L R' L' R", caseId: "skewb-double" }]
    }),
    example("Đọc phần xoay cả khối", "Ký hiệu x và y đổi cách định hướng khối. Giữ một mặt làm mốc khi đổi hướng. Chia công thức thành bốn nhóm tay bốn nước, rồi xem lại sáu tâm và tám góc ở kết quả. Chuỗi mẫu dùng ký hiệu của mô phỏng; nguồn tham khảo có thể chọn tên trục khác."),
    example("Kiểm tra trước khi chạy", "So cả các ô góc của mặt kề. Nếu một góc đã đúng vị trí nhưng vẫn xoắn, xử lý nó trước khi dùng mẫu chỉ đổi tâm.", "", "", {
      quiz: { prompt: "Làm sao biết mẫu này chỉ còn tâm sai?", options: ["So màu bốn góc trên từng mặt", "Nhìn riêng màu tâm trên", "Đếm tổng số mặt lệch"], answer: 0, feedback: "Bốn góc cho biết màu trung tâm cần có. Tất cả góc phải đúng cả vị trí và hướng." }
    })
  ], {
    level: NEXT, prerequisite: "skewb-basic", sources: [skewbMethod, notationSource], caseGroups: ["skewb-basics"],
    mistake: "Bỏ quên x hoặc y ở giữa chuỗi. Những nước đổi hướng này xác định trục cho nhóm xoay kế tiếp.",
    exercise: { goal: "Đưa ba tâm lệch về đúng mặt và vẫn giữ nguyên vị trí, hướng của tám góc.", setup: skewbCenterSetup, algorithm: skewbCenters }
  }),
  tutorial("square1-align-cut", "square1", "Square-1 · Tìm khe trước khi cắt", "Nhìn ra mặt bị chắn và chọn một nấc xoay để mở cả hai khe.", [
    example("Đếm độ rộng", "Nhìn tầng trên và tầng dưới từ cạnh. Góc rộng hai nấc nên có thể nằm vắt qua đường cắt. Trước mỗi dấu /, đường cắt phải đi qua ranh giới giữa hai viên trên cả hai tầng.", "/ (1,0)", "(-1,0) /", {
      comparison: [
        { label: "Tầng trên lệch một nấc dương", setup: "/ (1,0)", caseId: "sq1-cut-right" },
        { label: "Tầng trên lệch một nấc âm", setup: "/ (-1,0)", caseId: "sq1-cut-left" }
      ],
      quiz: { prompt: "Nếu đường cắt còn đi qua giữa một góc ở tầng dưới, cần làm gì?", options: ["Xoay tầng dưới tới khi khe thông", "Cắt ngay khi tầng trên đã thông"], answer: 0, feedback: "Cả tầng trên lẫn tầng dưới cần có khe đúng vị trí mới cắt được." }
    }),
    example("Luyện phía đối diện", "Ở thế lệch âm, xoay tầng trên một nấc dương để đưa khe thẳng hàng. Giữ số thứ hai bằng 0 để nguyên tầng dưới.", "/ (-1,0)", "(1,0) /")
  ], {
    prerequisite: "square1-basic", sources: [notationSource], caseGroups: ["sq1-basics"],
    mistake: "Cố vặn khi còn vướng. Trên khối thật, dừng và căn lại hai tầng để tránh làm hỏng cơ cấu.",
    exercise: { goal: "Từ tầng trên lệch một nấc, tìm nước căn và thực hiện lát cắt hợp lệ.", setup: "/ (1,0)", algorithm: "(-1,0) /" }
  }),
  tutorial("square1-edge-permutation", "square1", "Square-1 · Đổi vị trí cạnh sau khi về hình vuông", "Phân biệt thế đổi vòng ba cạnh và thế cần tra cứu parity.", [
    example("Đổi vòng ba cạnh", "Kiểm tra hình vuông của hai tầng và xác định ba mảnh cạnh ở tầng trên chưa đúng vị trí. Dùng các góc đã đúng làm mốc. Chia chuỗi thành các cặp xoay tầng và lát cắt, đọc từng dấu /.", squareCycleSetup, squareCycle, {
      comparison: [{ label: "Ba cạnh cần đổi vòng", setup: squareCycleSetup, caseId: "sq1-edge-cycle" }, { label: "Thế hoán vị có parity", setup: squareParitySetup, caseId: "sq1-corner-parity" }]
    }),
    example("Không bỏ qua dải giữa", "Trong thế có parity, xem thêm hướng dải giữa và trạng thái góc. Ví dụ thứ hai là một thế riêng đã căn đúng. Sau chuỗi, kiểm tra hình vuông, màu tầng và màu giữa từ các mặt bên.", squareParitySetup, squareParity)
  ], {
    level: EXPERT, prerequisite: "square1-align-cut", sources: [squareEdges, notationSource], caseGroups: ["sq1-basics"],
    mistake: "Chạy chuỗi đổi vòng ba cạnh khi thế thực tế là hoán vị khác. Xác nhận đủ ba cạnh theo hình trước khi chạy.",
    exercise: { goal: "Đổi vòng đúng ba cạnh của mẫu rồi xác nhận hai tầng đã khớp.", setup: squareCycleSetup, algorithm: squareCycle }
  }),
  tutorial("clock-front-groups", "clock", "Clock · Các nhóm kim ở mặt trước", "Dự đoán vùng giao của hai nhóm nút và đọc hướng kim.", [
    example("Theo dõi vùng giao", "Quan sát UR gồm nhóm phía trên–phải và DR gồm nhóm dưới–phải. Sau hai lượt cùng chiều, kim tâm và kim giữa bên phải dịch nhiều hơn các kim ở riêng từng nhóm. Thử đưa từng nhóm về 12 giờ bằng thứ tự ngược.", "UR1+ DR1+", "DR1- UR1-", {
      comparison: [{ label: "Hai nhóm trên–phải và dưới–phải chồng nhau", setup: "UR1+ DR1+" }, { label: "Chỉ tác động một nhóm trên–phải", setup: "UR1-", caseId: "clock-ur" }],
      quiz: { prompt: "Kim ở phần giao của hai nhóm sẽ dịch bao nhiêu nấc nếu mỗi nhóm xoay dương một nấc?", options: ["Không dịch", "Một nấc", "Hai nấc"], answer: 2, feedback: "Kim chung nhận cả hai lượt. So góc trên–phải và kim tâm để thấy khác biệt." }
    }),
    example("Đưa nhóm đã khớp về mốc", "Mẫu này có hai nhóm trên và dưới lệch khác nhau. Đưa từng phần về chung hướng và kiểm tra cả mặt sau, vì một số kim góc cũng bị ảnh hưởng.", "D1+ U2-", "U2+ D1-")
  ], {
    prerequisite: "clock-basic", sources: [clockSource, notationSource], caseGroups: ["clock-basics"],
    video: youtube("n5We_sCjBOc", "The Duke of Cubes · Dấu cộng mặt trước", 60, 155, "Theo dõi cách đọc kim giữa và căn các vùng kề của dấu cộng trước."),
    mistake: "Giả sử các nhóm hoàn toàn độc lập. Kiểm tra những kim ở phần giao sau mỗi lượt.",
    exercise: { goal: "Trả hai nhóm đang chồng nhau về đúng mốc, kiểm tra cả kim tâm.", setup: "UR1+ DR1+", algorithm: "DR1- UR1-" }
  }),
  tutorial("clock-back-groups", "clock", "Clock · Đổi mặt và kiểm tra cả 18 kim", "Nhận ra y2 đổi mặt quan sát và đưa hai mặt về 12 giờ.", [
    example("Xoay cùng nhóm từ mặt sau", "Trong mô phỏng, bấm y2 để thấy mặt đang nhìn trở thành mặt đối diện. Ở thế mẫu, cả chín kim mặt sau lệch đồng đều. Khi nhìn đúng mặt đó, xoay ALL để đưa chúng về mốc.", "y2 ALL3- y2", "y2 ALL3+ y2", {
      comparison: [{ label: "Nhóm ALL ở mặt đang nhìn", setup: "ALL3-", caseId: "clock-align" }, { label: "Nhóm ALL được xoay từ mặt sau", setup: "y2 ALL3- y2", caseId: "clock-back" }]
    }),
    example("Kiểm tra hai mặt", "Sau khi sửa nhóm giữa, kiểm tra bốn góc của cả hai mặt. Các kim góc có liên hệ qua hai mặt, vì thế khi chỉnh một nhóm cần lật lại để xác nhận kết quả.", "", "", {
      quiz: { prompt: "Lệnh y2 tự nó có làm lệch thêm kim nào không?", options: ["Có, nó xoay toàn bộ kim nửa vòng", "Không, nó đổi mặt quan sát"], answer: 1, feedback: "y2 lật khung. Sau khi lật, hãy đọc lại tên nhóm theo mặt đang nhìn." }
    })
  ], {
    level: NEXT, prerequisite: "clock-front-groups", sources: [clockSource, notationSource], caseGroups: ["clock-basics"],
    video: { ...youtube("n5We_sCjBOc", "The Duke of Cubes · Mặt sau và bốn góc", 155, undefined, "Lật khối, căn dấu cộng sau rồi đối chiếu bốn góc."), chapters: [
      { label: "Lật sang mặt sau", time: 155, caption: "Ghi nhớ hướng lật để đọc đúng vị trí nút." },
      { label: "Dấu cộng sau", time: 192, caption: "Hoàn thành phần năm kim ở giữa." },
      { label: "Hoàn tất các góc", time: 260, caption: "Kiểm tra toàn bộ 18 kim về 12 giờ." }
    ] },
    mistake: "Lật khối theo hướng khác giữa hai bước làm tên vị trí nút không còn khớp với công thức.",
    exercise: { goal: "Xoay đúng mặt sau về mốc rồi trở lại hướng ban đầu kiểm tra cả hai mặt.", setup: "y2 ALL3- y2", algorithm: "y2 ALL3+ y2" }
  }),
  tutorial("mirror-first-layer", "mirror", "Mirror Cube · Dấu cộng phẳng và góc đáy", "Chọn một tâm làm mốc và kiểm tra hai mặt của cạnh, ba mặt của góc.", [
    example("Một cạnh nằm đúng", "Mặt trên trông gần phẳng nhưng cạnh trước có thể vẫn sai tầng hoặc xoay lệch. So bề mặt của viên với tâm trên và tâm trước. Xoay F2 để trả cạnh trong mẫu, rồi nhìn nghiêng để xác nhận hai mặt cùng phẳng.", "F2", "F2", {
      comparison: [{ label: "Cạnh trước chưa khớp độ dày", setup: "F2" }, { label: "Cạnh khớp với hai tâm", setup: "" }]
    }),
    example("Kiểm tra đủ ba chiều ở góc", "Chọn góc gần khe phải, cho mặt cần hoàn thành nằm dưới. Theo dõi cách nhóm bốn nước đưa viên góc về khe. Hãy kiểm tra viên có phẳng với ba bề mặt kề, kể cả mặt khó nhìn phía dưới.", "x2 U R U' R'", turn, {
      quiz: { prompt: "Góc đã khớp với mặt trên. Cần xem gì trước khi coi góc đúng?", options: ["Hai mặt kề còn lại", "Chỉ cần nhìn tiếp mặt trên"], answer: 0, feedback: "Góc Mirror Cube có ba kích thước. Cả ba bề mặt phải khớp."
      }
    })
  ], {
    prerequisite: "mirror-basic", sources: [mirrorSource, ...mainSources], caseGroups: ["mirror-foundation"],
    mistake: "Chọn góc bằng chiều cao của một mặt. Đổi góc nhìn để kiểm tra đủ ba kích thước.",
    exercise: { goal: "Lắp góc của mẫu vào khe. Nhìn ba bề mặt liền kề để kiểm tra.", setup: "x2 U R U' R'", algorithm: turn }
  }),
  tutorial("mirror-middle-layer", "mirror", "Mirror Cube · Chèn cạnh vào tầng giữa", "Đọc chiều dày của cạnh, mở đúng khe và giữ nguyên mặt đã giải.", [
    example("Chọn khe phải", "Giữ mặt đầu đã giải ở dưới. Tìm một cạnh tầng trên có hai kích thước đúng với hai tâm của khe giữa. Căn một bề mặt thẳng với tâm phía trước rồi mở khe phải. Sau chuỗi hãy nhìn nghiêng, kiểm tra bề mặt trước và phải đều phẳng.", "x2 F' U' F U R U R' U'", insertRight, {
      comparison: [{ label: "Thế chèn cạnh vào khe phải", setup: "x2 F' U' F U R U R' U'" }, { label: "Thế chèn cạnh vào khe trái", setup: "x2 F U F' U' L' U' L U" }]
    }),
    example("Chọn khe trái", "Đọc cạnh từ mặt trước theo cùng cách, rồi xác định bề mặt còn lại phải khớp tâm bên trái. Thao tác chèn đổi phía. Kiểm tra mặt dưới vẫn phẳng khi chuỗi kết thúc.", "x2 F U F' U' L' U' L U", insertLeft, {
      quiz: { prompt: "Sau khi chèn cạnh vào tầng giữa, nên kiểm tra thêm phần nào đã giải?", options: ["Mặt dưới và dải bên của tầng đầu", "Chỉ nhìn tâm trên"], answer: 0, feedback: "Góc nhìn nghiêng giúp kiểm tra cả mặt dưới và dải bên sát đáy. Mặt trên vẫn có các viên chưa giải." }
    })
  ], {
    level: NEXT, prerequisite: "mirror-first-layer", sources: [mirrorSource, ...mainSources], caseGroups: ["mirror-middle"],
    mistake: "Chọn khe theo viên cạnh đang gần bên nào. Căn với tâm trước, rồi so chiều dày còn lại để xác định khe đích.",
    exercise: { goal: "Chèn cạnh mẫu vào khe phải rồi kiểm tra hai bề mặt bên.", setup: "x2 F' U' F U R U R' U'", algorithm: insertRight }
  }),
  tutorial("mirror-last-layer", "mirror", "Mirror Cube · Dấu cộng và tầng cuối", "Phân biệt cạnh chưa ngang mặt trên với tầng trên đã phẳng nhưng sai vị trí.", [
    example("Định hướng cạnh bằng mặt phẳng", "Sau khi hoàn thành hai tầng đầu, nhìn nghiêng mặt trên. Chỉ đếm bốn ô cạnh nằm cùng mức với tâm. Ở mẫu đường thẳng, cầm đường theo hướng trong mô phỏng rồi thực hiện chuỗi định hướng cạnh.", "x2 " + edgeLine, orientEdges, {
      comparison: [{ label: "Hai cạnh đã ngang mặt trên", setup: "x2 " + edgeLine }, { label: "Cả bốn cạnh ngang tâm", setup: "x2" }]
    }),
    example("Hoán vị khi đã phẳng", "Sau định hướng, tầng trên có thể đã phẳng ở một góc nhìn nhưng các bề mặt bên còn bậc. Ví dụ dưới đây dùng thế T-perm. Căn đúng hướng, chạy và quan sát bậc ở cạnh bên biến mất.", "x2 " + tperm, tperm)
  ], {
    level: NEXT, prerequisite: "mirror-middle-layer", sources: [mirrorSource, ...mainSources], caseGroups: ["mirror-last"],
    mistake: "Xác nhận đã giải chỉ bằng mặt trên. Kiểm tra cả bốn mặt bên và mặt đáy.",
    exercise: { goal: "Đưa cạnh mẫu về đúng hướng và kiểm tra mặt trên cùng bề mặt bên.", setup: "x2 " + edgeLine, algorithm: orientEdges }
  })
];

export const LESSONS = [...BEGINNER, ...WALKTHROUGHS, ...ADVANCED, ...MORE, ...WORKSHOPS];

// Local clips complement the source videos and can be played without an embed.
// Guide indices for the three corner/edge lessons show a single teaching case.
const clipExamples = [
  ["notation", "Chiều quay mặt phải", 1, "R R' R' R"],
  ["white-cross", "Căn dấu cộng trắng", 2],
  ["white-corners", "Lắp góc trắng", 1],
  ["middle-edges", "Chèn cạnh sang phải", 1],
  ["yellow-cross", "Dấu cộng vàng · chữ L", 2],
  ["yellow-edges", "Khớp cạnh vàng", 1],
  ["place-corners", "Đặt góc vàng", 1],
  ["twist-corners", "Xoay góc và hoàn thành", 1],
  ["walkthrough", "Giải mẫu · đường ngang", 0],
  ["walkthrough-2", "Giải mẫu · chữ L", 0],
  ["walkthrough-3", "Giải mẫu · chấm", 0],
  ["4x4-inner-turns", "4×4 · Nhận diện lớp thứ hai", 0],
  ["4x4-reduction-check", "4×4 · Cạnh bị lật", 0],
  ["5x5-last-edge", "5×5 · Giữ mảnh giữa", 0],
  ["6x6-edge-orbits", "6×6 · Sửa cặp gần giữa", 1],
  ["7x7-edge-orbits", "7×7 · Sửa cánh ngoài", 1]
];

export const LESSON_MOVIES = clipExamples.map(([id, label, guideIndex, moves]) => {
  const lesson = LESSONS.find((item) => item.id === id);
  const step = lesson.guide[guideIndex];
  const base = "assets/rubik/lessons/" + id;
  const localClip = { src: base + ".mp4", captions: base + ".vtt", label };
  lesson.localClip = localClip;
  return { id, label, puzzle: lesson.puzzle, setup: step.setup, algorithm: moves || step.algorithm, ...localClip };
});
