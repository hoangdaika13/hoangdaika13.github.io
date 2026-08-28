(function () {
  "use strict";

  const VERSION = "1.1.1";
  const STORAGE_KEY = "hh.play.profile.v1";
  const RECOVERY_KEY = "hh.play.recovery.v1";
  const STATE_SCHEMA_VERSION = 2;
  const DB_NAME = "hh-play-local-v2";
  const DB_VERSION = 1;
  const PROFILE_STORE = "profiles";
  const SNAPSHOT_STORE = "snapshots";
  const PROFILE_ID = "primary";
  const MAX_XP = 50000000;
  const MAX_SCORE = 1000000000;
  const MAX_HISTORY = 160;
  const MAX_REWARDS = 480;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_CONTENT_PACKS = 20;
  const ARCADE_DIFFICULTIES = Object.freeze([
    { id: "easy", label: "Dễ", note: "Nhịp chậm · nhiều mạng", factor: .78 },
    { id: "normal", label: "Thường", note: "Cân bằng", factor: 1 },
    { id: "hard", label: "Khó", note: "Nhanh · nhiều điểm", factor: 1.28 }
  ]);
  const QUIZ_TOPICS = Object.freeze([
    { id: "all", label: "Tổng hợp", icon: "✦" },
    { id: "science", label: "Khoa học", icon: "⌬" },
    { id: "technology", label: "Công nghệ", icon: "⌘" },
    { id: "culture", label: "Văn hóa", icon: "◫" },
    { id: "thinking", label: "Tư duy", icon: "◇" }
  ]);
  const QUIZ_DIFFICULTIES = Object.freeze([
    { id: "all", label: "Mọi mức" },
    { id: "foundation", label: "Nền tảng" },
    { id: "advanced", label: "Chuyên sâu" }
  ]);
  const GAME_GUIDES = Object.freeze({
    snake: { goal: "Ăn tinh thể, lớn dần và không chạm tường hoặc thân.", controls: "Mũi tên / WASD / vuốt / D-pad", tip: "Đổi hướng sớm một nhịp để không tự khóa đường." },
    dodge: { goal: "Né thiên thạch cho tới khi đạt mốc điểm.", controls: "← → / A D / D-pad", tip: "Giữ phi thuyền ở vùng giữa và đổi hướng ngắn." },
    breaker: { goal: "Phá toàn bộ tường ánh sáng trước khi hết mạng.", controls: "← → / A D / D-pad", tip: "Đánh bóng lệch nhẹ để mở góc phản xạ." },
    shooter: { goal: "Bắn đủ wave thiên thạch để bảo vệ cổng sao.", controls: "← → / Space / D-pad + nút bắn", tip: "Bắn từng nhịp; bộ đạn có giới hạn trên màn hình." },
    memory: { goal: "Ghép đủ các cặp chòm sao với ít lượt nhất.", controls: "Chuột / chạm / bàn phím", tip: "Nhớ vị trí trước khi lật thẻ tiếp theo." },
    reaction: { goal: "Chờ tín hiệu xanh rồi bấm nhanh nhất có thể.", controls: "Enter / Space / chạm", tip: "Bấm sớm sẽ hủy lượt để tránh kết quả sai." },
    elements: { goal: "Trượt và hợp nhất nguyên tố tới 2048.", controls: "Mũi tên / WASD / swipe", tip: "Giữ một góc làm vùng neo cho các ô lớn." },
    sudoku: { goal: "Điền các ô trống sao cho mỗi hàng và cột hợp lệ.", controls: "Bàn phím số / chạm", tip: "Kiểm tra ô còn thiếu trước khi gửi kết quả." },
    word: { goal: "Sắp chữ theo gợi ý thành một từ đúng.", controls: "Bàn phím / chạm", tip: "Có thể bỏ dấu khi nhập câu trả lời tiếng Việt." },
    tower: { goal: "Giữ cả ba tuyến năng lượng qua 12 wave.", controls: "Chạm hoặc Enter trên tuyến", tip: "Ưu tiên tuyến yếu nhất; năng lượng hồi theo wave." }
  });
  const ACHIEVEMENTS = Object.freeze([
    { id: "first-light", title: "Ánh sáng đầu tiên", note: "Hoàn thành ván đầu tiên", icon: "✦" },
    { id: "arcade-tour", title: "Du hành Arcade", note: "Chơi 5 trò khác nhau", icon: "▣" },
    { id: "story-keeper", title: "Người giữ chuyện", note: "Mở một kết thúc truyện", icon: "⌁" },
    { id: "escape-master", title: "Mở cổng sao", note: "Giải trọn một Escape Room", icon: "⌾" },
    { id: "focus-orbit", title: "Quỹ đạo tập trung", note: "Hoàn thành Pomodoro", icon: "◌" },
    { id: "social-spark", title: "Tia kết nối", note: "Tạo phòng HH Play", icon: "◎" }
  ]);
  const localDayKey = (date = new Date()) => {
    const value = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };
  const DAY_KEY = () => localDayKey();

  const VIEWS = [
    { id: "today", icon: "✦", title: "Hôm nay", note: "Nhiệm vụ và chơi nhanh", color: "#ffd86b" },
    { id: "arcade", icon: "▣", title: "Arcade Galaxy", note: "Trò chơi dùng được ngay", color: "#63eaff" },
    { id: "party", icon: "◎", title: "Party Room", note: "Phòng riêng và quyền truy cập", color: "#ff68c7" },
    { id: "watch", icon: "▶", title: "Watch Party", note: "Hàng đợi video có nguồn", color: "#ff6578" },
    { id: "story", icon: "⌁", title: "Story Universe", note: "Truyện lựa chọn nhiều nhánh", color: "#aa82ff" },
    { id: "escape", icon: "⌾", title: "Escape Room", note: "Mật mã và gợi ý ba cấp", color: "#ffb45f" },
    { id: "rhythm", icon: "♫", title: "Rhythm Arena", note: "Bắt nhịp với Web Audio", color: "#ff62d1" },
    { id: "pet", icon: "◇", title: "HH Virtual Pet", note: "Chăm sóc không gây áp lực", color: "#70f0b0" },
    { id: "chill", icon: "☂", title: "Chill Rooms", note: "Âm cảnh và Pomodoro", color: "#67b7ff" },
    { id: "quiz", icon: "?", title: "Quiz Arena", note: "Đố vui có giải thích", color: "#ffe05e" }
  ];

  const ARCADE_GAMES = [
    { id: "snake", icon: "S", title: "Neon Snake", type: "canvas", desc: "Thu thập tinh thể và tránh chạm thân." },
    { id: "dodge", icon: "A", title: "Asteroid Dodge", type: "canvas", desc: "Lái phi thuyền né mưa thiên thạch." },
    { id: "breaker", icon: "B", title: "Light Breaker", type: "canvas", desc: "Phá tường ánh sáng bằng phản xạ." },
    { id: "shooter", icon: "↟", title: "Star Shooter", type: "canvas", desc: "Bảo vệ cổng sao trước từng wave." },
    { id: "memory", icon: "M", title: "Memory Constellation", type: "dom", desc: "Ghép các cặp chòm sao giống nhau." },
    { id: "reaction", icon: "R", title: "Reaction Pulse", type: "dom", desc: "Đo phản xạ sau tín hiệu an toàn." },
    { id: "elements", icon: "4", title: "Element 2048", type: "dom", desc: "Hợp nhất nguyên tố để tạo lõi 2048." },
    { id: "sudoku", icon: "9", title: "Solar Sudoku", type: "dom", desc: "Hoàn thành bảng số 4 × 4 ngắn gọn." },
    { id: "word", icon: "W", title: "Word Orbit", type: "dom", desc: "Sắp chữ thành từ đúng theo gợi ý." },
    { id: "tower", icon: "T", title: "Tower Tactics", type: "dom", desc: "Phân phối năng lượng để giữ ba tuyến." }
  ];

  const QUIZ = Object.freeze([
    { id: "sci-mars", topic: "science", difficulty: "foundation", skill: "Ghi nhớ", q: "Hành tinh nào được gọi là Hành tinh Đỏ?", choices: ["Sao Kim", "Sao Hỏa", "Sao Thủy", "Sao Hải Vương"], answer: 1, why: "Các khoáng vật chứa ôxít sắt trên bề mặt khiến Sao Hỏa có sắc đỏ đặc trưng.", insight: "Màu quan sát được có thể hé lộ thành phần hóa học của một thiên thể." },
    { id: "sci-sound", topic: "science", difficulty: "foundation", skill: "Hiểu cơ chế", q: "Trong ba môi trường rắn, lỏng và khí, âm thanh thường truyền nhanh nhất ở đâu?", choices: ["Chất rắn", "Chất lỏng", "Chất khí", "Tốc độ luôn bằng nhau"], answer: 0, why: "Trong chất rắn, các hạt thường liên kết chặt và truyền dao động cơ học hiệu quả hơn.", insight: "Âm thanh cần môi trường vật chất; nó không lan truyền trong chân không lý tưởng." },
    { id: "sci-moon", topic: "science", difficulty: "foundation", skill: "Phân loại", q: "Mặt Trăng được phân loại đúng nhất là gì?", choices: ["Một ngôi sao", "Một hành tinh", "Vệ tinh tự nhiên", "Một thiên hà"], answer: 2, why: "Mặt Trăng chuyển động quanh Trái Đất nên là vệ tinh tự nhiên của Trái Đất.", insight: "Tên gọi khoa học dựa vào quan hệ chuyển động và bản chất vật thể, không chỉ kích thước." },
    { id: "sci-water", topic: "science", difficulty: "foundation", skill: "Vận dụng", q: "Vì sao mồ hôi giúp cơ thể hạ nhiệt hiệu quả nhất?", choices: ["Mồ hôi phản chiếu ánh sáng", "Nước bay hơi lấy đi nhiệt", "Muối làm da lạnh tức thì", "Da tạo thêm gió"], answer: 1, why: "Quá trình bay hơi cần năng lượng và lấy nhiệt từ bề mặt da.", insight: "Trong không khí quá ẩm, bay hơi chậm hơn nên cảm giác nóng có thể tăng." },
    { id: "sci-ecosystem", topic: "science", difficulty: "advanced", skill: "Phân tích hệ thống", q: "Nếu một quần thể thú săn đầu bảng giảm mạnh, hệ quả nào có khả năng xảy ra trước trong lưới thức ăn?", choices: ["Con mồi tăng và gây áp lực lên thực vật", "Mọi loài cùng giảm ngay lập tức", "Thực vật biến mất do thú săn ăn", "Khí hậu đổi trong một ngày"], answer: 0, why: "Ít thú săn có thể làm quần thể con mồi tăng, từ đó tăng áp lực ăn lên thực vật.", insight: "Hiệu ứng dây chuyền dinh dưỡng cho thấy thay đổi ở một tầng có thể lan qua cả hệ sinh thái." },
    { id: "sci-experiment", topic: "science", difficulty: "advanced", skill: "Thiết kế thí nghiệm", q: "Muốn biết phân bón A có làm cây cao hơn, thiết kế nào cho kết luận đáng tin nhất?", choices: ["Bón A cho một cây rồi quan sát", "So hai nhóm giống nhau, chỉ thay loại phân và lặp lại", "Hỏi người bán phân", "So cây khác loài ở hai nơi khác nhau"], answer: 1, why: "Nhóm đối chứng, kiểm soát biến và lặp lại giúp tách tác động của phân bón khỏi các yếu tố khác.", insight: "Một thí nghiệm tốt không chỉ tìm khác biệt mà còn loại trừ các giải thích thay thế." },
    { id: "sci-climate", topic: "science", difficulty: "advanced", skill: "Đọc bằng chứng", q: "Một ngày rất lạnh có bác bỏ xu hướng ấm lên toàn cầu dài hạn không?", choices: ["Có, vì khí hậu chỉ là nhiệt độ hôm nay", "Không, thời tiết ngắn hạn khác xu hướng khí hậu dài hạn", "Có, nếu có tuyết", "Không, vì mọi nơi luôn nóng hơn mỗi ngày"], answer: 1, why: "Thời tiết mô tả trạng thái ngắn hạn; khí hậu được đánh giá từ thống kê dài hạn trên phạm vi lớn.", insight: "Đừng dùng một điểm dữ liệu đơn lẻ để phủ định hoặc khẳng định một xu hướng dài hạn." },
    { id: "sci-orbit", topic: "science", difficulty: "advanced", skill: "Suy luận", q: "Vì sao phi hành gia trên quỹ đạo có cảm giác không trọng lượng dù lực hấp dẫn vẫn tồn tại?", choices: ["Ngoài khí quyển không có hấp dẫn", "Tàu và phi hành gia cùng rơi tự do quanh Trái Đất", "Mặt Trăng hút hết lực", "Áp suất trong tàu triệt tiêu hấp dẫn"], answer: 1, why: "Cả tàu và người liên tục rơi tự do với cùng gia tốc trong khi vận tốc ngang giữ họ trên quỹ đạo.", insight: "Cảm giác không trọng lượng không đồng nghĩa lực hấp dẫn bằng không." },
    { id: "tech-css", topic: "technology", difficulty: "foundation", skill: "Ghi nhớ", q: "CSS chủ yếu đảm nhiệm vai trò nào trong một trang web?", choices: ["Lưu mật khẩu", "Mô tả trình bày và bố cục", "Nén video", "Cấp chứng chỉ HTTPS"], answer: 1, why: "CSS quy định cách tài liệu web được hiển thị, từ màu sắc đến bố cục responsive.", insight: "HTML mô tả cấu trúc; CSS trình bày; JavaScript thường xử lý hành vi." },
    { id: "tech-https", topic: "technology", difficulty: "foundation", skill: "Ghi nhớ", q: "Cổng TCP mặc định thường dùng cho HTTPS là cổng nào?", choices: ["21", "53", "80", "443"], answer: 3, why: "HTTPS theo mặc định sử dụng cổng TCP 443.", insight: "Đúng cổng không tự bảo đảm an toàn; cấu hình TLS và xác minh chứng chỉ vẫn quan trọng." },
    { id: "tech-password", topic: "technology", difficulty: "foundation", skill: "An toàn số", q: "Cách nào an toàn hơn khi tạo mật khẩu cho nhiều dịch vụ?", choices: ["Dùng một mật khẩu ngắn cho tất cả", "Dùng mật khẩu riêng, dài và trình quản lý mật khẩu", "Ghi mật khẩu công khai", "Chỉ đổi một ký tự cuối"], answer: 1, why: "Mật khẩu riêng hạn chế thiệt hại khi một dịch vụ rò rỉ; trình quản lý giúp tạo và lưu chuỗi mạnh.", insight: "Bật xác thực đa yếu tố giúp bổ sung một lớp bảo vệ quan trọng." },
    { id: "tech-cache", topic: "technology", difficulty: "foundation", skill: "Hiểu cơ chế", q: "Bộ nhớ đệm trình duyệt có mục đích chính nào?", choices: ["Lưu tạm tài nguyên để tải lại nhanh hơn", "Thay thế hoàn toàn máy chủ", "Mã hóa mọi tệp người dùng", "Tăng độ phân giải màn hình"], answer: 0, why: "Cache giữ bản sao tài nguyên phù hợp để giảm tải lại và độ trễ.", insight: "Quản lý phiên bản tài nguyên giúp tránh việc người dùng nhận mã cũ sau khi cập nhật." },
    { id: "tech-race", topic: "technology", difficulty: "advanced", skill: "Chẩn đoán", q: "Hai thao tác bất đồng bộ cùng ghi vào một trạng thái và kết quả phụ thuộc thứ tự hoàn tất. Đây gần nhất là lỗi gì?", choices: ["Race condition", "Syntax error", "Compression artifact", "Color banding"], answer: 0, why: "Race condition xảy ra khi kết quả phụ thuộc vào thời điểm hoặc thứ tự của các tác vụ đồng thời.", insight: "Có thể giảm lỗi bằng hàng đợi, khóa, phiên bản trạng thái hoặc kiểm tra yêu cầu cũ." },
    { id: "tech-accessibility", topic: "technology", difficulty: "advanced", skill: "Thiết kế bao trùm", q: "Một dialog web mở đúng cách nên xử lý focus như thế nào?", choices: ["Không thay đổi focus", "Đưa focus vào dialog, giữ trong dialog và trả lại nút mở khi đóng", "Luôn đưa focus lên đầu trang", "Ẩn toàn bộ nút đóng"], answer: 1, why: "Quản lý focus giúp người dùng bàn phím và công nghệ hỗ trợ hiểu được ngữ cảnh hiện tại.", insight: "Escape, nhãn truy cập và thứ tự tab hợp lý cũng là phần của dialog dễ tiếp cận." },
    { id: "tech-authority", topic: "technology", difficulty: "advanced", skill: "Kiến trúc hệ thống", q: "Trong game cạnh tranh trực tuyến, vì sao điểm số nên được máy chủ xác thực?", choices: ["Để giao diện có nhiều màu hơn", "Để giảm khả năng client tự sửa điểm và gian lận", "Để không cần mạng", "Để mọi animation chạy 60 FPS"], answer: 1, why: "Client nằm trong quyền kiểm soát của người chơi nên dữ liệu cạnh tranh quan trọng cần được máy chủ kiểm chứng.", insight: "Server-authoritative không loại bỏ mọi gian lận nhưng tạo một ranh giới tin cậy rõ hơn." },
    { id: "tech-performance", topic: "technology", difficulty: "advanced", skill: "Đánh giá hiệu năng", q: "Chỉ số nào phản ánh độ mượt khung hình rõ hơn một con số FPS trung bình đơn lẻ?", choices: ["Độ dài tên tệp", "Phân bố frame time và các spike", "Số màu trong logo", "Kích thước con trỏ"], answer: 1, why: "Frame time cho biết thời gian của từng khung; spike có thể gây khựng dù FPS trung bình cao.", insight: "Đánh giá hiệu năng nên kết hợp CPU, GPU, bộ nhớ và nhịp khung hình thực tế." },
    { id: "culture-capital", topic: "culture", difficulty: "foundation", skill: "Ghi nhớ", q: "Thủ đô của Việt Nam là thành phố nào?", choices: ["Hà Nội", "Huế", "Đà Nẵng", "Hải Phòng"], answer: 0, why: "Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam.", insight: "Thủ đô là trung tâm chính trị; điều đó không nhất thiết đồng nghĩa là thành phố đông dân nhất." },
    { id: "culture-bpm", topic: "culture", difficulty: "foundation", skill: "Đọc ký hiệu", q: "Một bản nhạc ghi 120 BPM có ý nghĩa gì?", choices: ["120 nốt trong cả bài", "120 nhịp mỗi phút", "Dài 120 giây", "Âm lượng 120 dB"], answer: 1, why: "BPM là beats per minute, mô tả số nhịp trong một phút.", insight: "BPM mô tả tốc độ nhịp, không tự quyết định nhịp phách hay cảm xúc của tác phẩm." },
    { id: "culture-source", topic: "culture", difficulty: "foundation", skill: "Đọc nguồn", q: "Khi dùng một ảnh CC BY trong sản phẩm, việc nào thường cần thiết?", choices: ["Xóa tên tác giả", "Ghi công theo điều kiện giấy phép", "Tuyên bố ảnh do mình tạo", "Không cần đọc giấy phép"], answer: 1, why: "CC BY yêu cầu ghi công phù hợp cho tác giả/nguồn theo điều kiện giấy phép.", insight: "Luôn kiểm tra phiên bản giấy phép và các quyền riêng như hình ảnh con người hoặc nhãn hiệu." },
    { id: "culture-history", topic: "culture", difficulty: "foundation", skill: "Bối cảnh", q: "Khi đọc một văn bản lịch sử, câu hỏi nào hữu ích nhất để hiểu bối cảnh?", choices: ["Ai viết, viết khi nào và cho ai?", "Phông chữ có đẹp không?", "Tệp nặng bao nhiêu?", "Có bao nhiêu dấu chấm?"], answer: 0, why: "Tác giả, thời điểm, đối tượng và mục đích giúp đánh giá góc nhìn và giới hạn của nguồn.", insight: "Nguồn sơ cấp rất quý nhưng không tự động trung lập hoặc đầy đủ." },
    { id: "culture-translation", topic: "culture", difficulty: "advanced", skill: "Diễn giải", q: "Vì sao hai bản dịch tốt của cùng một câu văn vẫn có thể khác nhau?", choices: ["Một bản chắc chắn giả", "Ngữ nghĩa, sắc thái và cấu trúc không luôn có tương đương một-một", "Ngôn ngữ không có quy tắc", "Dịch giả không cần hiểu văn bản"], answer: 1, why: "Người dịch phải cân bằng nghĩa, sắc thái, nhịp điệu và bối cảnh; đôi khi không có một lựa chọn duy nhất.", insight: "So sánh nhiều bản dịch có thể làm rõ những lớp nghĩa mà một bản khó truyền tải hết." },
    { id: "culture-statue", topic: "culture", difficulty: "advanced", skill: "Đạo đức bảo tồn", q: "Khi số hóa hiện vật văn hóa, lựa chọn nào có trách nhiệm nhất?", choices: ["Bỏ mọi thông tin nguồn", "Lưu provenance, quyền sử dụng và bối cảnh cộng đồng", "Tự đổi tên tác giả", "Công khai dữ liệu nhạy cảm không giới hạn"], answer: 1, why: "Nguồn gốc, quyền và bối cảnh giúp bảo tồn ý nghĩa, tôn trọng cộng đồng và sử dụng đúng pháp lý.", insight: "Khả năng quét hoặc tải một hiện vật không tự động tạo quyền tái sử dụng vô hạn." },
    { id: "culture-argument", topic: "culture", difficulty: "advanced", skill: "Đọc phản biện", q: "Một bài viết chỉ trích dẫn những ví dụ ủng hộ quan điểm và bỏ qua bằng chứng trái chiều đang có nguy cơ gì?", choices: ["Selection bias", "Đo lường chính xác hơn", "Tăng tính đại diện", "Loại bỏ thiên kiến"], answer: 0, why: "Chọn lọc bằng chứng thuận lợi có thể làm kết luận có vẻ mạnh hơn thực tế.", insight: "Hãy chủ động tìm phản ví dụ và tiêu chí chọn dữ liệu trước khi kết luận." },
    { id: "thinking-pause", topic: "thinking", difficulty: "foundation", skill: "Trải nghiệm game", q: "Phím nào thường được game trên máy tính dùng để mở menu tạm dừng?", choices: ["Escape", "Caps Lock", "Print Screen", "Num Lock"], answer: 0, why: "Escape là quy ước phổ biến để mở menu pause hoặc quay lại màn trước.", insight: "Game tốt vẫn nên cho phép đổi phím và hiển thị lệnh điều khiển rõ ràng." },
    { id: "thinking-correlation", topic: "thinking", difficulty: "foundation", skill: "Lập luận", q: "Hai biến thay đổi cùng nhau có đủ để kết luận biến này gây ra biến kia không?", choices: ["Luôn đủ", "Không; tương quan chưa chứng minh quan hệ nhân quả", "Chỉ cần biểu đồ đẹp", "Đủ nếu mẫu rất nhỏ"], answer: 1, why: "Tương quan có thể do biến thứ ba, chiều tác động ngược hoặc ngẫu nhiên.", insight: "Lập luận nhân quả cần thiết kế nghiên cứu và bằng chứng bổ sung." },
    { id: "thinking-sample", topic: "thinking", difficulty: "foundation", skill: "Đánh giá dữ liệu", q: "Khảo sát mức hài lòng của cả trường nhưng chỉ hỏi câu lạc bộ yêu thích trường dễ mắc lỗi gì?", choices: ["Mẫu không đại diện", "Dữ liệu quá ngẫu nhiên", "Không có biến", "Đơn vị đo quá nhỏ"], answer: 0, why: "Nhóm được hỏi có thể tích cực hơn trung bình nên không đại diện cho toàn trường.", insight: "Cách chọn mẫu thường quan trọng không kém số lượng người tham gia." },
    { id: "thinking-claim", topic: "thinking", difficulty: "foundation", skill: "Kiểm chứng", q: "Khi gặp một tuyên bố gây sốc trên mạng, bước đầu hợp lý nhất là gì?", choices: ["Chia sẻ ngay", "Kiểm tra nguồn gốc và đối chiếu nguồn độc lập", "Chỉ đọc tiêu đề", "Tin nếu có nhiều biểu tượng cảm xúc"], answer: 1, why: "Kiểm tra nguồn ban đầu, ngày tháng và các nguồn độc lập giúp giảm nguy cơ lan truyền thông tin sai.", insight: "Số lượt chia sẻ không phải bằng chứng về độ chính xác." },
    { id: "thinking-base-rate", topic: "thinking", difficulty: "advanced", skill: "Suy luận xác suất", q: "Một bệnh rất hiếm có xét nghiệm khá chính xác. Khi kết quả dương tính, thông tin nào vẫn rất cần để ước lượng khả năng thật sự mắc bệnh?", choices: ["Màu máy xét nghiệm", "Tỷ lệ nền của bệnh và sai số xét nghiệm", "Tên người nhập dữ liệu", "Giờ mở cửa phòng khám"], answer: 1, why: "Giá trị dự đoán phụ thuộc cả độ nhạy, độ đặc hiệu và tỷ lệ bệnh trong quần thể.", insight: "Bỏ qua base rate có thể khiến ta đánh giá quá cao ý nghĩa của một kết quả dương tính." },
    { id: "thinking-falsifiable", topic: "thinking", difficulty: "advanced", skill: "Phương pháp khoa học", q: "Đặc điểm nào làm một giả thuyết dễ kiểm tra khoa học hơn?", choices: ["Không thể bị phản bác trong mọi trường hợp", "Đưa ra dự đoán có thể quan sát và có khả năng sai", "Dùng từ ngữ càng mơ hồ càng tốt", "Chỉ dựa trên uy tín người nói"], answer: 1, why: "Một giả thuyết kiểm chứng được cần dự đoán rõ để bằng chứng có thể ủng hộ hoặc bác bỏ.", insight: "Khả năng sai không làm giả thuyết yếu; nó làm quá trình kiểm tra minh bạch hơn." },
    { id: "thinking-tradeoff", topic: "thinking", difficulty: "advanced", skill: "Ra quyết định", q: "Khi hai phương án đều có lợi ích và chi phí, cách so sánh nào tốt nhất?", choices: ["Chỉ nhìn lợi ích dễ thấy", "Đặt tiêu chí, trọng số và xem độ nhạy của kết quả", "Chọn phương án đầu tiên", "Bỏ qua tác động dài hạn"], answer: 1, why: "Tiêu chí minh bạch và phân tích độ nhạy giúp thấy quyết định thay đổi ra sao khi giả định thay đổi.", insight: "Một quyết định tốt có thể vẫn cho kết quả xấu; chất lượng quy trình khác với may rủi của kết quả." },
    { id: "thinking-ai", topic: "thinking", difficulty: "advanced", skill: "AI literacy", q: "Vì sao câu trả lời trôi chảy của AI vẫn cần được kiểm tra nguồn?", choices: ["Vì AI luôn từ chối trả lời", "Vì độ trôi chảy không bảo đảm dữ kiện đúng hoặc còn mới", "Vì AI không thể tạo câu", "Vì mọi nguồn trên mạng đều giống nhau"], answer: 1, why: "Mô hình có thể tạo nội dung hợp lý về ngôn ngữ nhưng sai dữ kiện, thiếu bối cảnh hoặc lỗi thời.", insight: "Mức kiểm chứng nên tăng theo độ mới, độ khó và hậu quả của quyết định." },
    { id: "thinking-evidence", topic: "thinking", difficulty: "advanced", skill: "Tổng hợp bằng chứng", q: "Hai nghiên cứu đáng tin cho kết quả khác nhau. Phản ứng nào hợp lý nhất?", choices: ["Chọn nghiên cứu hợp ý mình", "So thiết kế, mẫu, độ bất định và tìm tổng quan hệ thống", "Kết luận khoa học vô dụng", "Cộng hai con số không cần ngữ cảnh"], answer: 1, why: "Khác biệt có thể đến từ quần thể, phương pháp, sai số hoặc ngẫu nhiên; cần so sánh có cấu trúc.", insight: "Bất đồng bằng chứng là lý do để phân tích sâu hơn, không phải để bỏ qua toàn bộ bằng chứng." }
  ]);

  const STORY = {
    intro: { title: "Ga cuối của Ánh Sao", text: "Bạn tỉnh dậy trên một đoàn tàu đang dừng giữa khoảng không. Trước mặt là hai toa còn phát sáng.", choices: [["Vào toa lưu trữ", "archive"], ["Đi tới buồng lái", "cockpit"]] },
    archive: { title: "Kho ký ức", text: "Một bản đồ cũ cho thấy đoàn tàu chỉ có đủ năng lượng để mở một trong hai cổng dịch chuyển.", choices: [["Mang bản đồ tới buồng lái", "map"], ["Tìm nguồn điện dự phòng", "battery"]] },
    cockpit: { title: "Buồng lái im lặng", text: "Máy điều hướng yêu cầu một tọa độ. Bạn có thể tin vào tín hiệu lạ hoặc quay lại tìm bản đồ.", choices: [["Theo tín hiệu lạ", "signal"], ["Quay lại kho lưu trữ", "archive"]] },
    map: { title: "Tọa độ quê nhà", text: "Bản đồ và máy lái khớp nhau. Cánh cổng xanh mở ra con đường trở về Trái Đất.", end: "Kết thúc: Người tìm đường" },
    battery: { title: "Khu vườn ngủ quên", text: "Nguồn điện dự phòng đánh thức một khu vườn sinh học. Bạn chọn ở lại để gìn giữ sự sống cuối cùng trên tàu.", end: "Kết thúc: Người giữ mầm xanh" },
    signal: { title: "Lời chào từ xa", text: "Tín hiệu dẫn tới một trạm cứu hộ. Những người sống sót khác đã chờ bạn từ rất lâu.", end: "Kết thúc bí mật: Cuộc hội ngộ" }
  };

  const ESCAPE_STAGES = [
    { title: "Khóa quỹ đạo", clue: "Dãy số: 2 · 4 · 8 · 16 · ?", answer: "32", hints: ["Mỗi số liên quan trực tiếp đến số trước.", "Mỗi bước nhân đôi.", "16 × 2 = 32."] },
    { title: "Bảng chữ đảo", clue: "Sắp xếp lại: A S O", answer: "SAO", hints: ["Đó là vật thể phát sáng trên trời.", "Từ có ba chữ cái và bắt đầu bằng S.", "Đáp án là SAO."] },
    { title: "Mã màu", clue: "Cyan + Magenta trong hệ màu ánh sáng gần với màu nào: XANH / TIM / VANG?", answer: "TIM", hints: ["Đây không phải hệ màu sơn truyền thống.", "Cyan và magenta cùng chia sẻ thành phần xanh lam.", "Nhập TIM, không cần dấu."] }
  ];

  const WORDS = [
    { word: "HANHTINH", clue: "Một thiên thể quay quanh ngôi sao" },
    { word: "AMNHAC", clue: "Nghệ thuật tổ chức âm thanh" },
    { word: "SANGTAO", clue: "Tạo ra điều mới mẻ" },
    { word: "PHANXA", clue: "Khả năng đáp lại tín hiệu nhanh" }
  ];

  let host = null;
  let root = null;
  let options = {};
  let state = null;
  let noticeTimer = 0;
  let arcade = null;
  let rhythm = null;
  let audio = null;
  let pomodoroTimer = 0;
  let pomodoroRemaining = 0;
  let pomodoroEndsAt = 0;
  let memoryState = null;
  let reactionTimer = 0;
  let reactionState = { phase: "idle", startedAt: 0, best: 0 };
  let elementBoard = [];
  let towerState = null;
  let databasePromise = null;
  let persistQueue = Promise.resolve();
  let hydrationPending = false;
  let stateRevision = 0;
  let mountGeneration = 0;
  let rewardSequence = 0;
  let dialogReturnFocus = null;
  let partySocket = null;
  let partySocketHandlers = [];
  let watchMessageHandler = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clean = (value, max = 100) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const randomCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const integer = (value, min, max, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(min, Math.min(max, number))) : fallback;
  };
  const safeTimestamp = (value, fallback = Date.now()) => integer(value, 0, Date.now() + 300000, fallback);
  const validDay = (value) => {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };
  const dayOrdinal = (value) => {
    if (!validDay(value)) return NaN;
    const [year, month, day] = value.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  };
  const trimRewardEntries = (entries, limit) => {
    const sorted = entries.sort((a, b) => safeTimestamp(a[1]?.at, 0) - safeTimestamp(b[1]?.at, 0));
    const pinned = sorted.filter(([key, entry]) => entry?.day === DAY_KEY() && /^(?:puzzle|quiz|daily|escape):/.test(key));
    if (pinned.length >= limit) return pinned.slice(-limit);
    const pinnedKeys = new Set(pinned.map(([key]) => key));
    const remaining = sorted.filter(([key]) => !pinnedKeys.has(key)).slice(-Math.max(0, limit - pinned.length));
    return [...remaining, ...pinned].sort((a, b) => safeTimestamp(a[1]?.at, 0) - safeTimestamp(b[1]?.at, 0));
  };

  function defaultState() {
    return {
      schema: "hh.play.profile",
      schemaVersion: STATE_SCHEMA_VERSION,
      version: VERSION,
      savedAt: 0,
      view: "today",
      xp: 0,
      streak: 1,
      lastVisit: DAY_KEY(),
      sessions: 0,
      scores: {},
      favorites: ["snake", "memory"],
      recent: [],
      history: [],
      rewardLedger: {},
      contentPacks: [],
      achievements: [],
      daily: { day: DAY_KEY(), played: 0, quiz: 0, social: 0, claimed: false },
      party: { rooms: [], activeCode: "", mode: "local-only", realtime: { status: "unavailable", code: "", members: [], revision: 0, lastError: "" } },
      watch: { queue: [], current: "", position: 0, playing: false, rate: 1, hostControl: true },
      story: { node: "intro", history: [], slots: [null, null, null] },
      escape: { stage: 0, hints: 0, completed: false },
      pet: { type: "dragon", name: "Lumi", hunger: 76, happy: 72, energy: 84, xp: 0, level: 1, lastCare: Date.now() },
      chill: { scene: "rain", rain: 55, wind: 20, fire: 0, piano: 0, minutes: 25, timer: { running: false, endsAt: 0, startedAt: 0 } },
      quiz: { index: 0, score: 0, answered: false, selected: -1, completed: false, topic: "all", difficulty: "all" },
      settings: { motion: "balanced", sound: true, inspector: false, safeChat: true },
      arcadeGame: "snake",
      arcade: { difficulty: "normal", runs: [], tutorialSeen: {}, input: "keyboard-touch" },
      wordIndex: 0,
      elementScore: 0
    };
  }

  function migrateState(input) {
    if (!isRecord(input)) return {};
    const migrated = { ...input };
    const version = integer(migrated.schemaVersion, 0, STATE_SCHEMA_VERSION, 0);
    if (version < 2) {
      migrated.schema = "hh.play.profile";
      migrated.schemaVersion = 2;
      migrated.history = Array.isArray(migrated.history) ? migrated.history : [];
      migrated.rewardLedger = isRecord(migrated.rewardLedger) ? migrated.rewardLedger : {};
      migrated.savedAt = safeTimestamp(migrated.savedAt);
    }
    return migrated;
  }

  function sanitizeStorySlot(slot) {
    if (!isRecord(slot) || !STORY[slot.node]) return null;
    return {
      node: slot.node,
      history: (Array.isArray(slot.history) ? slot.history : []).filter((id) => STORY[id]).slice(-20),
      savedAt: safeTimestamp(slot.savedAt)
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    const saved = migrateState(input);
    const merged = {
      ...base, ...saved,
      scores: { ...base.scores, ...(isRecord(saved.scores) ? saved.scores : {}) },
      daily: { ...base.daily, ...(isRecord(saved.daily) ? saved.daily : {}) },
      party: { ...base.party, ...(isRecord(saved.party) ? saved.party : {}) },
      watch: { ...base.watch, ...(isRecord(saved.watch) ? saved.watch : {}) },
      story: { ...base.story, ...(isRecord(saved.story) ? saved.story : {}) },
      escape: { ...base.escape, ...(isRecord(saved.escape) ? saved.escape : {}) },
      pet: { ...base.pet, ...(isRecord(saved.pet) ? saved.pet : {}) },
      chill: { ...base.chill, ...(isRecord(saved.chill) ? saved.chill : {}) },
      quiz: { ...base.quiz, ...(isRecord(saved.quiz) ? saved.quiz : {}) },
      settings: { ...base.settings, ...(isRecord(saved.settings) ? saved.settings : {}) }
    };
    merged.schema = "hh.play.profile";
    merged.schemaVersion = STATE_SCHEMA_VERSION;
    merged.version = VERSION;
    merged.savedAt = safeTimestamp(merged.savedAt, 0);
    merged.view = VIEWS.some((view) => view.id === merged.view) ? merged.view : "today";
    merged.xp = integer(merged.xp, 0, MAX_XP, 0);
    merged.streak = integer(merged.streak, 1, 36500, 1);
    merged.lastVisit = validDay(merged.lastVisit) ? merged.lastVisit : DAY_KEY();
    merged.sessions = integer(merged.sessions, 0, 10000000, 0);
    merged.scores = Object.fromEntries(Object.entries(merged.scores).filter(([key]) => /^[a-z0-9-]{1,32}$/i.test(key)).slice(0, 64).map(([key, value]) => [key, integer(value, 0, MAX_SCORE, 0)]));
    const gameIds = new Set(ARCADE_GAMES.map((game) => game.id));
    merged.favorites = [...new Set((Array.isArray(merged.favorites) ? merged.favorites : []).filter((id) => gameIds.has(id)))].slice(0, 12);
    merged.recent = [...new Set((Array.isArray(merged.recent) ? merged.recent : []).filter((id) => gameIds.has(id)))].slice(0, 6);
    merged.history = (Array.isArray(saved.history) ? saved.history : []).slice(-MAX_HISTORY).map((entry) => ({
      id: clean(entry?.id, 48) || "activity",
      type: ["game", "quiz", "mission", "focus", "social", "system"].includes(entry?.type) ? entry.type : "game",
      score: integer(entry?.score, 0, MAX_SCORE, 0),
      xp: integer(entry?.xp, 0, 10000, 0),
      at: safeTimestamp(entry?.at),
      day: validDay(entry?.day) ? entry.day : localDayKey(new Date(safeTimestamp(entry?.at))),
      rewardKey: clean(entry?.rewardKey, 140)
    }));
    const rewards = Object.entries(isRecord(saved.rewardLedger) ? saved.rewardLedger : {}).map(([key, entry]) => {
      const at = safeTimestamp(isRecord(entry) ? entry.at : 0, 0);
      return [clean(key, 140), { xp: integer(isRecord(entry) ? entry.xp : 0, 0, 10000, 0), at, day: validDay(entry?.day) ? entry.day : DAY_KEY(), type: clean(entry?.type || "reward", 32) }];
    }).filter(([key]) => key);
    const limitedRewards = trimRewardEntries(rewards, MAX_REWARDS);
    merged.rewardLedger = Object.fromEntries(limitedRewards);
    merged.daily = {
      day: validDay(merged.daily.day) ? merged.daily.day : DAY_KEY(),
      played: integer(merged.daily.played, 0, 1000, 0),
      quiz: integer(merged.daily.quiz, 0, 1000, 0),
      social: integer(merged.daily.social, 0, 1000, 0),
      claimed: merged.daily.claimed === true
    };
    merged.party.rooms = (Array.isArray(merged.party.rooms) ? merged.party.rooms : []).slice(0, 12).map((room) => ({
      code: String(room?.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
      name: clean(room?.name || "Phòng HH Play", 48),
      privacy: ["invite", "private", "public-draft"].includes(room?.privacy) ? room.privacy : "invite",
      limit: integer(room?.limit, 2, 8, 2),
      permissions: { chat: room?.permissions?.chat === true, control: room?.permissions?.control === true, spectate: room?.permissions?.spectate === true },
      createdAt: safeTimestamp(room?.createdAt),
      provider: room?.provider === "realtime-server" ? "realtime-server" : "local-device",
      serverCode: String(room?.serverCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
    })).filter((room) => room.code.length === 6);
    merged.party.activeCode = String(merged.party.activeCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!merged.party.rooms.some((room) => room.code === merged.party.activeCode)) merged.party.activeCode = merged.party.rooms[0]?.code || "";
    merged.party.mode = "local-only";
    const realtime = isRecord(saved.party?.realtime) ? saved.party.realtime : {};
    merged.party.realtime = {
      status: ["unavailable", "connecting", "connected", "offline"].includes(realtime.status) ? realtime.status : "unavailable",
      code: String(realtime.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
      members: (Array.isArray(realtime.members) ? realtime.members : []).slice(0, 32).map((member) => ({ id: clean(member?.id, 120), name: clean(member?.name || "Thành viên", 80), role: ["host", "player", "spectator"].includes(member?.role) ? member.role : "player" })).filter((member) => member.id),
      revision: integer(realtime.revision, 0, MAX_SCORE, 0),
      lastError: clean(realtime.lastError, 180)
    };
    merged.watch.queue = (Array.isArray(merged.watch.queue) ? merged.watch.queue : []).slice(0, 24).map((item) => ({ id: /^[A-Za-z0-9_-]{11}$/.test(item?.id || "") ? item.id : "", title: clean(item?.title, 80), addedAt: safeTimestamp(item?.addedAt), source: "youtube-nocookie" })).filter((item) => item.id);
    merged.watch.current = /^[A-Za-z0-9_-]{11}$/.test(merged.watch.current || "") && merged.watch.queue.some((item) => item.id === merged.watch.current) ? merged.watch.current : merged.watch.queue[0]?.id || "";
    merged.watch.position = integer(merged.watch.position, 0, 86400, 0);
    merged.watch.playing = merged.watch.playing === true;
    merged.watch.rate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(merged.watch.rate)) ? Number(merged.watch.rate) : 1;
    merged.watch.hostControl = merged.watch.hostControl !== false;
    merged.story.node = STORY[merged.story.node] ? merged.story.node : "intro";
    merged.story.history = (Array.isArray(merged.story.history) ? merged.story.history : []).filter((id) => STORY[id]).slice(-20);
    merged.story.slots = (Array.isArray(merged.story.slots) ? merged.story.slots : []).slice(0, 3).map(sanitizeStorySlot);
    while (merged.story.slots.length < 3) merged.story.slots.push(null);
    merged.escape = { stage: integer(merged.escape.stage, 0, ESCAPE_STAGES.length, 0), hints: integer(merged.escape.hints, 0, 3, 0), completed: merged.escape.completed === true };
    merged.pet = {
      type: clean(merged.pet.type || "dragon", 20) || "dragon", name: clean(merged.pet.name || "Lumi", 20) || "Lumi",
      hunger: integer(merged.pet.hunger, 0, 100, 76), happy: integer(merged.pet.happy, 0, 100, 72), energy: integer(merged.pet.energy, 0, 100, 84),
      xp: integer(merged.pet.xp, 0, 1000000, 0), level: 1, lastCare: safeTimestamp(merged.pet.lastCare)
    };
    merged.pet.level = Math.floor(merged.pet.xp / 100) + 1;
    merged.chill = {
      scene: ["rain", "cafe", "forest", "fire", "ocean"].includes(merged.chill.scene) ? merged.chill.scene : "rain",
      rain: integer(merged.chill.rain, 0, 100, 55), wind: integer(merged.chill.wind, 0, 100, 20), fire: integer(merged.chill.fire, 0, 100, 0), piano: integer(merged.chill.piano, 0, 100, 0), minutes: integer(merged.chill.minutes, 5, 120, 25),
      timer: {
        running: merged.chill?.timer?.running === true,
        endsAt: safeTimestamp(merged.chill?.timer?.endsAt, 0),
        startedAt: safeTimestamp(merged.chill?.timer?.startedAt, 0)
      }
    };
    merged.quiz = {
      index: integer(merged.quiz.index, 0, 239, 0), score: integer(merged.quiz.score, 0, 240, 0),
      answered: merged.quiz.answered === true, selected: integer(merged.quiz.selected, -1, 3, -1), completed: merged.quiz.completed === true,
      topic: QUIZ_TOPICS.some((item) => item.id === merged.quiz.topic) ? merged.quiz.topic : "all",
      difficulty: QUIZ_DIFFICULTIES.some((item) => item.id === merged.quiz.difficulty) ? merged.quiz.difficulty : "all"
    };
    merged.settings = {
      motion: ["static", "balanced", "cinematic"].includes(merged.settings.motion) ? merged.settings.motion : "balanced",
      sound: merged.settings.sound !== false, inspector: merged.settings.inspector !== false, safeChat: merged.settings.safeChat !== false
    };
    merged.arcadeGame = gameIds.has(merged.arcadeGame) ? merged.arcadeGame : "snake";
    const difficultyIds = new Set(ARCADE_DIFFICULTIES.map((item) => item.id));
    const savedArcade = isRecord(saved.arcade) ? saved.arcade : {};
    merged.arcade = {
      difficulty: difficultyIds.has(savedArcade.difficulty) ? savedArcade.difficulty : "normal",
      input: ["keyboard-touch", "keyboard", "touch", "gamepad"].includes(savedArcade.input) ? savedArcade.input : "keyboard-touch",
      tutorialSeen: Object.fromEntries(Object.entries(isRecord(savedArcade.tutorialSeen) ? savedArcade.tutorialSeen : {}).filter(([key, value]) => gameIds.has(key) && value === true).slice(0, 32)),
      runs: (Array.isArray(savedArcade.runs) ? savedArcade.runs : []).slice(-40).map((run) => ({
        id: clean(run?.id, 60) || `run-${safeTimestamp(run?.at)}`,
        game: gameIds.has(run?.game) ? run.game : "snake",
        difficulty: difficultyIds.has(run?.difficulty) ? run.difficulty : "normal",
        score: integer(run?.score, 0, MAX_SCORE, 0),
        duration: integer(run?.duration, 0, 86400, 0),
        won: run?.won === true,
        at: safeTimestamp(run?.at)
      }))
    };
    merged.wordIndex = integer(merged.wordIndex, 0, 239, 0);
    merged.elementScore = integer(merged.elementScore, 0, MAX_SCORE, 0);
    const packTypes = new Set(["quiz", "story", "escape", "word"]);
    merged.contentPacks = (Array.isArray(saved.contentPacks) ? saved.contentPacks : []).slice(-MAX_CONTENT_PACKS).map((pack) => {
      const items = Array.isArray(pack?.items) ? pack.items.slice(0, 120).map((item) => {
        if (pack.type === "quiz") return { q: clean(item?.q, 300), choices: (Array.isArray(item?.choices) ? item.choices : []).slice(0, 4).map((choice) => clean(choice, 120)), answer: integer(item?.answer, 0, 3, 0), why: clean(item?.why, 500) };
        if (pack.type === "word") return { word: clean(item?.word, 40).toUpperCase(), clue: clean(item?.clue, 180) };
        return { title: clean(item?.title, 120), text: clean(item?.text, 800), answer: clean(item?.answer, 120), choices: (Array.isArray(item?.choices) ? item.choices : []).slice(0, 4).map((choice) => clean(choice, 120)) };
      }).filter((item) => Object.values(item).some((value) => Array.isArray(value) ? value.length : value)) : [];
      return { id: clean(pack?.id, 80) || `pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: clean(pack?.title || "Bộ nội dung HH", 120) || "Bộ nội dung HH", type: packTypes.has(pack?.type) ? pack.type : "quiz", items, createdAt: safeTimestamp(pack?.createdAt) };
    }).filter((pack) => pack.items.length);
    const achievementIds = new Set(ACHIEVEMENTS.map((item) => item.id));
    merged.achievements = [...new Set((Array.isArray(saved.achievements) ? saved.achievements : []).filter((id) => achievementIds.has(id)))].slice(0, ACHIEVEMENTS.length);
    const allowed = new Set(Object.keys(base));
    Object.keys(merged).forEach((key) => { if (!allowed.has(key)) delete merged[key]; });
    return merged;
  }

  function rollLocalDay(profile) {
    const today = DAY_KEY();
    const distance = dayOrdinal(today) - dayOrdinal(profile.lastVisit);
    if (distance === 1) profile.streak = integer(profile.streak + 1, 1, 36500, 1);
    else if (distance > 1) profile.streak = 1;
    profile.lastVisit = today;
    if (profile.daily.day !== today) profile.daily = { day: today, played: 0, quiz: 0, social: 0, claimed: false };
    return profile;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return rollLocalDay(normalizeState(saved));
    } catch {
      return rollLocalDay(normalizeState(null));
    }
  }

  function fallbackState(profile) {
    const rewards = trimRewardEntries(Object.entries(profile.rewardLedger || {}), 120);
    const contentPacks = (profile.contentPacks || []).slice(-4).map((pack) => ({ ...pack, items: (pack.items || []).slice(0, 24) }));
    return { ...profile, contentPacks, history: (profile.history || []).slice(-24), rewardLedger: Object.fromEntries(rewards) };
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    databasePromise = new Promise((resolve) => {
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); } catch { resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return databasePromise;
  }

  async function databaseGet(storeName, key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      let request;
      try { request = db.transaction(storeName, "readonly").objectStore(storeName).get(key); } catch { resolve(null); return; }
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async function databaseGetAll(storeName) {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise((resolve) => {
      let request;
      try { request = db.transaction(storeName, "readonly").objectStore(storeName).getAll(); } catch { resolve([]); return; }
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => resolve([]);
    });
  }

  async function databasePut(storeName, value) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      let transaction;
      try { transaction = db.transaction(storeName, "readwrite"); transaction.objectStore(storeName).put(value); } catch { resolve(false); return; }
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  }

  async function databaseDelete(storeName, key) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise((resolve) => {
      let transaction;
      try { transaction = db.transaction(storeName, "readwrite"); transaction.objectStore(storeName).delete(key); } catch { resolve(false); return; }
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  }

  function persistIndexedState(profile) {
    const payload = JSON.parse(JSON.stringify(profile));
    persistQueue = persistQueue.then(() => databasePut(PROFILE_STORE, { id: PROFILE_ID, savedAt: payload.savedAt, profile: payload })).catch(() => false);
  }

  function save() {
    if (!state) return;
    state = rollLocalDay(normalizeState(state));
    state.savedAt = Date.now();
    stateRevision += 1;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackState(state))); } catch {}
    if (!hydrationPending) persistIndexedState(state);
  }

  async function hydrateIndexedState(generation, revisionAtStart, fallbackSavedAt, requestedView = "") {
    const record = await databaseGet(PROFILE_STORE, PROFILE_ID);
    if (generation !== mountGeneration || !state) return;
    if (isRecord(record?.profile) && safeTimestamp(record.savedAt, 0) >= safeTimestamp(fallbackSavedAt, 0)) {
      const indexed = rollLocalDay(normalizeState(record.profile));
      if (stateRevision === revisionAtStart) state = indexed;
      else {
        const current = normalizeState(state);
        current.xp = Math.max(current.xp, indexed.xp);
        current.sessions = Math.max(current.sessions, indexed.sessions);
        current.scores = Object.fromEntries([...new Set([...Object.keys(indexed.scores), ...Object.keys(current.scores)])].map((key) => [key, Math.max(indexed.scores[key] || 0, current.scores[key] || 0)]));
        current.rewardLedger = { ...indexed.rewardLedger, ...current.rewardLedger };
        const activity = new Map();
        [...indexed.history, ...current.history].forEach((entry) => activity.set(`${entry.at}:${entry.id}:${entry.rewardKey}`, entry));
        current.history = [...activity.values()].sort((a, b) => a.at - b.at).slice(-MAX_HISTORY);
        state = normalizeState(current);
      }
      if (VIEWS.some((view) => view.id === requestedView)) state.view = requestedView;
      render();
    }
    hydrationPending = false;
    save();
  }

  function appendHistory(entry) {
    if (!state) return;
    state.history = [...(Array.isArray(state.history) ? state.history : []), {
      id: clean(entry.id, 48) || "activity",
      type: ["game", "quiz", "mission", "focus", "social", "system"].includes(entry.type) ? entry.type : "game",
      score: integer(entry.score, 0, MAX_SCORE, 0),
      xp: integer(entry.xp, 0, 10000, 0),
      at: Date.now(), day: DAY_KEY(), rewardKey: clean(entry.rewardKey, 140)
    }].slice(-MAX_HISTORY);
  }

  function uniqueRewardKey(prefix) {
    rewardSequence = (rewardSequence + 1) % 1000000;
    return `${clean(prefix, 70) || "reward"}:${DAY_KEY()}:${Date.now().toString(36)}:${rewardSequence.toString(36)}`;
  }

  function grantXP(rewardKey, amount, metadata = {}) {
    if (!state) return 0;
    state = rollLocalDay(normalizeState(state));
    const key = clean(rewardKey, 140);
    const xp = integer(amount, 0, 10000, 0);
    if (!key || !xp || state.rewardLedger[key]) return 0;
    state.xp = integer(state.xp + xp, 0, MAX_XP, MAX_XP);
    state.rewardLedger[key] = { xp, at: Date.now(), day: DAY_KEY(), type: clean(metadata.type || "reward", 32) };
    const entries = trimRewardEntries(Object.entries(state.rewardLedger), MAX_REWARDS);
    state.rewardLedger = Object.fromEntries(entries);
    if (metadata.history !== false) appendHistory({ ...metadata, xp, rewardKey: key });
    return xp;
  }

  async function createSnapshot(label = "Điểm khôi phục thủ công") {
    if (!state) return false;
    const createdAt = Date.now();
    const snapshot = {
      id: `snapshot-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt, label: clean(label, 80) || "Điểm khôi phục", profile: JSON.parse(JSON.stringify(normalizeState(state)))
    };
    try { localStorage.setItem(RECOVERY_KEY, JSON.stringify(snapshot)); } catch {}
    const stored = await databasePut(SNAPSHOT_STORE, snapshot);
    if (stored) {
      const snapshots = (await databaseGetAll(SNAPSHOT_STORE)).sort((a, b) => safeTimestamp(b.createdAt, 0) - safeTimestamp(a.createdAt, 0));
      await Promise.all(snapshots.slice(8).map((item) => databaseDelete(SNAPSHOT_STORE, item.id)));
    }
    return true;
  }

  async function latestSnapshot() {
    const candidates = await databaseGetAll(SNAPSHOT_STORE);
    try {
      const fallback = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "null");
      if (isRecord(fallback)) candidates.push(fallback);
    } catch {}
    return candidates.filter((item) => isRecord(item?.profile)).sort((a, b) => safeTimestamp(b.createdAt, 0) - safeTimestamp(a.createdAt, 0))[0] || null;
  }

  async function restoreLatestSnapshot() {
    const snapshot = await latestSnapshot();
    if (!snapshot) { toast("Chưa có điểm khôi phục nào.", true); return false; }
    await createSnapshot("Trước khi khôi phục dữ liệu");
    state = rollLocalDay(normalizeState(snapshot.profile));
    appendHistory({ id: "restore", type: "system", xp: 0, rewardKey: "" });
    save();
    render();
    toast(`Đã khôi phục: ${clean(snapshot.label, 80) || "bản gần nhất"}.`);
    return true;
  }

  function exportPlayData(download = true) {
    if (!state) return "";
    const payload = {
      format: "hh-play-profile",
      schemaVersion: STATE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local-device",
      profile: normalizeState(state)
    };
    const json = JSON.stringify(payload, null, 2);
    if (download && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function" && typeof document !== "undefined") {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = `hh-play-${DAY_KEY()}.json`; link.hidden = true;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return json;
  }

  async function importPlayData(payload) {
    let parsed = payload;
    if (typeof payload === "string") {
      const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(payload).byteLength : payload.length * 2;
      if (bytes > MAX_IMPORT_BYTES) throw new Error("Tệp vượt quá giới hạn 2 MB.");
      parsed = JSON.parse(payload);
    }
    else {
      try { const serialized = JSON.stringify(payload); if (!serialized || serialized.length > MAX_IMPORT_BYTES) throw new Error("Dữ liệu vượt quá giới hạn 2 MB."); }
      catch (error) { throw new Error(error?.message || "Dữ liệu nhập không hợp lệ."); }
    }
    const candidate = isRecord(parsed?.profile) ? parsed.profile : parsed;
    if (!isRecord(candidate)) throw new Error("Dữ liệu HH Play không hợp lệ.");
    if (parsed?.format && parsed.format !== "hh-play-profile") throw new Error("Định dạng tệp không được hỗ trợ.");
    await createSnapshot("Trước khi nhập dữ liệu");
    state = rollLocalDay(normalizeState(candidate));
    appendHistory({ id: "import", type: "system", xp: 0, rewardKey: "" });
    save();
    render();
    toast("Đã nhập và kiểm tra dữ liệu HH Play.");
    return true;
  }

  function viewMeta(id = state?.view) {
    return VIEWS.find((item) => item.id === id) || VIEWS[0];
  }

  function quizCatalog() {
    const custom = (state?.contentPacks || []).filter((pack) => pack.type === "quiz").flatMap((pack, packIndex) => (pack.items || []).map((item, itemIndex) => ({
      id: clean(item.id, 60) || `custom-${packIndex + 1}-${itemIndex + 1}`,
      topic: QUIZ_TOPICS.some((topic) => topic.id !== "all" && topic.id === item.topic) ? item.topic : "custom",
      difficulty: QUIZ_DIFFICULTIES.some((level) => level.id !== "all" && level.id === item.difficulty) ? item.difficulty : "foundation",
      skill: clean(item.skill, 80) || "Kiến thức riêng",
      q: clean(item.q, 300),
      choices: (Array.isArray(item.choices) ? item.choices : []).map((choice) => clean(choice, 120)).filter(Boolean).slice(0, 4),
      answer: integer(item.answer, 0, 3, 0),
      why: clean(item.why, 500) || "Nội dung giải thích chưa được tác giả gói bổ sung.",
      insight: clean(item.insight, 500) || "Hãy đối chiếu thêm nguồn tin cậy để mở rộng kết luận."
    }))).filter((item) => item.q && item.choices.length >= 2 && item.answer < item.choices.length);
    return [...QUIZ, ...custom].slice(0, 240);
  }

  function quizBank() {
    const catalog = quizCatalog();
    const topic = state?.quiz?.topic || "all";
    const difficulty = state?.quiz?.difficulty || "all";
    const filtered = catalog.filter((item) => (topic === "all" || item.topic === topic) && (difficulty === "all" || item.difficulty === difficulty));
    return filtered.length ? filtered : catalog;
  }
  function wordBank() {
    const custom = (state?.contentPacks || []).filter((pack) => pack.type === "word").flatMap((pack) => pack.items || []).map((item) => ({ word: clean(item.word, 40).toUpperCase().replace(/[^A-Z0-9À-Ỹ]/gi, ""), clue: clean(item.clue, 180) })).filter((item) => item.word && item.clue);
    return [...WORDS, ...custom].slice(0, 240);
  }

  function missionProgress() {
    const completed = Number(state.daily.played >= 1) + Number(state.daily.quiz >= 1) + Number(state.daily.social >= 1);
    return { completed, percent: Math.round(completed / 3 * 100) };
  }

  function setView(next, updateHash = true) {
    if (!VIEWS.some((item) => item.id === next)) next = "today";
    cleanupRuntime();
    state.view = next;
    save();
    if (updateHash && location.hash !== `#/play/${next}`) history.replaceState({}, document.title, `${location.pathname}${location.search}#/play/${next}`);
    render();
  }

  function render() {
    if (!host || !state) return;
    const previousRoot = root;
    const previousView = previousRoot?.dataset?.view || "";
    const previousScroll = previousRoot?.querySelector(".hhp-stage-scroll")?.scrollTop || 0;
    const focused = typeof document !== "undefined" ? document.activeElement : null;
    const cssEscape = (value) => typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "");
    const focusSelector = focused && previousRoot?.contains?.(focused)
      ? (focused.dataset?.focusKey ? `[data-focus-key="${cssEscape(focused.dataset.focusKey)}"]` : focused.name ? `[name="${cssEscape(focused.name)}"]` : "")
      : "";
    const meta = viewMeta();
    root = document.createElement("section");
    root.className = "hh-play";
    root.dataset.view = state.view;
    root.dataset.motion = state.settings.motion;
    root.style.setProperty("--hhp-view", meta.color);
    root.innerHTML = `
      <div class="hhp-ambient" aria-hidden="true">${Array.from({ length: 14 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}<b></b><em></em></div>
      ${topbar(meta)}
      <div class="hhp-grid">
        ${sidebar()}
        <main class="hhp-stage"><div class="hhp-stage-scroll">${renderView()}</div></main>
        ${inspector(meta)}
      </div>
      ${actionbar(meta)}
      ${mobileNav()}
      <div class="hhp-toast" role="status" aria-live="polite" hidden></div>`;
    host.replaceChildren(root);
    bind();
    activateViewRuntime();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
      if (!root) return;
      const stage = root.querySelector(".hhp-stage-scroll");
      if (stage && previousView === state.view) stage.scrollTop = previousScroll;
      if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
    });
  }

  function topbar(meta) {
    const progress = missionProgress();
    return `<header class="hhp-topbar">
      <button class="hhp-brand" type="button" data-play-view="today" aria-label="Về HH Play hôm nay"><i>HP</i><span><small>ENTERTAINMENT OS</small><strong>HH Play</strong></span></button>
      <div class="hhp-search-wrap"><label class="hhp-search"><span>⌕</span><input type="search" data-play-search placeholder="Tìm trò chơi, phòng hoặc trải nghiệm…" autocomplete="off" aria-controls="hhp-search-suggestions"><kbd>Ctrl K</kbd></label><div id="hhp-search-suggestions" class="hhp-search-suggestions" data-search-suggestions hidden></div></div>
      <div class="hhp-top-actions">
        <button type="button" data-play-view="today"><i>${progress.completed}/3</i><span>Nhiệm vụ ngày</span></button>
        <button type="button" data-play-inspector-toggle aria-pressed="${state.settings.inspector}"><i>◎</i><span>Tóm tắt</span></button>
        <div class="hhp-profile"><i>${esc(initials())}</i><span><small>Cấp ${level()}</small><strong>${state.xp} XP</strong></span></div>
      </div>
    </header>`;
  }

  function sidebar() {
    return `<aside class="hhp-sidebar" aria-label="Danh mục HH Play"><header><span>KHÁM PHÁ</span><small>10 trải nghiệm</small></header><nav>${VIEWS.map((item) => `<button type="button" data-play-view="${item.id}" class="${item.id === state.view ? "is-active" : ""}" style="--item:${item.color}"><i>${item.icon}</i><span><strong>${item.title}</strong><small>${item.note}</small></span><b>›</b></button>`).join("")}</nav><footer><span>● Local-first</span><small>Không giả người online</small></footer></aside>`;
  }

  function inspector(meta) {
    const progress = missionProgress();
    const best = Object.values(state.scores).reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    return `<aside class="hhp-inspector ${state.settings.inspector ? "is-open" : ""}" aria-label="Tóm tắt HH Play"><header><span>TÓM TẮT</span><button type="button" data-play-inspector-toggle aria-label="Đóng tóm tắt">×</button></header><section class="hhp-now"><i style="--now:${meta.color}">${meta.icon}</i><div><small>Đang mở</small><strong>${meta.title}</strong><span>${meta.note}</span></div></section><div class="hhp-stat-grid"><article><small>Cấp</small><strong>${level()}</strong></article><article><small>XP</small><strong>${state.xp}</strong></article><article><small>Kỷ lục</small><strong>${best}</strong></article><article><small>Chuỗi</small><strong>${state.streak} ngày</strong></article></div><section class="hhp-mission-mini"><header><strong>Nhiệm vụ hôm nay</strong><span>${progress.percent}%</span></header><div><i style="width:${progress.percent}%"></i></div><ul><li class="${state.daily.played ? "is-done" : ""}">Chơi một trò</li><li class="${state.daily.quiz ? "is-done" : ""}">Trả lời Quiz</li><li class="${state.daily.social ? "is-done" : ""}">Tạo phòng local</li></ul></section><section class="hhp-inspector-links"><button type="button" data-play-action="content">✧ ${state.contentPacks.length} gói nội dung riêng</button><button type="button" data-play-action="settings">⚙ Quản lý dữ liệu</button></section><section class="hhp-trust"><strong>Riêng tư mặc định</strong><p>Điểm, pet, phòng nháp và hàng đợi chỉ lưu trên thiết bị này. Không công khai hồ sơ nếu bạn chưa chủ động chia sẻ.</p></section></aside>`;
  }

  function actionbar(meta) {
    const primary = ({ today: ["arcade", "Chơi ngay"], arcade: ["arcade-start", "Bắt đầu"], party: ["party-focus", "Tạo phòng"], watch: ["watch-focus", "Thêm video"], story: ["story-reset", "Chơi lại truyện"], escape: ["escape-focus", "Nhập mật mã"], rhythm: ["rhythm-start", "Bắt đầu nhịp"], pet: ["pet-play", "Chơi với pet"], chill: ["chill-toggle", "Bật âm cảnh"], quiz: ["quiz-next", "Câu tiếp theo"] })[state.view] || ["today", "Về Hôm nay"];
    return `<footer class="hhp-actionbar"><div><button type="button" data-play-action="exit">⌂ <span>Thoát</span></button><button type="button" data-play-action="invite">↗ <span>Mời bạn</span></button><button type="button" data-play-action="content">✧ <span>Nội dung</span></button><button type="button" data-play-action="settings">⚙ <span>Cài đặt</span></button><button type="button" data-play-action="fullscreen">⛶ <span>Toàn màn hình</span></button><button type="button" data-play-action="restart">↻ <span>Chơi lại</span></button></div><span><i style="background:${meta.color}"></i>${meta.title}</span><button class="hhp-primary" type="button" data-play-action="${primary[0]}">${primary[1]} →</button></footer>`;
  }

  function mobileNav() {
    const items = [VIEWS[0], VIEWS[1], VIEWS[2], VIEWS[8]];
    return `<nav class="hhp-mobile-nav">${items.map((item) => `<button type="button" data-play-view="${item.id}" class="${item.id === state.view ? "is-active" : ""}"><i>${item.icon}</i><span>${item.title.split(" ")[0]}</span></button>`).join("")}<button type="button" data-play-mobile-more><i>•••</i><span>Thêm</span></button></nav>`;
  }

  function renderView() {
    if (state.view === "today") return todayView();
    if (state.view === "arcade") return arcadeView();
    if (state.view === "party") return partyView();
    if (state.view === "watch") return watchView();
    if (state.view === "story") return storyView();
    if (state.view === "escape") return escapeView();
    if (state.view === "rhythm") return rhythmView();
    if (state.view === "pet") return petView();
    if (state.view === "chill") return chillView();
    return quizView();
  }

  function heading(kicker, title, text, badge = "") {
    return `<header class="hhp-view-head"><div><span>${kicker}</span><h2>${title}</h2><p>${text}</p></div>${badge ? `<b>${badge}</b>` : ""}</header>`;
  }

  function todayView() {
    const progress = missionProgress();
    const recent = state.recent.map((id) => ARCADE_GAMES.find((game) => game.id === id)).filter(Boolean).slice(0, 4);
    const continueGame = recent[0] || ARCADE_GAMES[0];
    const quizCount = quizCatalog().length;
    return `<section class="hhp-view hhp-today">${heading("DAILY ENTERTAINMENT", "Một điểm bắt đầu, nhiều cách để vui", "Chọn nhiệm vụ ngắn phù hợp hoặc tiếp tục trải nghiệm gần nhất.", `${state.streak} ngày`) }
      <nav class="hhp-command-deck" aria-label="Truy cập nhanh HH Play"><button type="button" data-game="${continueGame.id}"><i>▶</i><span><small>TIẾP TỤC</small><strong>${esc(continueGame.title)}</strong></span><b>→</b></button><button type="button" data-play-view="quiz"><i>?</i><span><small>KHO TRI THỨC</small><strong>${quizCount} câu có giải thích</strong></span><b>→</b></button><button type="button" data-play-action="content"><i>✧</i><span><small>CONTENT PACK</small><strong>${state.contentPacks.length} gói nội dung riêng</strong></span><b>→</b></button><article><i>◆</i><span><small>HỒ SƠ HOẠT ĐỘNG</small><strong>${state.achievements.length}/${ACHIEVEMENTS.length} huy hiệu · ${state.history.length} lượt</strong></span></article></nav>
      <article class="hhp-hero-card"><div class="hhp-hero-orbit" aria-hidden="true"><i></i><i></i><i></i><b>PLAY</b></div><div><small>GỢI Ý TIẾP THEO · 3–5 PHÚT</small><h3>${state.daily.played ? "Thử một nhánh truyện mới" : "Neon Snake đang chờ bạn"}</h3><p>${state.daily.played ? "Mỗi lựa chọn được lưu trên thiết bị và có thể quay lại bằng ba ô lưu riêng." : "Điều khiển bằng phím mũi tên hoặc nút cảm ứng; không cần tải thêm tài nguyên."}</p><button type="button" data-play-view="${state.daily.played ? "story" : "arcade"}">${state.daily.played ? "Mở Story Universe" : "Chơi ngay"} →</button></div></article>
      <div class="hhp-daily-grid"><article><header><i>▣</i><span><strong>Chơi một trò</strong><small>Arcade hoặc Rhythm</small></span><b>${state.daily.played ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.played ? 100 : 0}%"></i></div></article><article><header><i>?</i><span><strong>Trả lời Quiz</strong><small>Một câu có giải thích</small></span><b>${state.daily.quiz ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.quiz ? 100 : 0}%"></i></div></article><article><header><i>◎</i><span><strong>Tạo phòng local</strong><small>Chuẩn bị quyền trước khi chia sẻ</small></span><b>${state.daily.social ? "✓" : "0/1"}</b></header><div><i style="width:${state.daily.social ? 100 : 0}%"></i></div></article></div>
      <div class="hhp-section-title"><div><span>TIẾN ĐỘ HÔM NAY</span><strong>${progress.completed}/3 hoàn thành</strong></div><div class="hhp-progress"><i style="width:${progress.percent}%"></i></div>${progress.completed === 3 ? `<button type="button" data-play-claim ${state.daily.claimed ? "disabled" : ""}>${state.daily.claimed ? "Đã nhận huy hiệu" : "Nhận huy hiệu ngày"}</button>` : ""}</div>
      <section class="hhp-quick-grid">${(recent.length ? recent : ARCADE_GAMES.slice(0, 4)).map((game, index) => `<button type="button" data-game="${game.id}" style="--game:${["#63eaff", "#ff68c7", "#aa82ff", "#70f0b0"][index]}"><i>${game.icon}</i><span><strong>${game.title}</strong><small>${game.desc}</small></span><b>${state.scores[game.id] || 0}</b></button>`).join("")}</section>
      <section class="hhp-collections"><header><div><span>CHỌN THEO THỜI GIAN</span><strong>Không cần quyết định lâu</strong></div><button type="button" data-play-view="arcade">Xem tất cả →</button></header><div class="hhp-duration-chips"><button type="button" data-play-duration="3"><i>⚡</i><span><strong>3 phút</strong><small>Phản xạ nhanh</small></span></button><button type="button" data-play-duration="10"><i>✦</i><span><strong>10 phút</strong><small>Chơi một lượt</small></span></button><button type="button" data-play-duration="30"><i>◎</i><span><strong>30 phút</strong><small>Thư giãn sâu</small></span></button></div></section>
      <section class="hhp-collections hhp-collections--moods"><header><div><span>BỘ SƯU TẬP</span><strong>Chọn theo tâm trạng</strong></div></header><div class="hhp-mood-grid"><button type="button" data-play-collection="calm"><i>☾</i><span><strong>Thư giãn</strong><small>Chill · Pet · Story</small></span></button><button type="button" data-play-collection="competitive"><i>⚡</i><span><strong>Cạnh tranh</strong><small>Arcade · Rhythm · Quiz</small></span></button><button type="button" data-play-collection="solo"><i>◇</i><span><strong>Một mình</strong><small>Escape · Memory · Word</small></span></button><button type="button" data-play-collection="social"><i>◎</i><span><strong>Cùng bạn</strong><small>Party · Watch · Quiz</small></span></button></div></section>
      <section class="hhp-achievement-strip"><header><div><span>ACHIEVEMENT BOOK</span><strong>${state.achievements.length}/${ACHIEVEMENTS.length} huy hiệu</strong></div><small>Thành tích có bằng chứng từ hoạt động local</small></header><div>${ACHIEVEMENTS.map((badge) => `<article class="${state.achievements.includes(badge.id) ? "is-unlocked" : ""}"><i>${state.achievements.includes(badge.id) ? badge.icon : "?"}</i><span><strong>${esc(badge.title)}</strong><small>${esc(badge.note)}</small></span></article>`).join("")}</div></section>
    </section>`;
  }

  function arcadeView() {
    const selected = ARCADE_GAMES.find((game) => game.id === state.arcadeGame) || ARCADE_GAMES[0];
    state.arcadeGame = selected.id;
    const guide = GAME_GUIDES[selected.id] || GAME_GUIDES.snake;
    const difficulty = state.arcade?.difficulty || "normal";
    const runs = (state.arcade?.runs || []).filter((run) => run.game === selected.id).slice(-5).reverse();
    const difficultyMeta = ARCADE_DIFFICULTIES.find((item) => item.id === difficulty) || ARCADE_DIFFICULTIES[1];
    return `<section class="hhp-view hhp-arcade"><div class="hhp-cartridge" data-game-cartridge="${selected.id}">${heading("ARCADE GALAXY", esc(selected.title), "Mỗi trò có luật, điều khiển và kết quả riêng. Điểm, lịch sử và phần thưởng chỉ lưu trên thiết bị.", `${ARCADE_GAMES.length} trò · seed ${DAY_KEY()}`) }
      <div class="hhp-game-filmstrip">${ARCADE_GAMES.map((game) => `<button type="button" data-game="${game.id}" class="${game.id === selected.id ? "is-active" : ""}" aria-label="Mở ${esc(game.title)}"><i>${game.icon}</i><span><strong>${game.title}</strong><small>Kỷ lục ${state.scores[game.id] || 0}</small></span></button>`).join("")}</div>
      <article class="hhp-game-cockpit"><header><div><small>${selected.type === "canvas" ? "CANVAS ARCADE" : "QUICK CHALLENGE"}</small><h3>${selected.title}</h3><p>${selected.desc}</p></div><nav><button type="button" data-arcade-help aria-expanded="false">Hướng dẫn</button><button type="button" data-arcade-pause>Tạm dừng</button><button type="button" data-arcade-reset>Đặt lại</button></nav></header>
        <div class="hhp-cartridge-toolbar"><div class="hhp-difficulty" role="group" aria-label="Độ khó">${ARCADE_DIFFICULTIES.map((item) => `<button type="button" data-arcade-difficulty="${item.id}" class="${item.id === difficulty ? "is-active" : ""}" title="${item.note}">${item.label}</button>`).join("")}</div><span class="hhp-run-badge"><i></i>${difficultyMeta.note}</span></div>
        <details class="hhp-cartridge-help" data-arcade-help-panel ${state.arcade?.tutorialSeen?.[selected.id] ? "" : "open"}><summary><strong>Cách chơi</strong><span>${esc(guide.controls)}</span></summary><div><p>${esc(guide.goal)}</p><small>Mẹo: ${esc(guide.tip)}</small></div></details>
        <div class="hhp-game-stage" data-arcade-stage>${arcadeStage(selected)}</div>
        <footer><span>Điểm <strong data-arcade-score>0</strong></span><span>Kỷ lục <strong>${state.scores[selected.id] || 0}</strong></span><span data-arcade-status aria-live="polite">Sẵn sàng</span>${arcadeControls(selected)}<button type="button" class="hhp-inline-help" data-arcade-help aria-label="Mở hướng dẫn">?</button></footer>
      </article>
      <section class="hhp-game-history" aria-label="Lịch sử ${esc(selected.title)}"><header><strong>Lịch sử gần đây</strong><span>${runs.length}/5</span></header>${runs.length ? runs.map((run) => `<article><i class="${run.won ? "is-win" : "is-loss"}">${run.won ? "✓" : "·"}</i><span><strong>${run.score} điểm · ${run.difficulty === "hard" ? "Khó" : run.difficulty === "easy" ? "Dễ" : "Thường"}</strong><small>${new Date(run.at).toLocaleString("vi-VN")} · ${formatTime(run.duration)}</small></span></article>`).join("") : `<p>Chưa có ván nào. Hãy bắt đầu để tạo lịch sử thật.</p>`}</section></div></section>`;
  }

  function arcadeControls(game) {
    const directional = [
      ["up", "↑"], ["left", "←"], ["action", game.id === "shooter" ? "✦" : "●"], ["right", "→"], ["down", "↓"]
    ];
    return `<div class="hhp-dpad" data-dpad="${game.id}" aria-label="Điều khiển cảm ứng">${directional.map(([key, label]) => `<button type="button" data-play-key="${key}" aria-label="${key}">${label}</button>`).join("")}</div>`;
  }

  function arcadeStage(game) {
    if (game.type === "canvas") return `<canvas width="720" height="400" data-arcade-canvas data-game-id="${game.id}" tabindex="0" role="img" aria-label="${esc(game.title)}"></canvas><div class="hhp-game-overlay"><strong>${game.title}</strong><p>${game.desc} Chọn độ khó và bấm bắt đầu khi sẵn sàng.</p><button type="button" data-arcade-start>Bắt đầu</button></div>`;
    if (game.id === "memory") return `<div class="hhp-memory" data-memory-board></div>`;
    if (game.id === "reaction") return `<button class="hhp-reaction" type="button" data-reaction-pad><strong>Nhấn để chuẩn bị</strong><span>Chờ tín hiệu đổi màu rồi nhấn nhanh nhất</span></button>`;
    if (game.id === "elements") return `<div class="hhp-elements" data-elements-board></div><div class="hhp-game-inline-actions"><button type="button" data-element-move="left">←</button><button type="button" data-element-move="up">↑</button><button type="button" data-element-move="down">↓</button><button type="button" data-element-move="right">→</button></div>`;
    if (game.id === "sudoku") return sudokuMarkup();
    if (game.id === "word") return wordMarkup();
    return towerMarkup();
  }

  function partyView() {
    const rooms = state.party.rooms;
    const active = rooms.find((room) => room.code === state.party.activeCode);
    const realtime = state.party.realtime || { status: "unavailable", members: [], code: "", lastError: "" };
    const socketReady = typeof window !== "undefined" && Boolean(window.HHRealtimeSocket?.connected);
    const realtimeLabel = realtime.status === "connected" ? "Realtime đã xác nhận" : socketReady ? "Socket sẵn sàng · cần mở phòng" : "Chưa cấu hình realtime";
    return `<section class="hhp-view hhp-party">${heading("PARTY ROOM", "Tạo phòng với quyền riêng tư rõ ràng", "Bản này chuẩn bị phòng và mã mời trên thiết bị. Chỉ báo online sau khi có máy chủ realtime xác nhận.", realtime.status === "connected" ? "REALTIME" : "LOCAL-FIRST")}
      <div class="hhp-split"><div class="hhp-party-forms"><form class="hhp-panel hhp-party-form" data-party-form><header><i>◎</i><div><h3>Tạo phòng mới</h3><p>Không có thành viên giả hoặc phòng công khai giả.</p></div></header><label><span>Tên phòng</span><input name="name" maxlength="48" required placeholder="Ví dụ: Tối nay chơi Quiz"></label><div class="hhp-form-row"><label><span>Quyền xem</span><select name="privacy"><option value="invite">Chỉ người có mã</option><option value="private">Chỉ mình tôi</option><option value="public-draft">Công khai sau khi kết nối server</option></select></label><label><span>Số người tối đa</span><select name="limit"><option>2</option><option>4</option><option>6</option><option>8</option></select></label></div><fieldset><legend>Quyền thành viên</legend><label><input name="chat" type="checkbox" checked> Chat</label><label><input name="control" type="checkbox"> Điều khiển nội dung</label><label><input name="spectate" type="checkbox" checked> Người xem</label></fieldset><button class="hhp-submit" type="submit">Tạo mã phòng →</button></form><form class="hhp-panel hhp-party-join" data-party-join-form><header><i>↗</i><div><h3>Tham gia phòng thật</h3><p>Chỉ hoạt động khi máy chủ xác thực socket và tài khoản.</p></div></header><label><span>Mã phòng</span><input name="code" minlength="6" maxlength="12" pattern="[A-Za-z0-9]+" required placeholder="Nhập mã bạn nhận được"></label><button class="hhp-submit" type="submit">Tham gia →</button></form></div>
      <section class="hhp-panel hhp-room-console"><header><div><small>PHÒNG ĐANG CHỌN</small><h3>${active ? esc(active.name) : "Chưa tạo phòng"}</h3></div>${active ? `<button type="button" data-party-copy="${active.code}">Sao chép mã</button>` : ""}</header>${active ? `<div class="hhp-room-code"><span>MÃ MỜI</span><strong>${active.code}</strong><small>${privacyLabel(active.privacy)} · tối đa ${active.limit} người</small></div><ul class="hhp-room-permissions"><li><span>Chat</span><b>${active.permissions.chat ? "Cho phép" : "Tắt"}</b></li><li><span>Điều khiển</span><b>${active.permissions.control ? "Cho phép" : "Chủ phòng"}</b></li><li><span>Người xem</span><b>${active.permissions.spectate ? "Cho phép" : "Tắt"}</b></li><li><span>Realtime</span><b class="${realtime.status === "connected" ? "is-live" : "is-local"}">${realtimeLabel}</b></li></ul>${realtime.status === "connected" ? `<div class="hhp-party-presence"><strong>${realtime.members.length} thành viên đã xác nhận</strong>${realtime.members.slice(0, 6).map((member) => `<span title="${esc(member.name)}">${esc(member.name.slice(0, 2).toUpperCase())}</span>`).join("")}</div>` : ""}<div class="hhp-room-actions"><button type="button" data-party-connect ${socketReady ? "" : "title=\"Cần đăng nhập và Socket.IO thật\""}>${realtime.status === "connected" ? "Đã kết nối" : "Kết nối realtime thật"}</button><button type="button" data-route-link="/communication/live-room">Mở Live Room</button><button type="button" data-party-delete="${active.code}">Xóa phòng</button></div>${realtime.lastError ? `<p class="hhp-realtime-error" role="alert">${esc(realtime.lastError)}</p>` : ""}` : `<div class="hhp-empty"><i>◎</i><strong>Chưa có phòng cục bộ</strong><p>Tạo phòng để kiểm tra quyền và nhận mã mời. Kết nối thật cần signaling server được xác thực.</p></div>`}</section></div>
      <section class="hhp-room-list"><header><strong>Phòng trên thiết bị này</strong><span>${rooms.length}/12</span></header>${rooms.length ? rooms.map((room) => `<button type="button" data-party-select="${room.code}" class="${room.code === state.party.activeCode ? "is-active" : ""}"><i>${room.code.slice(0, 2)}</i><span><strong>${esc(room.name)}</strong><small>${privacyLabel(room.privacy)} · ${new Date(room.createdAt).toLocaleString("vi-VN")}</small></span><b>${room.code}</b></button>`).join("") : `<p>Chưa có dữ liệu phòng.</p>`}</section>
    </section>`;
  }

  function partyIdentity() {
    const user = options.currentUser || (typeof window !== "undefined" ? window.HHAuthSession?.user?.() : null) || {};
    const id = String(user.id || user._id || user.userId || "").trim();
    return { id, name: clean(user.displayName || user.name || "", 80), authenticated: Boolean(id && user.guest !== true && user.authenticated !== false) };
  }

  function unbindPartySocket() {
    if (partySocket && typeof partySocket.off === "function") partySocketHandlers.forEach(([event, handler]) => partySocket.off(event, handler));
    partySocketHandlers = []; partySocket = null;
  }

  function bindPartySocket(socket) {
    unbindPartySocket(); partySocket = socket;
    if (!socket || typeof socket.on !== "function") return;
    const listen = (event, handler) => { socket.on(event, handler); partySocketHandlers.push([event, handler]); };
    listen("play:room:presence", (payload = {}) => {
      if (!state || payload.code !== state.party.realtime?.code) return;
      state.party.realtime.members = (Array.isArray(payload.members) ? payload.members : []).slice(0, 32).map((member) => ({ id: clean(member.id, 120), name: clean(member.name || "Thành viên", 80), role: ["host", "player", "spectator"].includes(member.role) ? member.role : "player" })).filter((member) => member.id);
      save(); render();
    });
    listen("play:room:event", (payload = {}) => {
      if (!state || payload.code !== state.party.realtime?.code) return;
      if (payload.type === "watch:control" && payload.data) {
        const data = payload.data; if (Number.isFinite(Number(data.position))) state.watch.position = integer(data.position, 0, 86400, state.watch.position); if (typeof data.playing === "boolean") state.watch.playing = data.playing; if ([0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(data.rate))) state.watch.rate = Number(data.rate);
        if (data.action === "rewind" || data.action === "forward") sendWatchCommand("seekTo", [state.watch.position, true]); else if (data.action === "toggle") sendWatchCommand(state.watch.playing ? "playVideo" : "pauseVideo"); if (data.rate) sendWatchCommand("setPlaybackRate", [state.watch.rate]);
      }
      state.party.realtime.revision = integer(payload.revision, state.party.realtime.revision || 0, MAX_SCORE, state.party.realtime.revision || 0); save();
    });
    listen("play:room:state", (payload = {}) => {
      if (!state || payload.code !== state.party.realtime?.code || !payload.state) return;
      state.party.realtime.revision = integer(payload.revision, state.party.realtime.revision || 0, MAX_SCORE, state.party.realtime.revision || 0);
      if (payload.state.watch && typeof payload.state.watch === "object") { if (Number.isFinite(Number(payload.state.watch.position))) state.watch.position = integer(payload.state.watch.position, 0, 86400, state.watch.position); if (typeof payload.state.watch.playing === "boolean") state.watch.playing = payload.state.watch.playing; }
      save(); if (state.view === "watch") render();
    });
    listen("play:room:closed", (payload = {}) => {
      if (!state || payload.code !== state.party.realtime?.code) return;
      state.party.realtime.status = "offline"; state.party.realtime.lastError = clean(payload.reason || "Phòng đã đóng.", 180); save(); render();
    });
    listen("disconnect", () => { if (!state) return; state.party.realtime.status = "offline"; state.party.realtime.lastError = "Socket realtime đã ngắt kết nối."; save(); if (state.view === "party") render(); });
  }

  function connectPartyRealtime() {
    const active = state.party.rooms.find((room) => room.code === state.party.activeCode);
    if (!active) return toast("Hãy tạo hoặc chọn phòng trước.", true);
    const identity = partyIdentity();
    const socket = typeof window !== "undefined" ? window.HHRealtimeSocket : null;
    if (!identity.authenticated) { state.party.realtime.status = "unavailable"; state.party.realtime.lastError = "Cần đăng nhập tài khoản HH để mở phòng realtime."; save(); render(); return toast(state.party.realtime.lastError, true); }
    if (!socket?.connected || typeof socket.emit !== "function") { state.party.realtime.status = "unavailable"; state.party.realtime.lastError = "Socket.IO realtime chưa được xác nhận. Phòng vẫn chỉ ở chế độ cục bộ."; save(); render(); return toast(state.party.realtime.lastError, true); }
    state.party.realtime.status = "connecting"; state.party.realtime.lastError = ""; save(); render();
    bindPartySocket(socket);
    const generation = mountGeneration; let settled = false;
    const finish = (result = {}) => {
      if (settled || generation !== mountGeneration || !state) return; settled = true;
      if (!result.ok || !result.room?.code) { state.party.realtime.status = "unavailable"; state.party.realtime.lastError = clean(result.error || "Máy chủ không chấp nhận phòng.", 180); save(); render(); return toast(state.party.realtime.lastError, true); }
      state.party.realtime = { status: "connected", code: clean(result.room.code, 12), members: Array.isArray(result.room.members) ? result.room.members : [], revision: integer(result.room.revision, 0, MAX_SCORE, 0), lastError: "" };
      active.provider = "realtime-server"; active.serverCode = state.party.realtime.code; state.party.mode = "realtime"; state.daily.social = 1; save(); render(); toast(`Phòng realtime đã được máy chủ xác nhận · mã ${state.party.realtime.code}.`);
    };
    try { socket.emit("play:room:create", { name: active.name, game: state.view === "party" ? "party" : state.arcadeGame, maxMembers: active.limit, privacy: active.privacy, permissions: active.permissions }, finish); setTimeout(() => finish({ ok: false, error: "Máy chủ không phản hồi trong thời gian cho phép." }), 7000); }
    catch (error) { finish({ ok: false, error: error.message }); }
  }

  function watchView() {
    const current = state.watch.queue.find((item) => item.id === state.watch.current) || state.watch.queue[0];
    return `<section class="hhp-view hhp-watch">${heading("WATCH PARTY", "Hàng đợi xem chung minh bạch nguồn", "Chỉ nhúng video YouTube bằng youtube-nocookie.com; HH Play không tải lại hoặc lưu bản sao video.", "PRIVACY MODE")}
      <form class="hhp-watch-form" data-watch-form><label><span>URL YouTube</span><input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…"></label><label><span>Tên hiển thị</span><input name="title" maxlength="80" placeholder="Tự lấy Video ID nếu để trống"></label><button type="submit">Thêm vào hàng đợi</button></form>
      <div class="hhp-watch-layout"><article class="hhp-player">${current ? `<div class="hhp-embed"><iframe id="hhp-youtube-player" src="https://www.youtube-nocookie.com/embed/${current.id}?rel=0&enablejsapi=1&origin=${encodeURIComponent(typeof location !== "undefined" ? location.origin : "")}" title="${esc(current.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><div class="hhp-watch-controls" role="group" aria-label="Điều khiển video"><button type="button" data-watch-control="rewind">↶ 10s</button><button type="button" data-watch-control="toggle">${state.watch.playing ? "⏸ Tạm dừng" : "▶ Phát"}</button><button type="button" data-watch-control="forward">30s ↷</button><label><span>Tốc độ</span><select data-watch-rate>${[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => `<option value="${rate}" ${rate === state.watch.rate ? "selected" : ""}>${rate}×</option>`).join("")}</select></label></div><header><div><small>${state.watch.playing ? "ĐANG PHÁT · LOCAL PREVIEW" : "ĐANG CHỌN · LOCAL PREVIEW"}</small><h3>${esc(current.title)}</h3><p>Video ID: ${current.id} · ${formatTime(state.watch.position)} đã ghi nhớ trên thiết bị</p></div><button type="button" data-route-link="/youtube">Mở YouTube Center</button></header>` : `<div class="hhp-empty hhp-empty--player"><i>▶</i><strong>Chưa có video</strong><p>Dán liên kết YouTube hợp lệ để tạo hàng đợi.</p></div>`}</article><aside class="hhp-queue"><header><strong>Hàng đợi</strong><span>${state.watch.queue.length}</span></header>${state.watch.queue.length ? state.watch.queue.map((item, index) => `<article class="${item.id === current?.id ? "is-active" : ""}"><button type="button" data-watch-select="${item.id}"><i>${index + 1}</i><span><strong>${esc(item.title)}</strong><small>${item.id}</small></span></button><div><button type="button" data-watch-move="up" data-watch-id="${item.id}" aria-label="Đưa lên" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-watch-move="down" data-watch-id="${item.id}" aria-label="Đưa xuống" ${index === state.watch.queue.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-watch-remove="${item.id}" aria-label="Xóa">×</button></div></article>`).join("") : `<p>Hàng đợi trống.</p>`}</aside></div>
      <div class="hhp-sync-note"><i>i</i><p><strong>${state.party.realtime?.status === "connected" ? "Realtime đã xác nhận." : "Đồng bộ phòng chưa bật."}</strong> ${state.party.realtime?.status === "connected" ? "Điều khiển video được gửi qua phòng đã xác thực; nội dung vẫn phát từ YouTube." : "Trạng thái phát hiện chỉ ở thiết bị này. Khi backend realtime được cấu hình, phòng phải xác thực chủ phòng và quyền điều khiển trước khi đồng bộ."}</p></div>
    </section>`;
  }

  function storyView() {
    const node = STORY[state.story.node] || STORY.intro;
    return `<section class="hhp-view hhp-story">${heading("INTERACTIVE STORY", "Mỗi lựa chọn mở một nhánh khác", "Ba ô lưu giữ nguyên đường đi trên thiết bị; không cần tài khoản.", `${state.story.history.length + 1} cảnh`)}
      <div class="hhp-story-layout"><article class="hhp-story-book"><div class="hhp-book-spine"></div><header><span>CHƯƠNG ${state.story.history.length + 1}</span><h3>${node.title}</h3></header><p>${node.text}</p>${node.end ? `<div class="hhp-story-end"><i>✦</i><strong>${node.end}</strong><button type="button" data-story-reset>Đọc lại từ đầu</button></div>` : `<div class="hhp-story-choices">${node.choices.map(([label, next], index) => `<button type="button" data-story-choice="${next}"><i>${index + 1}</i><span>${label}</span><b>→</b></button>`).join("")}</div>`}</article><aside class="hhp-story-map"><header><strong>Bản đồ nhánh</strong><span>Local</span></header><div class="hhp-branch-map">${[...state.story.history, state.story.node].map((id, index) => `<span><i>${index + 1}</i><b>${esc(STORY[id]?.title || id)}</b></span>`).join("")}</div><section><strong>Ô lưu</strong>${state.story.slots.map((slot, index) => `<article><span><b>Ô ${index + 1}</b><small>${slot ? esc(STORY[slot.node]?.title || slot.node) : "Trống"}</small></span><div><button type="button" data-story-save="${index}">Lưu</button>${slot ? `<button type="button" data-story-load="${index}">Mở</button>` : ""}</div></article>`).join("")}</section></aside></div>
    </section>`;
  }

  function escapeView() {
    const current = ESCAPE_STAGES[state.escape.stage] || ESCAPE_STAGES.at(-1);
    return `<section class="hhp-view hhp-escape">${heading("ESCAPE ROOM", state.escape.completed ? "Cổng đã được mở" : current.title, "Giải lần lượt ba khóa. Gợi ý tăng dần và không làm mất tiến trình.", `${Math.min(state.escape.stage, 3)}/3 khóa`)}
      <div class="hhp-escape-room"><div class="hhp-lock-visual ${state.escape.completed ? "is-open" : ""}" aria-hidden="true"><i></i><b>${state.escape.completed ? "✓" : state.escape.stage + 1}</b><span></span></div><article>${state.escape.completed ? `<small>ESCAPE COMPLETE</small><h3>Bạn đã mở Cổng Bình Minh</h3><p>Ba mảnh khóa đã khớp. Thành tích được lưu cục bộ trên thiết bị.</p><button type="button" data-escape-reset>Chơi lại phòng</button>` : `<small>MẢNH KHÓA ${state.escape.stage + 1}</small><h3>${current.clue}</h3><form data-escape-form><label><span>Câu trả lời</span><input name="answer" maxlength="30" autocomplete="off" required placeholder="Nhập đáp án…"></label><button type="submit">Xác nhận</button></form><div class="hhp-hint-box"><header><strong>Gợi ý ${state.escape.hints}/3</strong><button type="button" data-escape-hint ${state.escape.hints >= 3 ? "disabled" : ""}>Mở gợi ý</button></header>${state.escape.hints ? `<ol>${current.hints.slice(0, state.escape.hints).map((hint) => `<li>${hint}</li>`).join("")}</ol>` : `<p>Hãy thử tự giải trước. Gợi ý không trừ điểm.</p>`}</div>`}</article></div>
      <div class="hhp-lock-progress">${ESCAPE_STAGES.map((stage, index) => `<span class="${index < state.escape.stage || state.escape.completed ? "is-done" : index === state.escape.stage ? "is-active" : ""}"><i>${index < state.escape.stage || state.escape.completed ? "✓" : index + 1}</i><b>${stage.title}</b></span>`).join("")}</div>
    </section>`;
  }

  function rhythmView() {
    return `<section class="hhp-view hhp-rhythm">${heading("RHYTHM ARENA", "Bắt nhịp bằng âm thanh tạo cục bộ", "Nhấn Space hoặc nút TAP sát nhịp phát sáng. Âm thanh chỉ bắt đầu sau thao tác của bạn.", `Best ${state.scores.rhythm || 0}`)}
      <article class="hhp-rhythm-stage"><div class="hhp-rhythm-orbit" data-rhythm-orbit aria-hidden="true"><i></i><i></i><i></i><b>♫</b></div><div class="hhp-rhythm-score"><span data-rhythm-label>Sẵn sàng</span><strong data-rhythm-score>0</strong><small>điểm nhịp</small></div><div class="hhp-beat-track" data-rhythm-track>${Array.from({ length: 12 }, (_, index) => `<i style="--beat:${index}"></i>`).join("")}</div><button class="hhp-tap" type="button" data-rhythm-tap>TAP</button><footer><span>Space / chạm</span><span>100 BPM</span><span>12 nhịp</span></footer></article>
      <div class="hhp-rhythm-guide"><article><i>1</i><span><strong>Nghe nhịp mẫu</strong><small>Click phát bằng Web Audio</small></span></article><article><i>2</i><span><strong>Nhấn đúng thời điểm</strong><small>Perfect · Good · Miss</small></span></article><article><i>3</i><span><strong>Xem độ chính xác</strong><small>Không ghi microphone</small></span></article></div>
    </section>`;
  }

  function petView() {
    const pet = state.pet;
    const evolution = pet.level >= 5 ? "Tinh linh trưởng thành" : pet.level >= 3 ? "Tinh linh sao" : "Rồng ánh sáng nhỏ";
    return `<section class="hhp-view hhp-pet">${heading("HH VIRTUAL PET", `${pet.name} · Cấp ${pet.level}`, "Pet không mất hoặc bị phạt nặng khi bạn nghỉ. Mọi chỉ số chỉ lưu trên thiết bị.", evolution)}
      <div class="hhp-pet-layout"><article class="hhp-pet-room"><div class="hhp-pet-aurora" aria-hidden="true"></div><div class="hhp-pet-creature" data-pet-creature><i></i><b>◇</b><span></span></div><div class="hhp-pet-bubble">${pet.hunger < 35 ? "Mình hơi đói…" : pet.energy < 30 ? "Mình muốn nghỉ một chút." : pet.happy > 85 ? "Hôm nay thật tuyệt!" : "Chơi cùng mình nhé!"}</div><footer><button type="button" data-pet="feed">🍎 <span>Cho ăn</span></button><button type="button" data-pet="play">✦ <span>Chơi</span></button><button type="button" data-pet="train">⌁ <span>Huấn luyện</span></button><button type="button" data-pet="rest">☾ <span>Nghỉ</span></button></footer></article><aside class="hhp-pet-panel"><header><div><small>HỒ SƠ PET</small><h3>${pet.name}</h3></div><button type="button" data-pet-rename>Đổi tên</button></header>${meter("No bụng", pet.hunger, "#ffcc66")}${meter("Vui vẻ", pet.happy, "#ff68c7")}${meter("Năng lượng", pet.energy, "#63eaff")}<div class="hhp-pet-xp"><span>Tiến hóa tiếp theo</span><div><i style="width:${pet.xp % 100}%"></i></div><b>${pet.xp % 100}/100 XP</b></div><p>Không có mua vật phẩm, loot box hoặc cơ chế ép quay lại. Chăm sóc chỉ nhằm tạo niềm vui nhẹ nhàng.</p></aside></div>
    </section>`;
  }

  function chillView() {
    const chill = state.chill;
    const sceneNames = { rain: "Mưa bên cửa sổ", cafe: "Quán cà phê đêm", forest: "Rừng đom đóm", fire: "Lửa trại", ocean: "Bờ biển" };
    return `<section class="hhp-view hhp-chill" data-chill-scene="${chill.scene}">${heading("CHILL ROOMS", sceneNames[chill.scene] || "Không gian thư giãn", "Âm cảnh được tạo trong trình duyệt; không tải nhạc có bản quyền và không tự phát âm thanh.", "LOCAL AUDIO")}
      <div class="hhp-chill-scenes">${Object.entries(sceneNames).map(([id, title]) => `<button type="button" data-chill-scene="${id}" class="${id === chill.scene ? "is-active" : ""}"><i>${({ rain: "☂", cafe: "☕", forest: "✦", fire: "△", ocean: "≈" })[id]}</i><span>${title}</span></button>`).join("")}</div>
      <div class="hhp-chill-layout"><article class="hhp-chill-window"><div class="hhp-weather" aria-hidden="true">${Array.from({ length: 18 }, (_, index) => `<i style="--drop:${index}"></i>`).join("")}</div><div class="hhp-chill-clock"><small>PHIÊN TẬP TRUNG</small><strong data-pomodoro-time>${formatTime(pomodoroRemaining || chill.minutes * 60)}</strong><span data-pomodoro-status>Chưa bắt đầu</span><div><button type="button" data-pomodoro="start">Bắt đầu</button><button type="button" data-pomodoro="reset">Đặt lại</button></div></div></article><aside class="hhp-mixer"><header><strong>Ambient Mixer</strong><button type="button" data-chill-toggle>${audio?.ambient ? "Tắt âm cảnh" : "Bật âm cảnh"}</button></header>${range("Mưa", "rain", chill.rain, "#63eaff")}${range("Gió", "wind", chill.wind, "#a982ff")}${range("Lửa", "fire", chill.fire, "#ff9a5f")}${range("Piano nhẹ", "piano", chill.piano, "#ff68c7")}<label class="hhp-minutes"><span>Pomodoro</span><select data-chill-minutes>${[15, 25, 45, 60].map((value) => `<option value="${value}" ${value === chill.minutes ? "selected" : ""}>${value} phút</option>`).join("")}</select></label></aside></div>
    </section>`;
  }

  function quizView() {
    const quiz = state.quiz;
    const bank = quizBank();
    const item = bank[quiz.index % bank.length] || QUIZ[0];
    const topicMeta = QUIZ_TOPICS.find((topic) => topic.id === quiz.topic) || QUIZ_TOPICS[0];
    const difficultyMeta = QUIZ_DIFFICULTIES.find((level) => level.id === quiz.difficulty) || QUIZ_DIFFICULTIES[0];
    const catalog = quizCatalog();
    const customCount = catalog.filter((question) => question.topic === "custom").length;
    return `<section class="hhp-view hhp-quiz">${heading("QUIZ ARENA", quiz.completed ? "Hoàn thành lượt đố vui" : `Câu ${quiz.index + 1}/${bank.length}`, "Lọc theo lĩnh vực và độ khó, sau đó học từ lời giải cùng góc nhìn mở rộng của từng câu.", `${quiz.score} điểm`)}
      <div class="hhp-quiz-toolbar"><div class="hhp-quiz-filter"><span>Chủ đề</span><div role="group" aria-label="Chọn chủ đề Quiz">${QUIZ_TOPICS.map((topic) => `<button type="button" data-quiz-topic="${topic.id}" class="${topic.id === quiz.topic ? "is-active" : ""}" aria-pressed="${topic.id === quiz.topic}"><i>${topic.icon}</i>${topic.label}</button>`).join("")}</div></div><div class="hhp-quiz-filter hhp-quiz-filter--level"><span>Độ khó</span><div role="group" aria-label="Chọn độ khó Quiz">${QUIZ_DIFFICULTIES.map((level) => `<button type="button" data-quiz-difficulty="${level.id}" class="${level.id === quiz.difficulty ? "is-active" : ""}" aria-pressed="${level.id === quiz.difficulty}">${level.label}</button>`).join("")}</div></div><b>${bank.length} câu phù hợp</b></div>
      <div class="hhp-quiz-layout"><article class="hhp-quiz-card">${quiz.completed ? `<div class="hhp-quiz-result"><i>?</i><small>KẾT QUẢ · ${esc(topicMeta.label.toUpperCase())}</small><strong>${quiz.score}/${bank.length}</strong><p>${quiz.score >= Math.ceil(bank.length * .75) ? "Bạn đã nắm tốt nhóm kiến thức này. Hãy đổi chủ đề hoặc thử mức chuyên sâu." : "Hãy chơi lại và đọc kỹ phần lý giải để củng cố cách suy luận."}</p><button type="button" data-quiz-reset>Làm lại bộ câu hỏi</button></div>` : `<header><span>${esc(topicMeta.label.toUpperCase())} · ${esc(difficultyMeta.label.toUpperCase())}</span><div aria-label="Tiến độ ${quiz.index + 1} trên ${bank.length}"><i style="width:${(quiz.index + 1) / bank.length * 100}%"></i></div></header><div class="hhp-question-meta"><span>${esc(item.skill || "Kiến thức")}</span><span>${item.topic === "custom" ? "Gói nội dung riêng" : "HH Play biên soạn"}</span><b>${quiz.index + 1}/${bank.length}</b></div><h3>${esc(item.q)}</h3><div class="hhp-quiz-choices">${item.choices.map((choice, index) => `<button type="button" data-quiz-answer="${index}" class="${quiz.answered ? index === item.answer ? "is-correct" : index === quiz.selected ? "is-wrong" : "" : ""}" ${quiz.answered ? "disabled" : ""}><i>${String.fromCharCode(65 + index)}</i><span>${esc(choice)}</span></button>`).join("")}</div>${quiz.answered ? `<div class="hhp-quiz-answer-stack"><div class="hhp-answer-note"><i>${quiz.selected === item.answer ? "✓" : "i"}</i><p><strong>${quiz.selected === item.answer ? "Chính xác" : `Đáp án: ${esc(item.choices[item.answer])}`}</strong>${esc(item.why)}</p></div><div class="hhp-insight-note"><i>◇</i><p><strong>Góc nhìn mở rộng</strong>${esc(item.insight)}</p></div></div><button class="hhp-quiz-next" type="button" data-quiz-next>${quiz.index === bank.length - 1 ? "Xem kết quả" : "Câu tiếp theo"} →</button>` : ""}`}</article>
      <aside class="hhp-quiz-profile" aria-label="Hồ sơ lượt Quiz"><header><span>KNOWLEDGE SESSION</span><strong>Phiên học có cấu trúc</strong></header><dl><div><dt>Chủ đề</dt><dd>${topicMeta.icon} ${esc(topicMeta.label)}</dd></div><div><dt>Độ khó</dt><dd>${esc(difficultyMeta.label)}</dd></div><div><dt>Điểm hiện tại</dt><dd>${quiz.score}/${Math.max(quiz.index + Number(quiz.answered), 1)}</dd></div><div><dt>Kho câu hỏi</dt><dd>${catalog.length}</dd></div></dl><section><strong>Nhịp học đề xuất</strong><p>Đọc câu hỏi, tự giải thích lựa chọn của mình, rồi đối chiếu phần “Vì sao” và “Góc nhìn mở rộng”.</p></section>${customCount ? `<small>${customCount} câu từ gói nội dung riêng đang được đánh dấu rõ nguồn local.</small>` : `<small>Bạn có thể nhập gói Quiz riêng trong Content Pack Studio.</small>`}</aside></div>
      <div class="hhp-quiz-modes"><button type="button" data-quiz-reset class="is-active"><i>↻</i><span><strong>Làm lại phiên</strong><small>${bank.length} câu theo bộ lọc hiện tại</small></span></button><button type="button" data-route-link="/communication/live-room"><i>◎</i><span><strong>Đấu cùng bạn</strong><small>Mở Live Room để kết nối thật</small></span></button><button type="button" data-quiz-report><i>!</i><span><strong>Báo lỗi câu hỏi</strong><small>Lưu ghi chú cục bộ</small></span></button></div>
    </section>`;
  }

  function meter(label, value, color) { return `<div class="hhp-meter"><span><b>${label}</b><small>${Math.round(value)}%</small></span><div><i style="width:${value}%;background:${color}"></i></div></div>`; }
  function range(label, key, value, color) { return `<label class="hhp-mix-row"><span><b>${label}</b><small data-mix-value="${key}">${value}%</small></span><input type="range" min="0" max="100" value="${value}" data-mix="${key}" style="--mix:${color}"></label>`; }
  function initials() { const name = options.currentUser?.displayName || options.currentUser?.name || "HH"; return String(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
  function level() { return Math.max(1, Math.floor(state.xp / 250) + 1); }
  function privacyLabel(value) { return ({ invite: "Chỉ người có mã", private: "Chỉ mình tôi", "public-draft": "Chờ server xác nhận" })[value] || "Riêng tư"; }
  function formatTime(seconds) { const value = Math.max(0, Math.round(seconds)); return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
  function seededRng(seedText) { let seed = 2166136261; for (const char of String(seedText)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619); return () => { seed += 0x6D2B79F5; let value = Math.imul(seed ^ seed >>> 15, 1 | seed); value ^= value + Math.imul(value ^ value >>> 7, 61 | value); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }

  function bind() {
    root.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);
    root.addEventListener("input", handleInput);
    root.addEventListener("change", handleChange);
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointerup", handlePointerUp);
    root.addEventListener("pointercancel", handlePointerUp);
    root.querySelector("[data-play-search]")?.addEventListener("keydown", (event) => { if (event.key === "Enter") runSearch(event.currentTarget.value); });
    root.querySelector("[data-play-mobile-more]")?.addEventListener("click", (event) => { event.stopPropagation(); root.classList.toggle("is-mobile-menu-open"); });
  }

  function handleClick(event) {
    const viewButton = event.target.closest("button[data-play-view]");
    if (viewButton) return setView(viewButton.dataset.playView);
    const gameButton = event.target.closest("[data-game]");
    if (gameButton) { state.arcadeGame = gameButton.dataset.game; state.recent = [state.arcadeGame, ...state.recent.filter((id) => id !== state.arcadeGame)].slice(0, 6); save(); return setView("arcade"); }
    const duration = event.target.closest("[data-play-duration]")?.dataset.playDuration;
    if (duration) { const optionsByDuration = { 3: "reaction", 10: "snake", 30: "memory" }; state.arcadeGame = optionsByDuration[duration] || "snake"; save(); return setView("arcade"); }
    const collection = event.target.closest("[data-play-collection]")?.dataset.playCollection;
    if (collection) { const optionsByCollection = { calm: "chill", competitive: "rhythm", solo: "escape", social: "party" }; return setView(optionsByCollection[collection] || "arcade"); }
    const difficultyButton = event.target.closest("[data-arcade-difficulty]");
    if (difficultyButton) {
      state.arcade = state.arcade || { difficulty: "normal", runs: [], tutorialSeen: {}, input: "keyboard-touch" };
      state.arcade.difficulty = ARCADE_DIFFICULTIES.some((item) => item.id === difficultyButton.dataset.arcadeDifficulty) ? difficultyButton.dataset.arcadeDifficulty : "normal";
      cleanupRuntime(); save(); return render();
    }
    if (event.target.closest("[data-arcade-help]")) {
      const game = ARCADE_GAMES.find((item) => item.id === state.arcadeGame) || ARCADE_GAMES[0];
      const guide = GAME_GUIDES[game.id] || GAME_GUIDES.snake;
      state.arcade = state.arcade || { difficulty: "normal", runs: [], tutorialSeen: {}, input: "keyboard-touch" };
      state.arcade.tutorialSeen[game.id] = true; save();
      return openDialog(`Hướng dẫn · ${game.title}`, `<div class="hhp-help-sheet"><p><strong>Mục tiêu:</strong> ${esc(guide.goal)}</p><p><strong>Điều khiển:</strong> ${esc(guide.controls)}</p><p><strong>Mẹo:</strong> ${esc(guide.tip)}</p><p class="hhp-help-note">Bạn có thể đổi độ khó bất cứ lúc nào; kết quả mỗi ván sẽ lưu riêng theo độ khó.</p></div>`);
    }
    const route = event.target.closest("[data-route-link]")?.dataset.routeLink;
    if (route) { location.hash = `#${route}`; return; }
    if (event.target.closest("[data-play-inspector-toggle]")) { state.settings.inspector = !state.settings.inspector; save(); return render(); }
    if (event.target.closest("[data-play-mobile-more]")) { root.classList.toggle("is-mobile-menu-open"); return; }
    const action = event.target.closest("[data-play-action]")?.dataset.playAction;
    if (action) return handleAction(action);
    const dataAction = event.target.closest("[data-play-data]")?.dataset.playData;
    if (dataAction === "export") { exportPlayData(true); return toast("Đã xuất hồ sơ HH Play đã kiểm tra."); }
    if (dataAction === "import") return root.querySelector("[data-play-import]")?.click();
    if (dataAction === "checkpoint") return void createSnapshot("Điểm khôi phục thủ công").then(() => toast("Đã tạo điểm khôi phục cục bộ."));
    if (dataAction === "restore") return void restoreLatestSnapshot();
    if (event.target.closest("[data-play-claim]")) {
      if (missionProgress().completed < 3) return toast("Hãy hoàn thành đủ ba nhiệm vụ trước.", true);
      const xp = grantXP(`daily:${DAY_KEY()}:complete`, 75, { id: "daily-complete", type: "mission" });
      state.daily.claimed = true; save(); render();
      return toast(xp ? "Đã nhận huy hiệu ngày và 75 XP cục bộ." : "Phần thưởng hôm nay đã được ghi nhận.");
    }
    if (event.target.closest("[data-arcade-start]")) return startCanvasGame();
    if (event.target.closest("[data-arcade-pause]")) return toggleArcadePause();
    if (event.target.closest("[data-arcade-reset]")) return resetArcadeChallenge();
    const memoryCard = event.target.closest("[data-memory-card]"); if (memoryCard) return flipMemory(Number(memoryCard.dataset.memoryCard));
    if (event.target.closest("[data-reaction-pad]")) return reactionTap();
    const elementMove = event.target.closest("[data-element-move]")?.dataset.elementMove; if (elementMove) return moveElements(elementMove);
    if (event.target.closest("[data-sudoku-check]")) return checkSudoku();
    if (event.target.closest("[data-word-check]")) return checkWord();
    if (event.target.closest("[data-word-next]")) { state.wordIndex = ((state.wordIndex || 0) + 1) % wordBank().length; save(); return render(); }
    const towerLane = event.target.closest("[data-tower-lane]")?.dataset.towerLane; if (towerLane !== undefined) return towerAction(Number(towerLane));
    const roomSelect = event.target.closest("[data-party-select]")?.dataset.partySelect; if (roomSelect) { state.party.activeCode = roomSelect; save(); return render(); }
    const roomDelete = event.target.closest("[data-party-delete]")?.dataset.partyDelete; if (roomDelete) { if (state.party.realtime?.status === "connected") { try { partySocket?.emit("play:room:leave", { code: state.party.realtime.code }); } catch {} unbindPartySocket(); } state.party.rooms = state.party.rooms.filter((room) => room.code !== roomDelete); state.party.activeCode = state.party.rooms[0]?.code || ""; state.party.realtime = { status: "unavailable", code: "", members: [], revision: 0, lastError: "" }; state.party.mode = "local-only"; save(); return render(); }
    const roomCopy = event.target.closest("[data-party-copy]")?.dataset.partyCopy; if (roomCopy) return copyText(roomCopy, "Đã sao chép mã phòng.");
    if (event.target.closest("[data-party-connect]")) return connectPartyRealtime();
    const watchSelect = event.target.closest("[data-watch-select]")?.dataset.watchSelect; if (watchSelect) { state.watch.current = watchSelect; state.watch.position = 0; state.watch.playing = false; save(); return render(); }
    const watchMove = event.target.closest("[data-watch-move]");
    if (watchMove) { reorderWatch(watchMove.dataset.watchId, watchMove.dataset.watchMove); return; }
    const watchControl = event.target.closest("[data-watch-control]")?.dataset.watchControl;
    if (watchControl) { controlWatch(watchControl); return; }
    const watchRemove = event.target.closest("[data-watch-remove]")?.dataset.watchRemove; if (watchRemove) { state.watch.queue = state.watch.queue.filter((item) => item.id !== watchRemove); if (state.watch.current === watchRemove) state.watch.current = state.watch.queue[0]?.id || ""; save(); return render(); }
    const storyChoice = event.target.closest("[data-story-choice]")?.dataset.storyChoice; if (storyChoice) { state.story.history.push(state.story.node); state.story.node = storyChoice; if (STORY[storyChoice]?.end) unlockAchievement("story-keeper"); save(); return render(); }
    if (event.target.closest("[data-story-reset]")) return resetStory();
    const saveSlot = event.target.closest("[data-story-save]")?.dataset.storySave; if (saveSlot !== undefined) { state.story.slots[Number(saveSlot)] = { node: state.story.node, history: [...state.story.history], savedAt: Date.now() }; save(); render(); return toast("Đã lưu nhánh truyện."); }
    const loadSlot = event.target.closest("[data-story-load]")?.dataset.storyLoad; if (loadSlot !== undefined) { const slot = state.story.slots[Number(loadSlot)]; if (slot) { state.story.node = slot.node; state.story.history = [...slot.history]; save(); render(); } return; }
    if (event.target.closest("[data-escape-hint]")) { state.escape.hints = clamp(state.escape.hints + 1, 0, 3); save(); return render(); }
    if (event.target.closest("[data-escape-reset]")) { state.escape = { stage: 0, hints: 0, completed: false }; save(); return render(); }
    if (event.target.closest("[data-rhythm-tap]")) return tapRhythm();
    const petAction = event.target.closest("[data-pet]")?.dataset.pet; if (petAction) return carePet(petAction);
    if (event.target.closest("[data-pet-rename]")) return openRenamePet();
    const chillScene = event.target.closest("button[data-chill-scene]")?.dataset.chillScene; if (chillScene) { state.chill.scene = chillScene; save(); return render(); }
    if (event.target.closest("[data-chill-toggle]")) return toggleChillAudio();
    const timerAction = event.target.closest("[data-pomodoro]")?.dataset.pomodoro; if (timerAction) return handlePomodoro(timerAction);
    const quizTopic = event.target.closest("[data-quiz-topic]")?.dataset.quizTopic;
    if (quizTopic !== undefined && QUIZ_TOPICS.some((item) => item.id === quizTopic)) return resetQuizProgress({ topic: quizTopic });
    const quizDifficulty = event.target.closest("[data-quiz-difficulty]")?.dataset.quizDifficulty;
    if (quizDifficulty !== undefined && QUIZ_DIFFICULTIES.some((item) => item.id === quizDifficulty)) return resetQuizProgress({ difficulty: quizDifficulty });
    const quizAnswer = event.target.closest("[data-quiz-answer]")?.dataset.quizAnswer; if (quizAnswer !== undefined) return answerQuiz(Number(quizAnswer));
    if (event.target.closest("[data-quiz-next]")) return nextQuiz();
    if (event.target.closest("[data-quiz-reset]")) return resetQuizProgress();
    if (event.target.closest("[data-quiz-report]")) return openQuizReport();
    if (event.target.closest("[data-hhp-dialog-close]")) return closeDialog();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (event.target.matches("[data-party-form]")) {
      const form = new FormData(event.target); const code = randomCode();
      const room = { code, name: clean(form.get("name"), 48) || "Phòng HH Play", privacy: clean(form.get("privacy"), 20), limit: clamp(form.get("limit"), 2, 8), permissions: { chat: form.has("chat"), control: form.has("control"), spectate: form.has("spectate") }, createdAt: Date.now(), provider: "local-device" };
      state.party.rooms.unshift(room); state.party.rooms = state.party.rooms.slice(0, 12); state.party.activeCode = code; state.daily.social = 1;
      unlockAchievement("social-spark");
      grantXP(`daily:${DAY_KEY()}:room-created`, 20, { id: "party-room", type: "social" });
      save(); render(); return toast("Đã tạo phòng cục bộ. Chưa có người online giả.");
    }
    if (event.target.matches("[data-party-join-form]")) {
      const code = clean(new FormData(event.target).get("code"), 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
      const socket = typeof window !== "undefined" ? window.HHRealtimeSocket : null; const identity = partyIdentity();
      if (!identity.authenticated) return toast("Cần đăng nhập HH để tham gia phòng thật.", true);
      if (!socket?.connected || typeof socket.emit !== "function") return toast("Socket realtime chưa được xác nhận.", true);
      state.party.realtime.status = "connecting"; state.party.realtime.lastError = ""; save(); render(); bindPartySocket(socket);
      const generation = mountGeneration;
      socket.emit("play:room:join", { code, role: "player" }, (result = {}) => {
        if (generation !== mountGeneration || !state) return;
        if (!result.ok || !result.room?.code) { state.party.realtime.status = "unavailable"; state.party.realtime.lastError = clean(result.error || "Không thể tham gia phòng.", 180); save(); render(); return toast(state.party.realtime.lastError, true); }
        if (!state.party.rooms.some((room) => room.provider === "realtime-server" && room.serverCode === result.room.code)) {
          const localCode = randomCode(); state.party.rooms.unshift({ code: localCode, serverCode: result.room.code, name: clean(result.room.name || "Phòng realtime", 48), privacy: "invite", limit: integer(result.room.maxMembers, 2, 8, 8), permissions: { chat: true, control: false, spectate: true }, createdAt: Date.now(), provider: "realtime-server" }); state.party.rooms = state.party.rooms.slice(0, 12); state.party.activeCode = localCode;
        }
        state.party.realtime = { status: "connected", code: clean(result.room.code, 12), members: Array.isArray(result.room.members) ? result.room.members : [], revision: integer(result.room.revision, 0, MAX_SCORE, 0), lastError: "" };
        state.party.mode = "realtime"; save(); render(); toast("Đã tham gia phòng realtime.");
      });
      return;
    }
    if (event.target.matches("[data-watch-form]")) {
      const form = new FormData(event.target); const id = youtubeId(form.get("url"));
      if (!id) return toast("Chỉ chấp nhận liên kết YouTube hợp lệ.", true);
      const title = clean(form.get("title"), 80) || `YouTube · ${id}`;
      if (!state.watch.queue.some((item) => item.id === id)) state.watch.queue.push({ id, title, addedAt: Date.now(), source: "youtube-nocookie" });
      state.watch.current = id; state.watch.position = 0; state.watch.playing = false; save(); render(); return toast("Đã thêm vào hàng đợi cục bộ.");
    }
    if (event.target.matches("[data-escape-form]")) {
      const answer = clean(new FormData(event.target).get("answer"), 30).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
      const expected = ESCAPE_STAGES[state.escape.stage]?.answer;
      if (answer !== expected) return toast("Mật mã chưa đúng. Bạn có thể mở gợi ý.", true);
      state.escape.stage += 1; state.escape.hints = 0;
      if (state.escape.stage >= ESCAPE_STAGES.length) { state.escape.completed = true; unlockAchievement("escape-master"); markPlayed("escape", 300, { rewardKey: `escape:${DAY_KEY()}:complete`, xp: 120, won: true }); }
      save(); render(); return toast(state.escape.completed ? "Cổng đã mở!" : "Đúng! Mảnh khóa tiếp theo đã xuất hiện.");
    }
  }

  function handleInput(event) {
    if (event.target.matches("[data-play-search]")) {
      renderSearchSuggestions(event.target.value);
      event.target.setAttribute("aria-expanded", clean(event.target.value, 80) ? "true" : "false");
      return;
    }
    const mix = event.target.dataset.mix;
    if (mix) { state.chill[mix] = clamp(event.target.value, 0, 100); root.querySelector(`[data-mix-value="${mix}"]`).textContent = `${state.chill[mix]}%`; updateAudioGains(); save(); }
  }

  function handleChange(event) {
    if (event.target.matches("[data-play-import]")) {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) return toast("Tệp nhập vượt quá giới hạn 2 MB.", true);
      void file.text().then((text) => importPlayData(text)).catch((error) => toast(clean(error?.message || "Không thể nhập dữ liệu.", 120), true));
      return;
    }
    if (event.target.matches("[data-chill-minutes]")) { state.chill.minutes = clamp(event.target.value, 5, 120); pomodoroRemaining = state.chill.minutes * 60; save(); updatePomodoroUI(); }
    if (event.target.matches("[data-watch-rate]")) { state.watch.rate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(event.target.value)) ? Number(event.target.value) : 1; sendWatchCommand("setPlaybackRate", [state.watch.rate]); save(); }
  }

  function handlePointerDown(event) {
    const key = event.target.closest("[data-play-key]")?.dataset.playKey;
    if (key && arcade) {
      const mapped = pointerKey(key); arcade.keys.add(mapped); applyArcadeKey(mapped);
      return;
    }
    const stage = event.target.closest("[data-arcade-stage]");
    if (stage && arcade) arcade.pointerStart = { x: event.clientX, y: event.clientY, at: Date.now() };
  }
  function handlePointerUp(event) {
    const key = event.target.closest("[data-play-key]")?.dataset.playKey;
    if (key && arcade) {
      arcade.keys.delete(pointerKey(key));
      if (key === "up" || key === "down") setTimeout(() => arcade?.keys.delete(pointerKey(key)), 0);
      return;
    }
    if (!arcade?.pointerStart) return;
    const start = arcade.pointerStart; arcade.pointerStart = null;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    arcade.keys.add(pointerKey(direction));
    if (arcade.mode === "snake") {
      const dirs = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const next = dirs[pointerKey(direction)];
      if (next && !(next.x === -arcade.dir.x && next.y === -arcade.dir.y)) arcade.nextDir = next;
    }
    setTimeout(() => arcade?.keys.delete(pointerKey(direction)), 0);
  }

  function pointerKey(key) { return ({ left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Space" })[key] || "Space"; }

  function handleAction(action) {
    if (action === "exit") { location.hash = "#/home"; return; }
    if (action === "invite") { const code = state.party.realtime?.status === "connected" ? state.party.realtime.code : state.party.activeCode; return copyText(code || location.href, code ? "Đã sao chép mã phòng." : "Đã sao chép liên kết HH Play."); }
    if (action === "settings") return openSettings();
    if (action === "content") return openContentStudio();
    if (action === "fullscreen") return toggleFullscreen();
    if (action === "restart") return restartCurrent();
    if (action === "arcade") return setView("arcade");
    if (action === "arcade-start") return startArcadePrimary();
    if (action === "party-focus") return root.querySelector("[data-party-form] input")?.focus();
    if (action === "watch-focus") return root.querySelector("[data-watch-form] input")?.focus();
    if (action === "story-reset") return resetStory();
    if (action === "escape-focus") return root.querySelector("[data-escape-form] input")?.focus();
    if (action === "rhythm-start") return startRhythm();
    if (action === "pet-play") return carePet("play");
    if (action === "chill-toggle") return toggleChillAudio();
    if (action === "quiz-next") return state.quiz.answered ? nextQuiz() : toast("Hãy chọn một đáp án trước.");
  }

  function activateViewRuntime() {
    if (state.view === "arcade") setupArcadeStage();
    if (state.view === "watch") setupWatchPlayer();
    if (state.view === "party") updatePartyRealtimeUI();
    if (state.view === "rhythm") window.addEventListener("keydown", rhythmKeydown);
    if (state.view === "chill") {
      const savedTimer = state.chill.timer || {};
      if (savedTimer.running && savedTimer.endsAt > Date.now()) { pomodoroEndsAt = savedTimer.endsAt; pomodoroRemaining = Math.ceil((savedTimer.endsAt - Date.now()) / 1000); startPomodoroTicker(); }
      else { state.chill.timer = { running: false, endsAt: 0, startedAt: 0 }; pomodoroEndsAt = 0; pomodoroRemaining ||= state.chill.minutes * 60; }
      updatePomodoroUI(savedTimer.running ? "Đang tập trung" : undefined);
    }
    applyPetRest();
  }
  function setupWatchPlayer() {
    const frame = root?.querySelector("#hhp-youtube-player");
    if (!frame) return;
    const announce = () => { try { frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: frame.id, channel: "hh-play" }), "https://www.youtube-nocookie.com"); } catch {} };
    frame.addEventListener("load", announce, { once: true });
    announce();
  }
  function updatePartyRealtimeUI() {
    if (!root || state.party.realtime?.status !== "connected") return;
    const code = state.party.realtime.code;
    const codeNode = root.querySelector(".hhp-room-code strong"); if (codeNode) codeNode.textContent = code;
    const label = root.querySelector(".hhp-room-code span"); if (label) label.textContent = "MÃ PHÒNG REALTIME";
    const copy = root.querySelector("[data-party-copy]"); if (copy) copy.dataset.partyCopy = code;
  }

  function cleanupRuntime() {
    if (arcade?.raf) cancelAnimationFrame(arcade.raf);
    if (towerState?.timer) clearInterval(towerState.timer);
    towerState = null;
    arcade = null;
    clearTimeout(reactionTimer);
    if (rhythm?.raf) cancelAnimationFrame(rhythm.raf);
    rhythm?.timers?.forEach((timer) => clearTimeout(timer));
    try { rhythm?.worklet?.disconnect?.(); } catch {}
    if (audio?.scheduled) { audio.scheduled.forEach((node) => { try { node.stop(); } catch {} }); audio.scheduled.clear(); }
    rhythm = null;
    window.removeEventListener("keydown", arcadeKeydown);
    window.removeEventListener("keyup", arcadeKeyup);
    window.removeEventListener("keydown", rhythmKeydown);
  }

  function setupArcadeStage() {
    const game = ARCADE_GAMES.find((item) => item.id === state.arcadeGame) || ARCADE_GAMES[0];
    if (game.type === "canvas") setupCanvas(game.id);
    else if (game.id === "memory") setupMemory();
    else if (game.id === "reaction") updateReaction();
    else if (game.id === "elements") setupElements();
    else if (game.id === "tower") setupTower();
  }

  function startArcadePrimary() {
    const game = ARCADE_GAMES.find((item) => item.id === state.arcadeGame) || ARCADE_GAMES[0];
    if (game.type === "canvas") startCanvasGame();
    else if (game.id === "reaction") reactionTap();
    else { state.arcade = state.arcade || { difficulty: "normal", runs: [], tutorialSeen: {}, input: "keyboard-touch" }; state.arcade.tutorialSeen[game.id] = true; toast("Thử thách đã sẵn sàng trong vùng chơi."); }
  }

  function setupCanvas(mode) {
    const canvas = root.querySelector("[data-arcade-canvas]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const difficulty = state.arcade?.difficulty || "normal";
    const factor = ARCADE_DIFFICULTIES.find((item) => item.id === difficulty)?.factor || 1;
    arcade = { mode, difficulty, factor, rng: seededRng(`${DAY_KEY()}:${mode}:${difficulty}`), canvas, ctx, running: false, paused: true, score: 0, lives: difficulty === "easy" ? 4 : difficulty === "hard" ? 2 : 3, keys: new Set(), last: 0, startedAt: 0, spawn: 0, tick: 0, player: { x: 360, y: 350 }, objects: [], bullets: [], bricks: [], snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, food: { x: 20, y: 10 }, ball: { x: 360, y: 270, vx: 190 * factor, vy: -210 * factor }, paddle: 360, pointerStart: null };
    if (mode === "breaker") arcade.bricks = Array.from({ length: 36 }, (_, index) => ({ x: 58 + index % 9 * 68, y: 45 + Math.floor(index / 9) * 30, alive: true }));
    drawCanvasGame();
    window.addEventListener("keydown", arcadeKeydown);
    window.addEventListener("keyup", arcadeKeyup);
  }

  function startCanvasGame() {
    if (!arcade) return;
    if (!arcade.running) setupCanvas(arcade.mode);
    arcade.running = true; arcade.paused = false; arcade.last = performance.now(); arcade.startedAt ||= arcade.last;
    root.querySelector(".hhp-game-overlay")?.classList.add("is-hidden");
    updateArcadeStatus("Đang chơi");
    arcade.raf = requestAnimationFrame(canvasLoop);
  }

  function toggleArcadePause() {
    if (!arcade?.running) return startCanvasGame();
    arcade.paused = !arcade.paused;
    updateArcadeStatus(arcade.paused ? "Đã tạm dừng" : "Đang chơi");
    if (!arcade.paused) { arcade.last = performance.now(); arcade.raf = requestAnimationFrame(canvasLoop); }
  }

  function resetArcadeChallenge() { cleanupRuntime(); render(); }

  function arcadeKeydown(event) {
    if (!arcade) return;
    const normalized = String(event.key || "").toLowerCase();
    const aliases = { a: "ArrowLeft", d: "ArrowRight", w: "ArrowUp", s: "ArrowDown" };
    const mapped = aliases[normalized] || (event.key === " " ? "Space" : event.key);
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(mapped)) return;
    event.preventDefault();
    const key = mapped;
    arcade.keys.add(key);
    applyArcadeKey(key);
  }
  function applyArcadeKey(key) {
    if (!arcade) return;
    if (arcade.mode === "snake") {
      const dirs = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const next = dirs[key]; if (next && !(next.x === -arcade.dir.x && next.y === -arcade.dir.y)) arcade.nextDir = next;
    }
    if (key === "Space" && arcade.mode === "shooter") fireBullet();
  }
  function arcadeKeyup(event) { if (!arcade) return; const normalized = String(event.key || "").toLowerCase(); const aliases = { a: "ArrowLeft", d: "ArrowRight", w: "ArrowUp", s: "ArrowDown" }; arcade.keys.delete(aliases[normalized] || (event.key === " " ? "Space" : event.key)); }

  function pollGamepad() {
    if (!arcade || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    const pad = [...(navigator.getGamepads() || [])].find(Boolean);
    if (!pad) return;
    const x = Number(pad.axes?.[0] || 0); const y = Number(pad.axes?.[1] || 0);
    if (x < -.35) arcade.keys.add("ArrowLeft"); else arcade.keys.delete("ArrowLeft");
    if (x > .35) arcade.keys.add("ArrowRight"); else arcade.keys.delete("ArrowRight");
    if (y < -.45) applyArcadeKey("ArrowUp");
    if (y > .45) applyArcadeKey("ArrowDown");
    if (pad.buttons?.[0]?.pressed) applyArcadeKey("Space");
  }

  function canvasLoop(now) {
    if (!arcade?.running || arcade.paused) return;
    const dt = Math.min(0.033, (now - arcade.last) / 1000 || 0); arcade.last = now;
    updateCanvasGame(dt, now); drawCanvasGame();
    if (arcade?.running && !arcade.paused) arcade.raf = requestAnimationFrame(canvasLoop);
  }

  function updateCanvasGame(dt, now) {
    if (arcade.mode === "snake") return updateSnake(now);
    const move = (arcade.keys.has("ArrowRight") ? 1 : 0) - (arcade.keys.has("ArrowLeft") ? 1 : 0);
    arcade.player.x = clamp(arcade.player.x + move * 330 * dt * (arcade.factor || 1), 24, 696);
    if (arcade.mode === "breaker") return updateBreaker(dt);
    pollGamepad();
    arcade.spawn -= dt;
    if (arcade.spawn <= 0) {
      arcade.spawn = (arcade.mode === "shooter" ? 0.72 : 0.48) / arcade.factor;
      const random = arcade.rng || Math.random; arcade.objects.push({ x: 25 + random() * 670, y: -20, r: 10 + random() * 14, speed: (100 + random() * 130) * arcade.factor });
    }
    arcade.objects.forEach((object) => { object.y += object.speed * dt; });
    if (arcade.mode === "shooter") {
      arcade.bullets.forEach((bullet) => { bullet.y -= 430 * dt; });
      for (const bullet of arcade.bullets) for (const enemy of arcade.objects) if (!enemy.hit && Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.r + 5) { enemy.hit = true; bullet.hit = true; arcade.score += 25; }
      arcade.bullets = arcade.bullets.filter((bullet) => !bullet.hit && bullet.y > -20);
      arcade.objects = arcade.objects.filter((object) => !object.hit);
    }
    arcade.objects.forEach((object) => {
      if (!object.hit && object.y > 326 && Math.abs(object.x - arcade.player.x) < object.r + 18) { object.hit = true; arcade.lives -= 1; }
      if (object.y > 430) { if (arcade.mode === "dodge") arcade.score += 8; object.hit = true; }
    });
    arcade.objects = arcade.objects.filter((object) => !object.hit);
    if (arcade.lives <= 0) endArcade(false);
    else if (arcade.score >= (arcade.mode === "shooter" ? 500 : 320)) endArcade(true);
    updateArcadeScore();
  }

  function updateSnake(now) {
    if (now - arcade.tick < 105) return;
    arcade.tick = now; arcade.dir = arcade.nextDir;
    const head = { x: arcade.snake[0].x + arcade.dir.x, y: arcade.snake[0].y + arcade.dir.y };
    if (head.x < 0 || head.x >= 36 || head.y < 0 || head.y >= 20 || arcade.snake.some((part) => part.x === head.x && part.y === head.y)) return endArcade(false);
    arcade.snake.unshift(head);
    if (head.x === arcade.food.x && head.y === arcade.food.y) { arcade.score += 20; const random = arcade.rng || Math.random; arcade.food = { x: Math.floor(random() * 36), y: Math.floor(random() * 20) }; }
    else arcade.snake.pop();
    if (arcade.score >= 300) endArcade(true);
    updateArcadeScore();
  }

  function updateBreaker(dt) {
    arcade.paddle = arcade.player.x;
    const ball = arcade.ball; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < 9 || ball.x > 711) ball.vx *= -1;
    if (ball.y < 9) ball.vy = Math.abs(ball.vy);
    if (ball.y > 350 && ball.y < 374 && Math.abs(ball.x - arcade.paddle) < 70 && ball.vy > 0) { ball.vy = -Math.abs(ball.vy); ball.vx += (ball.x - arcade.paddle) * 2; }
    arcade.bricks.forEach((brick) => { if (brick.alive && Math.abs(ball.x - brick.x) < 31 && Math.abs(ball.y - brick.y) < 12) { brick.alive = false; ball.vy *= -1; arcade.score += 15; } });
    if (ball.y > 420) { arcade.lives -= 1; Object.assign(ball, { x: 360, y: 270, vx: 190, vy: -210 }); }
    if (arcade.bricks.every((brick) => !brick.alive)) endArcade(true);
    else if (arcade.lives <= 0) endArcade(false);
    updateArcadeScore();
  }

  function fireBullet() { if (arcade?.running && arcade.mode === "shooter" && arcade.bullets.length < 8) arcade.bullets.push({ x: arcade.player.x, y: 330 }); }

  function drawCanvasGame() {
    if (!arcade) return;
    const { ctx, canvas } = arcade;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); gradient.addColorStop(0, "#07112a"); gradient.addColorStop(1, "#150827"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(99,234,255,.22)"; for (let i = 0; i < 70; i += 1) ctx.fillRect((i * 97) % 720, (i * 53) % 400, i % 3 + 1, i % 3 + 1);
    if (arcade.mode === "snake") {
      ctx.fillStyle = "#63eaff"; arcade.snake.forEach((part, index) => { ctx.globalAlpha = Math.max(.3, 1 - index * .035); ctx.fillRect(part.x * 20 + 2, part.y * 20 + 2, 16, 16); }); ctx.globalAlpha = 1; ctx.fillStyle = "#ff68c7"; ctx.beginPath(); ctx.arc(arcade.food.x * 20 + 10, arcade.food.y * 20 + 10, 7, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (arcade.mode === "breaker") {
      arcade.bricks.forEach((brick, index) => { if (!brick.alive) return; ctx.fillStyle = ["#63eaff", "#aa82ff", "#ff68c7", "#ffd86b"][Math.floor(index / 9)]; ctx.fillRect(brick.x - 29, brick.y - 9, 58, 18); });
      ctx.fillStyle = "#63eaff"; ctx.fillRect(arcade.paddle - 62, 360, 124, 12); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(arcade.ball.x, arcade.ball.y, 8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = "#63eaff"; ctx.beginPath(); ctx.moveTo(arcade.player.x, 330); ctx.lineTo(arcade.player.x - 17, 370); ctx.lineTo(arcade.player.x, 360); ctx.lineTo(arcade.player.x + 17, 370); ctx.closePath(); ctx.fill();
      arcade.objects.forEach((object) => { ctx.fillStyle = arcade.mode === "shooter" ? "#ff6578" : "#aa82ff"; ctx.beginPath(); ctx.arc(object.x, object.y, object.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = "#ffd86b"; arcade.bullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 10, 4, 14));
    }
    ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.font = "700 13px system-ui"; ctx.fillText(`Điểm ${arcade.score} · Mạng ${arcade.lives}`, 16, 24);
  }

  function endArcade(win) {
    if (!arcade?.running) return;
    arcade.running = false; arcade.paused = true;
    const finishedAt = performance.now();
    const duration = arcade.startedAt ? Math.max(0, Math.round((finishedAt - arcade.startedAt) / 1000)) : 0;
    const result = markPlayed(arcade.mode, arcade.score, { duration, won: win === true });
    updateArcadeStatus(win ? "Hoàn thành!" : "Kết thúc");
    const overlay = root.querySelector(".hhp-game-overlay"); if (overlay) { overlay.classList.remove("is-hidden"); overlay.querySelector("strong").textContent = win ? "Thử thách hoàn thành" : "Lượt chơi kết thúc"; overlay.querySelector("p").textContent = `Điểm: ${arcade.score} · ${formatTime(duration)} · ${result.xp ? `+${result.xp} XP` : "XP đã nhận trước đó"}.`; overlay.querySelector("button").textContent = "Chơi lại"; }
    save();
  }

  function updateArcadeScore() { const element = root?.querySelector("[data-arcade-score]"); if (element && arcade) element.textContent = Math.round(arcade.score); }
  function updateArcadeStatus(text) { const element = root?.querySelector("[data-arcade-status]"); if (element) element.textContent = text; }
  function unlockAchievement(id) {
    if (!state || !ACHIEVEMENTS.some((item) => item.id === id) || state.achievements.includes(id)) return false;
    state.achievements = [...state.achievements, id].slice(0, ACHIEVEMENTS.length);
    appendHistory({ id: `badge:${id}`, type: "mission", xp: 0, rewardKey: "" });
    return true;
  }
  function markPlayed(id, score = 0, config = {}) {
    state = rollLocalDay(normalizeState(state));
    const gameId = clean(id, 32).toLowerCase().replace(/[^a-z0-9-]/g, "") || "game";
    const safeScore = integer(score, 0, MAX_SCORE, 0);
    const previous = integer(state.scores[gameId], 0, MAX_SCORE, 0);
    state.scores[gameId] = Math.max(previous, safeScore);
    state.daily.played = 1;
    const rewardKey = clean(config.rewardKey, 140) || uniqueRewardKey(`play:${gameId}`);
    const reward = integer(config.xp, 0, 10000, Math.max(5, Math.min(60, Math.round(safeScore / 10))));
    const xp = grantXP(rewardKey, reward, { id: gameId, type: "game", score: safeScore });
    if (xp) state.sessions = integer(state.sessions + 1, 0, 10000000, state.sessions);
    if (ARCADE_GAMES.some((game) => game.id === gameId)) {
      state.recent = [gameId, ...state.recent.filter((item) => item !== gameId)].slice(0, 6);
      state.arcade = state.arcade || { difficulty: "normal", runs: [], tutorialSeen: {}, input: "keyboard-touch" };
      state.arcade.runs = [...(state.arcade.runs || []), { id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, game: gameId, difficulty: config.difficulty || state.arcade.difficulty || "normal", score: safeScore, duration: integer(config.duration, 0, 86400, 0), won: config.won === true, at: Date.now() }].slice(-40);
    }
    unlockAchievement("first-light");
    if (new Set(state.recent).size >= 5) unlockAchievement("arcade-tour");
    save();
    return { rewarded: xp > 0, xp, newBest: safeScore > previous, score: safeScore };
  }

  function setupMemory() {
    const symbols = ["✦", "☾", "◇", "◎", "△", "♫", "⌁", "◈"];
    const random = seededRng(`${DAY_KEY()}:memory:${state.arcade?.difficulty || "normal"}`);
    memoryState = { cards: [...symbols, ...symbols].sort(() => random() - .5).map((symbol, index) => ({ symbol, id: index, open: false, matched: false })), open: [], moves: 0, locked: false };
    drawMemory();
  }
  function drawMemory() { const board = root?.querySelector("[data-memory-board]"); if (!board || !memoryState) return; board.innerHTML = memoryState.cards.map((card, index) => `<button type="button" data-memory-card="${index}" class="${card.open || card.matched ? "is-open" : ""} ${card.matched ? "is-matched" : ""}"><i>?</i><b>${card.symbol}</b></button>`).join(""); updateArcadeScoreValue(memoryState.moves); }
  function flipMemory(index) {
    const card = memoryState?.cards[index]; if (!card || card.open || card.matched || memoryState.locked) return;
    card.open = true; memoryState.open.push(index); drawMemory();
    if (memoryState.open.length < 2) return;
    memoryState.moves += 1; const [a, b] = memoryState.open.map((id) => memoryState.cards[id]);
    if (a.symbol === b.symbol) { a.matched = b.matched = true; memoryState.open = []; if (memoryState.cards.every((item) => item.matched)) { const score = Math.max(100, 600 - memoryState.moves * 20); markPlayed("memory", score, { won: true }); toast(`Hoàn thành trong ${memoryState.moves} lượt.`); } drawMemory(); }
    else { memoryState.locked = true; setTimeout(() => { a.open = b.open = false; memoryState.open = []; memoryState.locked = false; drawMemory(); }, 650); }
  }

  function reactionTap() {
    const now = performance.now();
    if (reactionState.phase === "idle" || reactionState.phase === "done") {
      reactionState.phase = "waiting"; updateReaction(); clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => { reactionState.phase = "ready"; reactionState.startedAt = performance.now(); updateReaction(); tone(740, .08); }, 900 + Math.random() * 2200); return;
    }
    if (reactionState.phase === "waiting") { clearTimeout(reactionTimer); reactionState.phase = "idle"; updateReaction("Quá sớm! Nhấn để thử lại."); return; }
    if (reactionState.phase === "ready") { const ms = Math.round(now - reactionState.startedAt); reactionState.phase = "done"; reactionState.best = reactionState.best ? Math.min(reactionState.best, ms) : ms; const score = Math.max(50, 900 - ms); markPlayed("reaction", score, { won: true }); updateReaction(`${ms} ms · tốt nhất ${reactionState.best} ms`); }
  }
  function updateReaction(message = "") { const pad = root?.querySelector("[data-reaction-pad]"); if (!pad) return; pad.dataset.phase = reactionState.phase; const strong = pad.querySelector("strong"); const span = pad.querySelector("span"); if (strong) strong.textContent = reactionState.phase === "waiting" ? "Chờ…" : reactionState.phase === "ready" ? "NHẤN NGAY!" : reactionState.phase === "done" ? "Đã ghi kết quả" : "Nhấn để chuẩn bị"; if (span) span.textContent = message || (reactionState.phase === "waiting" ? "Đừng nhấn trước khi chuyển sang màu xanh" : "Chờ tín hiệu đổi màu rồi nhấn nhanh nhất"); }

  function setupElements() { if (!elementBoard.length) { elementBoard = Array(16).fill(0); addElement(); addElement(); } drawElements(); }
  function addElement() { const empty = elementBoard.map((value, index) => value ? -1 : index).filter((index) => index >= 0); if (empty.length) elementBoard[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < .86 ? 2 : 4; }
  function moveElements(direction) {
    if (!elementBoard.length) setupElements(); const before = elementBoard.join(","); let score = 0;
    const lines = direction === "left" || direction === "right" ? Array.from({ length: 4 }, (_, row) => [0, 1, 2, 3].map((col) => row * 4 + col)) : Array.from({ length: 4 }, (_, col) => [0, 1, 2, 3].map((row) => row * 4 + col));
    if (direction === "right" || direction === "down") lines.forEach((line) => line.reverse());
    lines.forEach((line) => { const values = line.map((index) => elementBoard[index]).filter(Boolean); const merged = []; for (let i = 0; i < values.length; i += 1) { if (values[i] === values[i + 1]) { merged.push(values[i] * 2); score += values[i] * 2; i += 1; } else merged.push(values[i]); } while (merged.length < 4) merged.push(0); line.forEach((index, i) => { elementBoard[index] = merged[i]; }); });
    if (before !== elementBoard.join(",")) addElement();
    state.elementScore = (state.elementScore || 0) + score; if (Math.max(...elementBoard) >= 2048) markPlayed("elements", state.elementScore, { won: true }); save(); drawElements();
  }
  function drawElements() { const board = root?.querySelector("[data-elements-board]"); if (!board) return; board.innerHTML = elementBoard.map((value) => `<span data-value="${value}">${value || ""}</span>`).join(""); updateArcadeScoreValue(state.elementScore || 0); }

  function sudokuMarkup() { const puzzle = [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1]; return `<div class="hhp-sudoku">${puzzle.map((value, index) => value ? `<b>${value}</b>` : `<input inputmode="numeric" maxlength="1" data-sudoku="${index}" aria-label="Ô số ${index + 1}">`).join("")}</div><button class="hhp-inline-submit" type="button" data-sudoku-check>Kiểm tra bảng</button>`; }
  function checkSudoku() { const solution = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1]; const inputs = [...root.querySelectorAll("[data-sudoku]")]; let valid = true; inputs.forEach((input) => { const ok = Number(input.value) === solution[Number(input.dataset.sudoku)]; input.classList.toggle("is-error", !ok); valid = valid && ok; }); if (!valid) return toast("Một số ô chưa đúng.", true); const result = markPlayed("sudoku", 420, { rewardKey: `puzzle:sudoku:${DAY_KEY()}:solar-4x4-v1`, won: true }); toast(result.rewarded ? "Solar Sudoku hoàn thành!" : "Kết quả đã được ghi nhận; XP không bị cộng lặp."); }

  function wordMarkup() { const bank = wordBank(); const item = bank[(state.wordIndex || 0) % bank.length]; const scrambled = item.word.split("").sort((a, b) => (a.charCodeAt(0) * 7 % 13) - (b.charCodeAt(0) * 7 % 13)).join(" · "); return `<div class="hhp-word"><small>GỢI Ý: ${esc(item.clue)}</small><strong>${esc(scrambled)}</strong><label><span>Từ của bạn</span><input data-word-input autocomplete="off" maxlength="40"></label><div><button type="button" data-word-check>Kiểm tra</button><button type="button" data-word-next>Từ khác</button></div></div>`; }
  function checkWord() { const bank = wordBank(); const wordIndex = integer(state.wordIndex, 0, bank.length - 1, 0); const item = bank[wordIndex]; const answer = clean(root.querySelector("[data-word-input]")?.value, 40).normalize("NFD").replace(/[\u0300-\u036f\s]/g, "").toUpperCase(); if (answer !== item.word) return toast("Chưa đúng, hãy xem lại các chữ cái.", true); const result = markPlayed("word", 250, { rewardKey: `puzzle:word:${DAY_KEY()}:${wordIndex}`, won: true }); toast(result.rewarded ? "Ghép từ chính xác!" : "Từ này đã được tính XP hôm nay."); }

  function towerMarkup() { return `<div class="hhp-tower" data-tower-board>${[0, 1, 2].map((lane) => `<button type="button" data-tower-lane="${lane}"><i></i><span>Tuyến ${lane + 1}</span><b data-tower-hp="${lane}">100</b></button>`).join("")}</div><p class="hhp-tower-note">Chạm tuyến yếu nhất để chuyển 18 năng lượng phòng thủ. Giữ cả ba tuyến qua 12 wave.</p>`; }
  function setupTower() { towerState = { hp: [100, 100, 100], energy: 100, wave: 0, timer: setInterval(() => { if (!towerState || state.view !== "arcade" || state.arcadeGame !== "tower") return; towerState.wave += 1; const lane = Math.floor(Math.random() * 3); towerState.hp[lane] = Math.max(0, towerState.hp[lane] - (12 + Math.floor(Math.random() * 18))); towerState.energy = Math.min(100, towerState.energy + 8); drawTower(); if (towerState.hp.some((hp) => hp <= 0)) { clearInterval(towerState.timer); toast("Một tuyến đã thất thủ. Hãy đặt lại để thử lại.", true); } else if (towerState.wave >= 12) { clearInterval(towerState.timer); markPlayed("tower", towerState.hp.reduce((a, b) => a + b, 0), { won: true }); toast("Đã giữ vững 12 wave!"); } }, 1600) }; drawTower(); }
  function towerAction(lane) { if (!towerState || towerState.energy < 18) return toast("Chưa đủ năng lượng.", true); towerState.energy -= 18; towerState.hp[lane] = Math.min(100, towerState.hp[lane] + 30); drawTower(); }
  function drawTower() { if (!towerState) return; towerState.hp.forEach((hp, lane) => { const element = root?.querySelector(`[data-tower-hp="${lane}"]`); if (element) element.textContent = `${Math.round(hp)}%`; }); updateArcadeScoreValue(towerState.wave * 25); updateArcadeStatus(`Wave ${towerState.wave}/12 · NL ${towerState.energy}`); }
  function updateArcadeScoreValue(value) { const target = root?.querySelector("[data-arcade-score]"); if (target) target.textContent = Math.round(value); }

  function youtubeId(value) { const text = String(value || "").trim(); try { const url = new URL(text); if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)) return ""; const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1); return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : ""; } catch { return ""; } }
  function reorderWatch(id, direction) {
    const index = state.watch.queue.findIndex((item) => item.id === id); const nextIndex = index + (direction === "up" ? -1 : 1);
    if (index < 0 || nextIndex < 0 || nextIndex >= state.watch.queue.length) return;
    const next = [...state.watch.queue]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; state.watch.queue = next; save(); render();
  }
  function sendWatchCommand(command, args = []) {
    const frame = root?.querySelector("#hhp-youtube-player");
    if (!frame?.contentWindow) return false;
    try { frame.contentWindow.postMessage(JSON.stringify({ event: "command", func: command, args }), "https://www.youtube-nocookie.com"); } catch { return false; }
    return true;
  }
  function controlWatch(action) {
    if (!state.watch.current) return;
    if (action === "toggle") { state.watch.playing = !state.watch.playing; sendWatchCommand(state.watch.playing ? "playVideo" : "pauseVideo"); }
    if (action === "rewind") { state.watch.position = Math.max(0, state.watch.position - 10); sendWatchCommand("seekTo", [state.watch.position, true]); }
    if (action === "forward") { state.watch.position = Math.min(86400, state.watch.position + 30); sendWatchCommand("seekTo", [state.watch.position, true]); }
    if (state.party.realtime?.status === "connected" && partySocket?.emit) partySocket.emit("play:room:event", { type: "watch:control", data: { action, position: state.watch.position, playing: state.watch.playing, rate: state.watch.rate } });
    save(); render();
  }
  function watchWindowMessage(event) {
    if (event?.origin && !["https://www.youtube-nocookie.com", "https://www.youtube.com", "https://www.youtube.com"].includes(event.origin)) return;
    if (!event?.data || !root?.contains?.(root.querySelector("#hhp-youtube-player"))) return;
    let payload = event.data; if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return; } }
    if (!payload || typeof payload !== "object") return;
    if (payload.event === "onStateChange") { state.watch.playing = Number(payload.info) === 1; save(); }
    if (payload.event === "infoDelivery" && Number.isFinite(Number(payload.info?.currentTime))) { state.watch.position = Math.round(Number(payload.info.currentTime)); save(); }
  }
  function resetStory() { state.story.node = "intro"; state.story.history = []; save(); render(); }

  function startRhythm() {
    if (rhythm?.running) return;
    const context = ensureAudioContext(); const start = performance.now() + 900; const interval = 600; rhythm = { running: true, start, interval, taps: [], score: 0, judged: new Set(), raf: 0, timers: [], worklet: null };
    if (context && audio?.workletReady && typeof AudioWorkletNode !== "undefined") {
      try { const node = new AudioWorkletNode(context, "hh-play-metronome"); const gain = context.createGain(); gain.gain.value = .7; node.connect(gain).connect(context.destination); rhythm.worklet = node; for (let index = 0; index < 12; index += 1) rhythm.timers.push(setTimeout(() => node.port.postMessage({ type: "pulse", frequency: index % 4 === 0 ? 660 : 440 }), Math.max(0, start - performance.now() + index * interval))); } catch { for (let index = 0; index < 12; index += 1) scheduleTone((start - performance.now()) / 1000 + index * interval / 1000, index % 4 === 0 ? 660 : 440); }
    } else for (let index = 0; index < 12; index += 1) scheduleTone((start - performance.now()) / 1000 + index * interval / 1000, index % 4 === 0 ? 660 : 440);
    root.querySelector("[data-rhythm-label]").textContent = "Chuẩn bị…"; rhythm.raf = requestAnimationFrame(rhythmLoop);
  }
  function rhythmLoop(now) { if (!rhythm?.running) return; const elapsed = now - rhythm.start; const active = Math.floor((elapsed + 110) / rhythm.interval); root?.querySelectorAll("[data-rhythm-track] i").forEach((beat, index) => beat.classList.toggle("is-active", index === active)); if (elapsed > rhythm.interval * 12 + 500) { rhythm.running = false; markPlayed("rhythm", rhythm.score, { won: true }); const label = root.querySelector("[data-rhythm-label]"); if (label) label.textContent = "Hoàn thành"; return; } rhythm.raf = requestAnimationFrame(rhythmLoop); }
  function tapRhythm() { if (!rhythm?.running) return startRhythm(); const now = performance.now(); const index = Math.round((now - rhythm.start) / rhythm.interval); if (index < 0 || index >= 12 || rhythm.judged.has(index)) return; rhythm.judged.add(index); const delta = Math.abs(now - (rhythm.start + index * rhythm.interval)); const points = delta <= 80 ? 100 : delta <= 160 ? 60 : delta <= 260 ? 25 : 0; rhythm.score += points; const label = root.querySelector("[data-rhythm-label]"); if (label) label.textContent = points === 100 ? "PERFECT" : points === 60 ? "GOOD" : points ? "OK" : "MISS"; const score = root.querySelector("[data-rhythm-score]"); if (score) score.textContent = rhythm.score; root.querySelector("[data-rhythm-orbit]")?.classList.add("is-hit"); setTimeout(() => root?.querySelector("[data-rhythm-orbit]")?.classList.remove("is-hit"), 130); }
  function rhythmKeydown(event) { if (event.code === "Space" && state?.view === "rhythm") { event.preventDefault(); tapRhythm(); } }

  function ensureAudioContext() { if (!audio?.context) { const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return null; audio = { context: new Context(), sources: [], gains: {}, scheduled: new Set(), workletReady: false }; if (audio.context.audioWorklet?.addModule) { const moduleUrl = new URL("hh-play-audio-worklet.js?build=2", typeof location !== "undefined" ? location.href : "http://localhost/").href; audio.context.audioWorklet.addModule(moduleUrl).then(() => { if (audio) audio.workletReady = true; }).catch(() => {}); } } if (audio.context.state === "suspended") audio.context.resume(); return audio.context; }
  function tone(frequency, duration = .05) { const context = ensureAudioContext(); if (!context || !state.settings.sound) return; const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration); }
  function scheduleTone(delay, frequency) { const context = ensureAudioContext(); if (!context || !state.settings.sound) return; const time = context.currentTime + Math.max(0, delay); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.07, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + .08); oscillator.connect(gain).connect(context.destination); oscillator.start(time); oscillator.stop(time + .09); audio?.scheduled?.add(oscillator); oscillator.addEventListener?.("ended", () => audio?.scheduled?.delete(oscillator), { once: true }); }

  function applyPetRest() { if (!state?.pet) return; const elapsedHours = Math.min(24, Math.max(0, (Date.now() - state.pet.lastCare) / 3600000)); if (elapsedHours < 1) return; state.pet.hunger = clamp(state.pet.hunger - elapsedHours * 1.2, 20, 100); state.pet.happy = clamp(state.pet.happy - elapsedHours * .45, 25, 100); state.pet.energy = clamp(state.pet.energy + elapsedHours * 2.5, 0, 100); state.pet.lastCare = Date.now(); if (!hydrationPending) save(); }
  function carePet(action) { const pet = state.pet; const changes = { feed: [26, 5, -2, 12], play: [-5, 24, -12, 18], train: [-8, 8, -18, 26], rest: [-2, 2, 30, 8] }[action]; if (!changes) return; pet.hunger = clamp(pet.hunger + changes[0], 0, 100); pet.happy = clamp(pet.happy + changes[1], 0, 100); pet.energy = clamp(pet.energy + changes[2], 0, 100); pet.xp += changes[3]; pet.level = Math.floor(pet.xp / 100) + 1; pet.lastCare = Date.now(); state.daily.played = 1; save(); render(); root?.querySelector("[data-pet-creature]")?.classList.add("is-happy"); }
  function openRenamePet() { openDialog("Đổi tên pet", `<form data-rename-pet><label><span>Tên mới</span><input name="name" maxlength="20" value="${esc(state.pet.name)}" required></label><button type="submit">Lưu tên</button></form>`); root.querySelector("[data-rename-pet]")?.addEventListener("submit", (event) => { event.preventDefault(); state.pet.name = clean(new FormData(event.target).get("name"), 20) || "Lumi"; save(); render(); }); }

  function toggleChillAudio() { if (audio?.ambient) { stopAmbient(); render(); return; } const context = ensureAudioContext(); if (!context) return toast("Trình duyệt chưa hỗ trợ Web Audio.", true); const master = context.createGain(); master.gain.value = .55; master.connect(context.destination); const createNoise = (filterType, frequency, key) => { const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate); const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1; const source = context.createBufferSource(); source.buffer = buffer; source.loop = true; const filter = context.createBiquadFilter(); filter.type = filterType; filter.frequency.value = frequency; const gain = context.createGain(); gain.gain.value = 0; source.connect(filter).connect(gain).connect(master); source.start(); audio.sources.push(source); audio.gains[key] = gain; };
    createNoise("lowpass", 1100, "rain"); createNoise("lowpass", 340, "wind"); createNoise("bandpass", 2100, "fire");
    const piano = context.createOscillator(); const pianoGain = context.createGain(); piano.type = "sine"; piano.frequency.value = 220; pianoGain.gain.value = 0; piano.connect(pianoGain).connect(master); piano.start(); audio.sources.push(piano); audio.gains.piano = pianoGain; audio.ambient = true; updateAudioGains(); render(); }
  function updateAudioGains() { if (!audio?.ambient) return; ["rain", "wind", "fire", "piano"].forEach((key) => { const gain = audio.gains[key]; if (gain) gain.gain.setTargetAtTime((state.chill[key] / 100) * (key === "piano" ? .035 : .12), audio.context.currentTime, .08); }); }
  function stopAmbient() { if (!audio) return; audio.sources.forEach((source) => { try { source.stop(); } catch {} }); audio.sources = []; audio.gains = {}; audio.ambient = false; }
  function startPomodoroTicker() {
    clearInterval(pomodoroTimer);
    pomodoroTimer = setInterval(() => {
      pomodoroRemaining = Math.max(0, Math.ceil(((pomodoroEndsAt || Date.now()) - Date.now()) / 1000));
      updatePomodoroUI("Đang tập trung");
      if (pomodoroRemaining <= 0) {
        clearInterval(pomodoroTimer); pomodoroTimer = 0; pomodoroEndsAt = 0;
        state.chill.timer = { running: false, endsAt: 0, startedAt: 0 };
        tone(660, .2); grantXP(`focus:${DAY_KEY()}:${state.chill.minutes}`, 20, { id: "pomodoro", type: "focus" }); unlockAchievement("focus-orbit"); save(); updatePomodoroUI("Hoàn thành");
      }
    }, 1000);
  }
  function handlePomodoro(action) {
    if (action === "reset") { clearInterval(pomodoroTimer); pomodoroTimer = 0; pomodoroEndsAt = 0; pomodoroRemaining = state.chill.minutes * 60; state.chill.timer = { running: false, endsAt: 0, startedAt: 0 }; save(); updatePomodoroUI("Đã đặt lại"); return; }
    if (pomodoroTimer) { clearInterval(pomodoroTimer); pomodoroTimer = 0; pomodoroEndsAt = 0; state.chill.timer = { running: false, endsAt: 0, startedAt: 0 }; save(); updatePomodoroUI("Đã tạm dừng"); return; }
    pomodoroRemaining = pomodoroRemaining || state.chill.minutes * 60;
    pomodoroEndsAt = Date.now() + pomodoroRemaining * 1000;
    state.chill.timer = { running: true, endsAt: pomodoroEndsAt, startedAt: Date.now() };
    save(); startPomodoroTicker(); updatePomodoroUI("Đang tập trung");
  }
  function updatePomodoroUI(status) { const time = root?.querySelector("[data-pomodoro-time]"); const label = root?.querySelector("[data-pomodoro-status]"); if (time) time.textContent = formatTime(pomodoroRemaining || state.chill.minutes * 60); if (label && status) label.textContent = status; const button = root?.querySelector('[data-pomodoro="start"]'); if (button) button.textContent = pomodoroTimer ? "Tạm dừng" : "Bắt đầu"; }

  function resetQuizProgress(patch = {}) {
    state.quiz = {
      index: 0, score: 0, answered: false, selected: -1, completed: false,
      topic: QUIZ_TOPICS.some((item) => item.id === patch.topic) ? patch.topic : state.quiz.topic,
      difficulty: QUIZ_DIFFICULTIES.some((item) => item.id === patch.difficulty) ? patch.difficulty : state.quiz.difficulty
    };
    save();
    render();
  }
  function answerQuiz(index) { if (state.quiz.answered) return; const bank = quizBank(); const item = bank[state.quiz.index % bank.length] || bank[0]; if (!item || index < 0 || index >= item.choices.length) return; state.quiz.selected = index; state.quiz.answered = true; if (index === item.answer) state.quiz.score += 1; state.daily.quiz = 1; const questionKey = clean(item.id, 60) || `index-${state.quiz.index}`; grantXP(`quiz:${DAY_KEY()}:${questionKey}`, index === item.answer ? 15 : 5, { id: `quiz-${questionKey}`, type: "quiz", score: index === item.answer ? 1 : 0 }); save(); render(); }
  function nextQuiz() { const bank = quizBank(); if (!state.quiz.answered && !state.quiz.completed) return toast("Hãy chọn một đáp án trước."); if (state.quiz.index >= bank.length - 1) state.quiz.completed = true; else { state.quiz.index += 1; state.quiz.answered = false; state.quiz.selected = -1; } save(); render(); }
  function openQuizReport() {
    openDialog("Báo lỗi câu hỏi", `<form data-quiz-report-form><p>Ghi chú được lưu cục bộ; không tự gửi ra ngoài.</p><label><span>Mô tả vấn đề</span><textarea name="message" maxlength="500" required></textarea></label><button type="submit">Lưu ghi chú</button></form>`);
    root.querySelector("[data-quiz-report-form]")?.addEventListener("submit", (event) => {
      event.preventDefault(); const message = clean(new FormData(event.target).get("message"), 500);
      if (!message) return toast("Hãy nhập mô tả trước khi lưu.", true);
      let reports = [];
      try { const parsed = JSON.parse(localStorage.getItem("hh.play.quiz-reports.v1") || "[]"); reports = Array.isArray(parsed) ? parsed.slice(-29) : []; } catch {}
      reports = reports.map((item) => ({ question: integer(item?.question, 0, quizBank().length - 1, 0), message: clean(item?.message, 500), createdAt: safeTimestamp(item?.createdAt) })).filter((item) => item.message);
      reports.push({ question: state.quiz.index, message, createdAt: Date.now() });
      try { localStorage.setItem("hh.play.quiz-reports.v1", JSON.stringify(reports.slice(-30))); } catch { return toast("Bộ nhớ cục bộ đã đầy.", true); }
      event.target.closest(".hhp-dialog-host")?.remove(); toast("Đã lưu ghi chú cục bộ.");
    });
  }

  function restartCurrent() { if (state.view === "arcade") return resetArcadeChallenge(); if (state.view === "story") return resetStory(); if (state.view === "escape") { state.escape = { stage: 0, hints: 0, completed: false }; } if (state.view === "quiz") state.quiz = { index: 0, score: 0, answered: false, selected: -1, completed: false }; save(); render(); }
  function searchCatalog() {
    const aliases = { game: "arcade", trò: "arcade", nhịp: "rhythm", nhac: "rhythm", phòng: "party", bạn: "party", xem: "watch", truyện: "story", mật: "escape", thú: "pet", thưgiãn: "chill", đố: "quiz" };
    return [...VIEWS.map((item) => ({ id: item.id, title: item.title, note: item.note, icon: item.icon, color: item.color, kind: "view", keywords: aliases[item.id] || "" })), ...ARCADE_GAMES.map((item) => ({ ...item, note: item.desc, color: "#63eaff", kind: "game", keywords: `${item.id} game trò chơi` }))];
  }
  function searchResults(query) {
    const term = clean(query, 80).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!term) return [];
    return searchCatalog().filter((item) => `${item.title} ${item.note} ${item.keywords}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term));
  }
  function renderSearchSuggestions(query) {
    const panel = root?.querySelector("[data-search-suggestions]"); if (!panel) return;
    const results = searchResults(query).slice(0, 6);
    if (!clean(query, 80) || !results.length) { panel.hidden = true; panel.replaceChildren(); return; }
    panel.hidden = false;
    panel.innerHTML = results.map((item) => `<button type="button" ${item.kind === "game" ? `data-game="${item.id}"` : `data-play-view="${item.id}"`} style="--result:${item.color}"><i>${item.icon}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></span><b>↗</b></button>`).join("");
  }
  function runSearch(query) {
    const term = clean(query, 80); if (!term) return;
    const results = searchResults(term);
    root.querySelector("[data-search-suggestions]")?.setAttribute("hidden", "");
    const stage = root.querySelector(".hhp-stage-scroll"); if (!stage) return;
    stage.innerHTML = `<section class="hhp-view hhp-search-results">${heading("TÌM KIẾM", `Kết quả cho “${esc(term)}”`, "Bấm một kết quả để mở trực tiếp. Có thể tìm theo tên, loại trò hoặc từ khóa.", `${results.length} kết quả`)}<div>${results.length ? results.map((item) => `<button type="button" ${item.kind === "game" ? `data-game="${item.id}"` : `data-play-view="${item.id}"`} style="--result:${item.color}"><i>${item.icon}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></span><b>→</b></button>`).join("") : `<p>Không tìm thấy. Thử “game”, “nhịp”, “phòng”, “pet” hoặc “quiz”.</p>`}</div></section>`;
    root.querySelector("[data-play-search]")?.setAttribute("aria-expanded", "false");
  }
  function openSettings() {
    openDialog("Cài đặt HH Play", `<form data-play-settings><label><span>Mức chuyển động</span><select name="motion"><option value="static" ${state.settings.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.settings.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.settings.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label><label><span>Điều khiển Arcade</span><select name="input"><option value="keyboard-touch" ${state.arcade.input === "keyboard-touch" ? "selected" : ""}>Bàn phím + cảm ứng</option><option value="keyboard" ${state.arcade.input === "keyboard" ? "selected" : ""}>Bàn phím</option><option value="touch" ${state.arcade.input === "touch" ? "selected" : ""}>Cảm ứng</option><option value="gamepad" ${state.arcade.input === "gamepad" ? "selected" : ""}>Gamepad (nếu có)</option></select></label><label class="hhp-check"><input type="checkbox" name="sound" ${state.settings.sound ? "checked" : ""}><span>Cho phép âm thanh sau thao tác</span></label><label class="hhp-check"><input type="checkbox" name="inspector" ${state.settings.inspector ? "checked" : ""}><span>Hiện bảng tóm tắt</span></label><label class="hhp-check"><input type="checkbox" name="safeChat" ${state.settings.safeChat ? "checked" : ""}><span>Bộ lọc chat an toàn mặc định</span></label><button type="submit">Áp dụng</button></form><section class="hhp-data-tools" aria-label="Sao lưu dữ liệu"><header><strong>Dữ liệu cục bộ</strong><small>IndexedDB · có bản dự phòng giới hạn</small></header><div><button type="button" data-play-data="checkpoint">Tạo điểm khôi phục</button><button type="button" data-play-data="restore">Khôi phục gần nhất</button><button type="button" data-play-data="export">Xuất JSON</button><button type="button" data-play-data="import">Nhập JSON</button></div><input type="file" data-play-import accept="application/json,.json" hidden><p>Tệp nhập được giới hạn 2 MB và mọi trường đều được kiểm tra trước khi lưu.</p></section>`);
    root.querySelector("[data-play-settings]")?.addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.target); state.settings.motion = clean(form.get("motion"), 20); state.arcade.input = ["keyboard-touch", "keyboard", "touch", "gamepad"].includes(form.get("input")) ? form.get("input") : "keyboard-touch"; state.settings.sound = form.has("sound"); state.settings.inspector = form.has("inspector"); state.settings.safeChat = form.has("safeChat"); save(); render(); });
  }
  function contentPackTemplate() {
    return JSON.stringify({ format: "hh-play-content-pack", title: "Bộ Quiz mới", type: "quiz", items: [{ q: "Câu hỏi mẫu?", choices: ["A", "B", "C"], answer: 0, why: "Giải thích ngắn." }] }, null, 2);
  }
  function openContentStudio() {
    const packs = state.contentPacks || [];
    openDialog("Content Pack Studio", `<section class="hhp-content-studio"><p>Tạo và kiểm tra gói Quiz, Story, Escape hoặc Word ngay trên thiết bị. Gói chưa được máy chủ kiểm duyệt sẽ chỉ dùng riêng tư.</p><form data-content-pack-form><label><span>JSON gói nội dung</span><textarea name="payload" spellcheck="false" maxlength="200000">${esc(contentPackTemplate())}</textarea></label><div><button type="submit">Kiểm tra & lưu</button><button type="button" data-content-template>Khôi phục mẫu</button></div></form><section class="hhp-pack-list"><header><strong>Gói đã lưu</strong><span>${packs.length}/${MAX_CONTENT_PACKS}</span></header>${packs.length ? packs.map((pack) => `<article><i>${pack.type === "quiz" ? "?" : pack.type === "story" ? "⌁" : pack.type === "escape" ? "⌾" : "W"}</i><span><strong>${esc(pack.title)}</strong><small>${pack.type.toUpperCase()} · ${pack.items.length} mục</small></span><button type="button" data-content-export="${esc(pack.id)}">Xuất</button></article>`).join("") : `<p>Chưa có gói riêng.</p>`}</section></section>`);
    root.querySelector("[data-content-template]")?.addEventListener("click", () => { const field = root.querySelector("[data-content-pack-form] textarea"); if (field) field.value = contentPackTemplate(); field?.focus(); });
    root.querySelector("[data-content-pack-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const raw = new FormData(event.target).get("payload");
      try {
        if (String(raw || "").length > MAX_IMPORT_BYTES) throw new Error("Gói nội dung vượt quá giới hạn 2 MB.");
        const parsed = JSON.parse(String(raw || ""));
        if (parsed?.format && parsed.format !== "hh-play-content-pack") throw new Error("Định dạng gói không được hỗ trợ.");
        const packId = `pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const candidate = normalizeState({ ...state, contentPacks: [...(state.contentPacks || []), { ...parsed, id: packId, createdAt: Date.now() }] }).contentPacks.find((pack) => pack.id === packId);
        if (!candidate || !candidate.items.length) throw new Error("Gói cần ít nhất một mục hợp lệ.");
        state.contentPacks = [...(state.contentPacks || []), candidate].slice(-MAX_CONTENT_PACKS); save(); closeDialog(); toast(`Đã lưu ${candidate.title} · ${candidate.items.length} mục cục bộ.`);
      } catch (error) { toast(clean(error?.message || "JSON không hợp lệ.", 180), true); }
    });
    root.querySelectorAll("[data-content-export]").forEach((button) => button.addEventListener("click", () => {
      const pack = state.contentPacks.find((item) => item.id === button.dataset.contentExport); if (!pack) return;
      const data = JSON.stringify({ format: "hh-play-content-pack", schemaVersion: 1, ...pack }, null, 2);
      const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${pack.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "hh-pack"}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }));
  }
  function openDialog(title, content) {
    closeDialog(false);
    dialogReturnFocus = typeof document !== "undefined" ? document.activeElement : null;
    root.insertAdjacentHTML("beforeend", `<div class="hhp-dialog-host" data-dialog-host><button type="button" data-hhp-dialog-close aria-label="Đóng"></button><section class="hhp-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><header><h3>${esc(title)}</h3><button type="button" data-hhp-dialog-close aria-label="Đóng hộp thoại">×</button></header>${content}</section></div>`);
    const dialog = root.querySelector("[data-dialog-host] .hhp-dialog");
    dialog?.querySelector("input, textarea, select, button")?.focus({ preventScroll: true });
  }
  function closeDialog(restore = true) {
    const hostDialog = root?.querySelector("[data-dialog-host]");
    if (!hostDialog) return;
    hostDialog.remove();
    const target = dialogReturnFocus;
    dialogReturnFocus = null;
    if (restore && target && typeof target.focus === "function" && typeof document !== "undefined" && document.contains?.(target)) target.focus({ preventScroll: true });
  }
  function toggleFullscreen() { if (document.fullscreenElement) return document.exitFullscreen?.(); root.requestFullscreen?.().catch(() => toast("Trình duyệt không cho phép toàn màn hình.", true)); }
  async function copyText(text, message) { try { await navigator.clipboard.writeText(String(text)); toast(message); } catch { toast("Không thể truy cập clipboard. Hãy sao chép thủ công.", true); } }
  function toast(message, error = false) { const target = root?.querySelector(".hhp-toast"); if (!target) return; clearTimeout(noticeTimer); target.hidden = false; target.classList.toggle("is-error", error); target.textContent = message; noticeTimer = setTimeout(() => { if (target) target.hidden = true; }, 2800); }

  function mount(target, config = {}) {
    if (!target) return;
    unmount(); host = target; options = config; stateRevision = 0; hydrationPending = true; state = loadState();
    if (state.party?.realtime) { state.party.realtime.status = "unavailable"; state.party.realtime.members = []; state.party.realtime.lastError = ""; }
    const generation = ++mountGeneration;
    const requested = clean(config.view, 30); if (VIEWS.some((view) => view.id === requested)) state.view = requested;
    render();
    document.addEventListener("visibilitychange", visibilityHandler);
    document.addEventListener("keydown", globalKeydown);
    window.addEventListener("hh:realtime-ready", realtimeReadyHandler);
    window.addEventListener("hh:realtime-offline", realtimeOfflineHandler);
    watchMessageHandler = watchWindowMessage;
    window.addEventListener("message", watchMessageHandler);
    void hydrateIndexedState(generation, stateRevision, state.savedAt, requested);
  }
  function realtimeReadyHandler(event) { if (!state) return; if (state.view === "party") { state.party.realtime.status = "unavailable"; state.party.realtime.lastError = "Socket realtime đã sẵn sàng. Bấm kết nối để xác nhận phòng."; save(); render(); } }
  function realtimeOfflineHandler() { if (!state) return; state.party.realtime.status = "offline"; state.party.realtime.lastError = "Máy chủ realtime đang ngoại tuyến."; save(); if (state.view === "party") render(); }
  function globalKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && root) { event.preventDefault(); root.querySelector("[data-play-search]")?.focus(); return; }
    if (event.key === "Escape" && root?.querySelector("[data-dialog-host]")) { event.preventDefault(); closeDialog(); return; }
    const dialog = root?.querySelector("[data-dialog-host] .hhp-dialog");
    if (event.key === "Tab" && dialog) {
      const focusables = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].filter((item) => item.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  function visibilityHandler() {
    if (document.hidden) {
      if (arcade?.running) { arcade.paused = true; cancelAnimationFrame(arcade.raf); updateArcadeStatus("Tự tạm dừng vì tab bị ẩn"); }
      if (rhythm?.running) { rhythm.running = false; cancelAnimationFrame(rhythm.raf); rhythm.timers?.forEach((timer) => clearTimeout(timer)); try { rhythm.worklet?.disconnect?.(); } catch {} }
      if (audio?.scheduled) { audio.scheduled.forEach((node) => { try { node.stop(); } catch {} }); audio.scheduled.clear(); }
    }
  }
  function unmount() { mountGeneration += 1; hydrationPending = false; if (partySocket?.connected) { try { partySocket.emit("play:room:leave", { code: state?.party?.realtime?.code || "" }); } catch {} } unbindPartySocket(); cleanupRuntime(); clearInterval(pomodoroTimer); pomodoroTimer = 0; stopAmbient(); if (typeof document !== "undefined") { document.removeEventListener("visibilitychange", visibilityHandler); document.removeEventListener("keydown", globalKeydown); } if (typeof window !== "undefined") { window.removeEventListener("hh:realtime-ready", realtimeReadyHandler); window.removeEventListener("hh:realtime-offline", realtimeOfflineHandler); if (watchMessageHandler) window.removeEventListener("message", watchMessageHandler); } watchMessageHandler = null; if (host) host.replaceChildren(); host = null; root = null; options = {}; state = null; }

  window.HHPlay = Object.freeze({
    mount, unmount, version: VERSION, views: VIEWS.map((view) => view.id),
    quizQuestions: QUIZ.length,
    quizTopics: Object.freeze(QUIZ_TOPICS.map((topic) => topic.id)),
    capabilities: Object.freeze({ localGames: true, indexedDb: typeof indexedDB !== "undefined", contentPacks: true, authenticatedRealtime: true, fakePresence: false }),
    exportData: () => exportPlayData(false),
    importData: (payload) => importPlayData(payload),
    checkpoint: (label) => createSnapshot(label),
    restoreLatest: () => restoreLatestSnapshot(),
    inspect: () => state ? { version: VERSION, schemaVersion: STATE_SCHEMA_VERSION, view: state.view, source: "indexeddb-with-local-fallback", rooms: state.party.rooms.length, queue: state.watch.queue.length, level: level(), history: state.history.length, achievements: state.achievements.length, contentPacks: state.contentPacks.length, realtime: state.party.realtime.status } : null
  });
})();
