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
    video: options.video
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

// The setup is relative to a solved cube unless stated. x2 puts yellow up
// and white down after the first stage. Source clips may use a different front.
const turn = "R U R' U'";
const insertRight = "U R U' R' U' F' U F";
const insertLeft = "U' L' U L U F U' F'";
const orientEdges = "F R U R' U' F'";
const swapEdges = "R U R' U R U2 R' U";
const placeCorners = "U R U' L' U R' U' L";
const twist = "R' D' R D";
const sune = "R U R' U R U2 R'";
const tperm = "R U R' U' R' F R2 U' R' U' R U R' F'";
const edgeLine = "F U R U' R' F'";
const edgeElbow = edgeLine + " " + edgeLine;
const edgeDot = edgeElbow + " U2 " + edgeLine;
const cornerTwistSetup = "x2 U D' R' D R D' R' D R D' R' D R D' R' D R U' D' R' D R D' R' D R";
const finishCornerTwists = [twist, twist, "U", twist, twist, twist, twist, "U'"].join(" ");

const BEGINNER = [
  tutorial("notation", CUBE, "Cầm khối và đọc ký hiệu", "Phân biệt tâm, cạnh và góc. Thực hiện đúng một lượt R, R' và R2.", [
    example("Nhận diện viên", "Tâm có một màu và nằm giữa mặt. Cạnh có hai màu. Góc có ba màu. Hãy giữ một mặt quay về phía bạn để làm mặt trước F.", "", ""),
    example("Mặt phải R và R'", "Đánh dấu góc phía trên, trước và phải. Nhìn thẳng vào mặt phải: R là một phần tư vòng theo chiều kim đồng hồ, R' theo chiều ngược lại. Hai mũi tên dùng cùng góc nhìn.", "", "R", {
      comparison: [
        { label: "R · thuận chiều", setup: "", algorithm: "R", marker: { face: "R", cell: 0 }, arrow: "clockwise" },
        { label: "R' · ngược chiều", setup: "", algorithm: "R'", marker: { face: "R", cell: 0 }, arrow: "counterclockwise" }
      ],
      quiz: {
        prompt: "Khi nhìn thẳng vào mặt phải, ký hiệu nào xoay ngược chiều kim đồng hồ?",
        options: ["R", "R'", "R2"], answer: 1,
        feedback: "Dấu nháy đổi chiều quay. R2 là nửa vòng, theo chiều nào cũng đến cùng vị trí."
      }
    }),
    example("Đọc một chuỗi", "U là mặt trên, D là mặt dưới, L là trái, R là phải, F là trước, B là sau. Thực hiện từ trái sang phải. Số 2 nghĩa là xoay 180°. x, y, z đổi hướng cả khối, còn M, E, S là lớp giữa.", "", turn)
  ], {
    mistake: "Lấy chiều quay theo góc nhìn trước cho mọi mặt. Hãy tưởng tượng nhìn trực diện từng mặt đang xoay.",
    exercise: { goal: "Thực hiện R rồi R'. Đối chiếu với trạng thái ban đầu.", setup: "", algorithm: "R R'" },
    sources: [source("J Perm · Ký hiệu", "https://jperm.net/3x3/moves"), ...mainSources],
    video: youtube("emOpNhejJXo", "CubeSkills · Ký hiệu", 0, 212, "Đổi góc cầm để nhìn trực diện mặt đang xoay. Đọc dấu nháy và số 2 trước khi xoay.")
  }),
  tutorial("white-cross", CUBE, "Dấu cộng trắng", "Đưa đủ bốn cạnh trắng vào mặt trắng và khớp bốn màu bên với tâm.", [
    example("Tìm cạnh đúng", "Giữ tâm trắng phía trên. Chọn một cạnh có trắng và một màu bên. Nhìn màu thứ hai để biết tâm bên nào đón viên đó.", "F2", "F2"),
    example("Đưa từng cạnh vào dấu cộng", "Khi trắng đang hướng xuống, xoay D để màu bên của cạnh khớp tâm bên rồi xoay mặt đó 180°. Nếu cạnh mắc ở tầng giữa hoặc bị lật, đưa nó xuống trước và chọn lại mặt cần xoay. Dùng U tạm thời để nhường chỗ cho cạnh đã khớp rồi hoàn tác.", "F2 R2", "R2 F2"),
    example("So sánh màu cạnh với tâm", "Cả hai hình đều có bốn cạnh trắng hướng lên. Chỉ hình có đủ bốn màu bên khớp các tâm mới là kết quả cần đạt.", "U", "U'", {
      comparison: [
        { label: "Cạnh trắng đã lên, màu bên lệch tâm", setup: "U" },
        { label: "Dấu cộng đúng, đủ bốn màu bên khớp tâm", setup: "" }
      ],
      quiz: {
        prompt: "Hình nào đã hoàn thành dấu cộng trắng?",
        options: ["Hình có màu bên lệch tâm", "Hình đủ bốn màu bên khớp tâm"], answer: 1,
        feedback: "Bốn cạnh trắng cần đúng cả hướng lẫn vị trí. Kiểm tra từng mặt bên trước khi chuyển bài."
      }
    })
  ], {
    prerequisite: "notation",
    mistake: "Dừng ngay khi thấy hình dấu cộng trắng. Hãy nhìn bốn viên cạnh cạnh tâm bên, thay vì chỉ nhìn mặt trên.",
    exercise: { goal: "Khớp cạnh trắng của mặt trước và mặt phải.", setup: "F2 R2", algorithm: "R2 F2" },
    sources: mainSources,
    video: mainVideo("Dấu cộng trắng", 20, 104, "Đưa cạnh trắng lên mặt trên và kiểm tra màu cạnh bên trùng với tâm.")
  }),
  tutorial("white-corners", CUBE, "Góc trắng và tầng đầu", "Hoàn thành bốn góc trắng. Cả hàng sát mặt trắng của mỗi mặt bên phải cùng màu.", [
    example("Đổi hướng sau dấu cộng", "Lật cả khối để trắng ở đáy và vàng ở trên. Tìm góc có trắng trên tầng trên. Hai màu còn lại phải khớp hai tâm ở hai bên ô góc đích.", "x2", ""),
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
  ["R2 F2", "x2 " + turn, insertRight, orientEdges, swapEdges, placeCorners, finishCornerTwists],
  ["L2 U2 B2 U2", "x2 L' U' L U", insertLeft, orientEdges + " " + orientEdges, swapEdges, placeCorners, finishCornerTwists],
  ["U F2 U' L2", "x2 " + turn + " " + turn, insertRight + " y2 " + insertRight + " y2",
   [orientEdges, "U2", orientEdges, orientEdges].join(" "), swapEdges, placeCorners, finishCornerTwists]
];
const checkpoints = [
  ["Dấu cộng trắng", "Mặt trắng hướng lên. Sau bước này cả bốn màu cạnh bên cần khớp các tâm."],
  ["Tầng đầu", "Lật khối cho trắng xuống dưới. Đưa góc qua khe đúng và kiểm tra dải màu ở cả bốn mặt bên."],
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
    "Đây là mẫu thực hành dựng riêng để có đủ các điểm kiểm tra. Video nguồn có lượt xáo khác, dùng để quan sát cách cầm khối thật.",
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
    example("Đọc vị trí tương đối", "Tìm bốn cạnh có màu nền và theo dõi thứ tự các màu bên quanh tâm. Chọn cạnh có thể giải cùng một nước với cạnh khác."),
    example("Giữ các cạnh đã lắp", "Căn D tạm thời để dành đúng chỗ rồi đưa cạnh xuống. Trả D về vị trí khớp bốn tâm. Khi quen, thử nhìn trước vị trí cặp F2L đầu tiên.", "x2 F2 R2", "R2 F2")
  ], {
    level: NEXT, prerequisite: "white-cross", sources: cfopSources,
    exercise: { goal: "Lập kế hoạch cho hai cạnh rồi thực hiện mà vẫn nhìn thấy cặp kế tiếp.", setup: "x2 F2 R2" },
    mistake: "Dừng sau mỗi cạnh để tìm lại vị trí của các cạnh vừa di chuyển.",
    video: youtube("IWXpkfwimo0", "J Perm · Luyện dấu cộng", 0, undefined, "Theo dõi quan hệ giữa bốn cạnh trước khi lập kế hoạch.")
  }),
  tutorial("cfop-f2l", CUBE, "CFOP · Ghép cặp F2L", "Tìm đúng cạnh và góc, ghép chúng thành một cặp rồi đưa vào khe.", [
    example("Tìm cặp", "Chọn một góc đáy và tìm cạnh có hai màu bên của góc đó. Đưa cả hai lên tầng trên; dùng một khe trống làm vùng thao tác."),
    example("Ghép rồi lắp", "Tạo một cặp có các mặt bên đúng màu tương đối. Đặt cặp phía trên khe và đưa vào bằng một nhóm ngắn, trả mặt bên về vị trí ban đầu.", "x2 R U R' U'", "U R U' R'"),
    example("Theo dõi cặp khác", "Khi tay đã quen với thao tác chèn, giảm tốc để mắt theo vị trí cặp kế tiếp trong lúc tay đang hoàn tất cặp hiện tại.")
  ], {
    level: NEXT, prerequisite: "white-corners", sources: [source("J Perm · F2L", "https://jperm.net/3x3/cfop/f2l"), ...cfopSources],
    mistake: "Xoay nhiều mặt để đuổi theo hai viên. Đưa chúng về vùng trên bằng một khe chưa giải.",
    exercise: { goal: "Chọn và ghép một cặp ở khe trước–phải.", setup: "x2 R U R' U'" },
    video: youtube("aKM5AqKyrX8", "Bullet Cubing · F2L trực quan", 0, undefined, "Quan sát cách ghép cạnh với góc trước khi chèn.")
  }),
  tutorial("cfop-oll", CUBE, "CFOP · Định hướng lớp cuối", "Từ dấu cộng vàng và Sune đến nhận diện toàn bộ OLL.", [
    example("Hai lượt OLL", "Lượt đầu làm dấu cộng vàng. Ở lượt thứ hai, đếm góc có vàng phía trên, rồi nhìn thêm các dải vàng ở bên để phân biệt các ca.", "x2 F U R U' R' F'", orientEdges),
    example("Nhận diện Sune", "Ở mẫu này cạnh đã hướng đúng và một góc đã có vàng trên mặt. Căn đúng hướng mẫu trước khi chạy công thức.", "x2 R U2 R' U' R U' R'", sune),
    example("Luyện bộ đầy đủ", "Nhóm các ca theo hình mặt trên, sau đó phân biệt bằng ô vàng ở mặt bên. Kiểm tra hai tầng đầu được bảo toàn sau mỗi công thức.")
  ], {
    level: NEXT, prerequisite: "cfop-f2l", sources: [source("CubeSkills · OLL", CUBESKILLS + "oll-algorithms"), ...cfopSources],
    mistake: "Nhận diện chỉ bằng mặt trên ở những ca có cùng hình nhưng khác dải màu bên.",
    exercise: { goal: "Chạy Sune từ đúng hướng và xác nhận cả mặt vàng đồng màu.", setup: "x2 R U2 R' U' R U' R'", algorithm: sune },
    video: youtube("sEhKsFCmRU4", "Bullet Cubing · 2-look OLL", 0, undefined, "Nhận diện mẫu cạnh và mẫu góc ở hai lượt riêng.")
  }),
  tutorial("cfop-pll", CUBE, "CFOP · Hoán vị lớp cuối", "Nhận diện dải góc và cạnh, thực hiện PLL và căn lớp trên.", [
    example("Nhìn các dải ở bên", "Sau OLL, nhìn qua ít nhất hai mặt bên. Cặp ô góc cùng màu trên một mặt giúp nhận diện nhóm. Kiểm tra cả ô giữa hai góc để phân biệt cạnh đã đúng."),
    example("T-perm", "Mô hình cho ví dụ một cặp góc và một cặp cạnh đổi chỗ. Giữ đúng hướng trước khi chạy chuỗi; căn U sau công thức nếu cần.", "x2 F R U' R' U R U R2 F' R U R U' R'", tperm),
    example("Hai lượt và một lượt", "Khi mới học, xử lý góc rồi cạnh. Khi đã nhận diện vững, dùng nhóm 21 PLL để hoàn thành hoán vị cả hai loại viên trong một lượt.")
  ], {
    level: NEXT, prerequisite: "cfop-oll", sources: [source("CubeSkills · PLL", CUBESKILLS + "pll-algorithms"), ...cfopSources],
    mistake: "Thực hiện đúng công thức nhưng cầm sai mặt trước hoặc bỏ qua bước căn U.",
    exercise: { goal: "Đọc vị trí cặp góc, nhận diện mẫu T và kiểm tra khối sau PLL." },
    video: youtube("J8p6JVLyGHo", "Bullet Cubing · 2-look PLL", 0, undefined, "Nhìn dấu hiệu bên ngoài trước khi chọn phép đổi góc hoặc cạnh.")
  }),
  tutorial("roux", CUBE, "Roux · Hai khối bên và sáu cạnh", "Hiểu trật tự khối trái, khối phải, CMLL và LSE.", [
    example("Khối 1×2×3 bên trái", "Dùng tâm trái, cạnh dưới–trái và hai cặp góc–cạnh tạo thành một dải 1×2×3. Tập ghép khối vuông 1×2×2 nhỏ trước, rồi nối cặp còn lại."),
    example("Khối bên phải", "Đặt khối đã giải bên trái. Tận dụng U, R, Rw và lớp giữa để ghép khối bên kia mà không phá khối trái. Quan sát hai dải bên liền mạch."),
    example("Bốn góc, sau đó sáu cạnh", "CMLL xử lý bốn góc lớp trên. Sau khi góc hoàn chỉnh, dùng M và U để định hướng sáu cạnh còn lại; bố trí hai cạnh trái/phải tầng trên rồi sắp bốn cạnh lớp giữa.")
  ], {
    level: EXPERT, prerequisite: "cfop-f2l", sources: [source("Kian Mansour · Hướng dẫn Roux", "https://sites.google.com/view/kianroux/roux-tutorial")],
    exercise: { goal: "Hoàn thành hai khối mà vẫn có thể xoay M. Quan sát các cạnh còn tự do." },
    mistake: "Cố ghép dấu cộng đáy như CFOP ngay từ đầu, hạn chế các nước lớp giữa hữu ích.",
    video: youtube("pj_IsOCJS3k", "Kian Mansour · Khối đầu tiên", 0, undefined, "Ghép một khối nhỏ rồi nối cạnh–góc còn lại để hoàn thành khối bên.")
  }),
  tutorial("zz", CUBE, "ZZ · Định hướng cạnh từ đầu", "Hiểu cách định hướng cạnh trước khi xây hai khối F2L.", [
    example("Chọn hệ quy chiếu", "Giữ cố định mặt trên và mặt trước. Một cạnh được coi là đúng hướng khi có thể về ô đích bằng các mặt U, D, R, L với quy ước đã chọn. Mục tiêu là tìm mọi cạnh lệch hướng trước."),
    example("EO và EOLine", "Đưa các cạnh lệch hướng đến F hoặc B theo nhóm chẵn. Xoay mặt trước/sau để đổi hướng cả nhóm. Khi mọi cạnh đã đúng hướng, đặt DF và DB khớp tâm tạo đường ở đáy."),
    example("Dựng hai khối", "Giữ đường ở đáy. Dùng U/R/L để xây hai bên. Nếu đã định hướng đúng, mặt cuối chỉ cần định hướng góc rồi thực hiện PLL, hoặc dùng nhóm thuật toán phù hợp hơn.")
  ], {
    level: EXPERT, prerequisite: "cfop-f2l", sources: [source("Conrad Rider · ZZ", "https://cube.crider.co.uk/zz.php")],
    exercise: { goal: "Đánh dấu các cạnh bị đổi hướng sau F rồi chuyển chúng về đúng hướng.", setup: "x2 F", algorithm: "F'" },
    mistake: "Đổi mặt trước giữa lúc phân loại cạnh. Giữ khối cố định trong cả bước EO.",
    video: { ...youtube("4Wrm2MGrRS8", "Joseph Hale · Học ZZ", 44), chapters: [
      { label: "EO và đường đáy", time: 44, caption: "Định hướng cạnh và giữ một mặt trước cố định." },
      { label: "Hai khối F2L", time: 384, caption: "Dùng các mặt trái, phải và trên để dựng khối." },
      { label: "Định hướng lớp cuối", time: 639, caption: "Các cạnh đã được định hướng từ bước đầu." },
      { label: "Hoán vị lớp cuối", time: 695, caption: "Đọc màu bên và sắp góc, cạnh." }
    ] }
  }),
  tutorial("finger-tricks", CUBE, "Kỹ thuật ngón tay và giải một tay", "Tập các nhóm nước ngắn với thế cầm ổn định.", [
    example("Đẩy U bằng ngón trỏ", "Đỡ đáy bằng các ngón còn lại. Dùng ngón trỏ đẩy lớp trên thay vì xoay cả cổ tay. Tập chậm để hai lớp bên dưới đứng yên.", "", "U U' U2"),
    example("Giảm đổi thế cầm", "Tập R U R' U' thành một nhịp, chỉ tăng tốc khi mỗi nước đều dừng đúng vị trí. Khi giải một tay, dùng ngón trỏ hoặc ngón út theo thế cầm thoải mái thay vì rướn ngón.", "", turn),
    example("Theo dõi trong lúc xoay", "Đặt mục tiêu hạn chế thời gian dừng. Giảm tốc độ khi chưa nhận ra cặp tiếp theo rồi giữ nhịp đều.")
  ], {
    level: NEXT, prerequisite: "notation", sources: [source("J Perm · Finger tricks", "https://jperm.net/3x3/fingertricks"), source("J Perm · Giải một tay", "https://jperm.net/oh")],
    exercise: { goal: "Thực hiện năm lần nhóm bốn nước ở cùng một thế cầm." },
    mistake: "Tăng tốc khi các lớp chưa vào đúng vị trí, khiến những nước tiếp theo bị kẹt.",
    video: youtube("mUF3aPDTO-4", "J Perm · Xoay và giải một tay", 0, undefined, "Quan sát ngón nào giữ khối và ngón nào thực hiện nước xoay.")
  }),
  tutorial("commutators-bld", CUBE, "Làm quen commutator và giải bịt mắt", "Hiểu tác dụng của A B A' B' và cách nhớ đường đi của viên.", [
    example("Thử một commutator", "Chọn A = R, B = U. Dùng A rồi B, sau đó hoàn tác từng nhóm theo thứ tự A', B'. So sánh viên nào trở về và viên nào còn thay đổi.", "", turn),
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
    prerequisite: "5x5-reduction", sources: [...largerSources, source("QiYi · Khối lớn", "https://theqiyi.com/blog/how-to-solve-qiyi-2x2.html")],
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
    example("Tâm còn lại", "Sau các góc, đếm số mặt đúng. Mẫu nhóm bốn nước, lật cả khối và lặp nhóm đó giúp đổi các tâm theo chu kỳ. Hãy đối chiếu hướng cầm trong video khi áp dụng cho khối thật.", "L R' L' R x2 L R' L' R", "R' L R L' x2 R' L R L'")
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
    prerequisite: "twist-corners", sources: [source("Bullet Cubing · Mirror Blocks", "https://www.bulletcubing.com/video-courses")],
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

export const LESSONS = [...BEGINNER, ...WALKTHROUGHS, ...ADVANCED, ...MORE];

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
  ["walkthrough-3", "Giải mẫu · chấm", 0]
];

export const LESSON_MOVIES = clipExamples.map(([id, label, guideIndex, moves]) => {
  const lesson = LESSONS.find((item) => item.id === id);
  const step = lesson.guide[guideIndex];
  const base = "assets/rubik/lessons/" + id;
  const localClip = { src: base + ".mp4", captions: base + ".vtt", label };
  lesson.localClip = localClip;
  return { id, label, puzzle: lesson.puzzle, setup: step.setup, algorithm: moves || step.algorithm, ...localClip };
});
