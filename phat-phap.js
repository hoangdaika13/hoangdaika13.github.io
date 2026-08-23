(function initHHPhatPhap(global) {
  "use strict";

  const VERSION = "4.0.0";
  const STATE_PREFIX = "hh.phat-phap.study.v1";
  const JOURNAL_PREFIX = "hh.phat-phap.journal.v1";
  const JOURNAL_ITERATIONS = 180000;

  const SOURCES = Object.freeze([
    {
      id: "suttacentral",
      title: "SuttaCentral",
      organization: "SuttaCentral",
      url: "https://suttacentral.net/",
      licenseUrl: "https://suttacentral.net/licensing",
      note: "Kho kinh điển đa ngôn ngữ. Nguyên bản cổ thuộc phạm vi công cộng; giấy phép bản dịch phải kiểm tra theo từng tài liệu.",
      status: "Nguồn học thuật"
    },
    {
      id: "ghpgvn",
      title: "Giáo hội Phật giáo Việt Nam",
      organization: "GHPGVN",
      url: "https://ghpgvn.vn/",
      note: "Cổng thông tin chính thức để tra cứu hoạt động, thông báo và tổ chức Phật giáo tại Việt Nam.",
      status: "Nguồn chính thức"
    },
    {
      id: "phatsuonline",
      title: "Phật Sự Online",
      organization: "Phật Sự Online",
      url: "https://www.phatsuonline.vn/",
      liveUrl: "https://www.phatsuonline.vn/tin/truyen-hinh-truc-tiep",
      note: "Tin tức, pháp sự và chương trình trực tiếp. Người học được mở nguồn gốc thay vì xem nội dung nhúng không rõ quyền.",
      status: "Kênh Phật sự"
    },
    {
      id: "84000",
      title: "84000 · Translating the Words of the Buddha",
      organization: "84000",
      url: "https://84000.co/reading-room",
      licenseUrl: "https://84000.co/about/terms-of-use",
      note: "Thư viện dịch thuật Kanjur và Tengyur. Chỉ liên kết tới phòng đọc; quyền sử dụng phải được kiểm tra trên từng ấn phẩm.",
      status: "Thư viện dịch thuật"
    }
  ]);

  const LESSONS = Object.freeze([
    { id: "duc-phat", order: 1, title: "Đức Phật và con đường tỉnh thức", duration: 8, tradition: "Căn bản", summary: "Tìm hiểu cuộc đời Đức Phật lịch sử và mục đích thực tiễn của việc học Phật: thấy rõ khổ, nguyên nhân của khổ và con đường chuyển hóa.", practice: "Dành ba phút quan sát hơi thở, chỉ nhận biết mà không phán xét.", sourceId: "suttacentral" },
    { id: "tam-bao", order: 2, title: "Tam Bảo: Phật · Pháp · Tăng", duration: 9, tradition: "Căn bản", summary: "Phật là bậc giác ngộ, Pháp là lời dạy và con đường thực hành, Tăng là cộng đồng tu học chân chính. Quy y là định hướng sống, không phải lời hứa đem lại phép màu.", practice: "Viết một câu về điều bạn muốn chuyển hóa trong đời sống.", sourceId: "ghpgvn" },
    { id: "tu-dieu-de", order: 3, title: "Tứ Diệu Đế", duration: 12, tradition: "Phật giáo sơ kỳ", summary: "Bốn sự thật cao quý trình bày khổ, nguyên nhân, khả năng chấm dứt và con đường thực hành. Đây là khung nhận diện và chuyển hóa, không phải cách nhìn bi quan.", practice: "Nhận diện một khó chịu hôm nay, điều kiện tạo ra nó và một phản ứng lành mạnh hơn.", sourceId: "suttacentral" },
    { id: "bat-chanh-dao", order: 4, title: "Bát Chánh Đạo", duration: 14, tradition: "Phật giáo sơ kỳ", summary: "Tám yếu tố về hiểu biết, ý hướng, lời nói, hành động, sinh kế, nỗ lực, chánh niệm và định được nuôi dưỡng đồng thời trong đời sống.", practice: "Chọn một lời nói chân thật, đúng lúc và có ích để thực hành hôm nay.", sourceId: "suttacentral" },
    { id: "ngu-gioi", order: 5, title: "Ngũ giới trong đời sống", duration: 12, tradition: "Phật giáo Việt Nam", summary: "Năm nguyên tắc tự nguyện giúp bảo hộ sự sống, tài sản, quan hệ, lời nói và sự tỉnh táo. Giới là nền tảng quan sát và chịu trách nhiệm, không phải công cụ phán xét người khác.", practice: "Quan sát một thói quen có thể làm mình hoặc người khác tổn thương và chọn một thay đổi nhỏ.", sourceId: "ghpgvn" },
    { id: "nhan-qua", order: 6, title: "Nghiệp và nhân quả đúng nghĩa", duration: 13, tradition: "Đối chiếu nhiều truyền thống", summary: "Nghiệp nhấn mạnh hành động có chủ ý và hệ quả của thói quen. Không dùng nhân quả để đổ lỗi cho nạn nhân, đoán định số phận hoặc thay thế hỗ trợ y tế, pháp lý và tâm lý.", practice: "Trước một hành động, dừng lại và hỏi: ý định này có đưa tới lợi mình, lợi người không?", sourceId: "suttacentral" },
    { id: "thien-hoi-tho", order: 7, title: "Thiền hơi thở cho người mới", duration: 10, tradition: "Thực hành căn bản", summary: "Ngồi vững, thả lỏng, biết hơi thở vào và ra. Khi tâm đi xa, nhận biết rồi nhẹ nhàng trở lại. Không ép hơi thở và không dùng thiền thay cho điều trị chuyên môn.", practice: "Thực hành năm phút với timer, chuông nhỏ ở đầu và cuối.", sourceId: "suttacentral" },
    { id: "niem-phat", order: 8, title: "Niệm Phật với sự tỉnh thức", duration: 10, tradition: "Tịnh độ", summary: "Niệm danh hiệu Phật có thể giúp thu nhiếp tâm và nuôi dưỡng nguyện lành. Số lần là dữ liệu cá nhân để duy trì thời khóa, không được quy đổi thành công đức hay xếp hạng.", practice: "Niệm chậm, nghe rõ từng âm và giữ thân tâm thư giãn trong ba phút.", sourceId: "ghpgvn" },
    { id: "di-chua", order: 9, title: "Cách đi chùa trang nghiêm", duration: 9, tradition: "Văn hóa Phật giáo Việt Nam", summary: "Trang phục lịch sự, nói nhỏ, tôn trọng nội quy, không chụp hoặc phát trực tiếp khi chưa được phép. Cúng dường tự nguyện và minh bạch; không mua bán niềm tin.", practice: "Chuẩn bị một câu hỏi học Pháp rõ ràng thay vì cầu xin kết quả siêu nhiên.", sourceId: "ghpgvn" },
    { id: "thoi-khoa", order: 10, title: "Xây thời khóa bền vững", duration: 11, tradition: "Ứng dụng", summary: "Một thời khóa vừa sức gồm học, thực hành, suy ngẫm và hành động thiện lành. Tính đều đặn quan trọng hơn số phút lớn hoặc chuỗi thành tích.", practice: "Chọn lịch 7, 21 hoặc 49 ngày và đặt khung giờ phù hợp thực tế.", sourceId: "ghpgvn" }
  ]);

  const TEACHINGS = Object.freeze([
    { id: "tu-dieu-de", title: "Tứ Diệu Đế", category: "Nền tảng", tradition: "Phật giáo sơ kỳ", intro: "Khung thực hành để nhận diện khổ và con đường chuyển hóa.", deep: "Quan sát trực tiếp trải nghiệm thay vì chỉ ghi nhớ khái niệm. Mỗi sự thật gắn với một việc cần làm: hiểu, buông, chứng nghiệm và tu tập.", application: "Dùng bốn câu hỏi: điều gì đang khó chịu, điều gì nuôi nó, trạng thái nào lành mạnh hơn, bước đúng đắn tiếp theo là gì?", sourceId: "suttacentral" },
    { id: "bat-chanh-dao", title: "Bát Chánh Đạo", category: "Nền tảng", tradition: "Phật giáo sơ kỳ", intro: "Tám phương diện của một đời sống có hiểu biết, đạo đức và định tĩnh.", deep: "Các yếu tố nâng đỡ nhau; không nên tách thiền khỏi lời nói, hành động và sinh kế.", application: "Mỗi tuần chọn một phương diện để quan sát nhưng vẫn giữ cái nhìn toàn thể.", sourceId: "suttacentral" },
    { id: "ngu-uan", title: "Ngũ uẩn", category: "Tuệ quán", tradition: "Phật giáo sơ kỳ", intro: "Sắc, thọ, tưởng, hành và thức là năm nhóm tiến trình tạo nên kinh nghiệm.", deep: "Thấy các tiến trình thay đổi giúp bớt đồng nhất cứng nhắc với cảm giác, ý nghĩ và vai trò.", application: "Khi cảm xúc mạnh xuất hiện, gọi tên cảm giác thân thể, cảm thọ, nhận diện, phản ứng và nhận biết.", sourceId: "suttacentral" },
    { id: "duyen-khoi", title: "Duyên khởi", category: "Tuệ quán", tradition: "Đối chiếu nhiều truyền thống", intro: "Mọi hiện tượng nương nhiều điều kiện mà hình thành và biến đổi.", deep: "Duyên khởi tránh cả hai cực đoan: cho rằng mọi thứ cố định hoặc hoàn toàn ngẫu nhiên.", application: "Tìm các điều kiện có thể thay đổi trong một vấn đề, thay vì quy kết vào một nguyên nhân duy nhất.", sourceId: "suttacentral" },
    { id: "tu-vo-luong-tam", title: "Tứ Vô Lượng Tâm", category: "Nuôi dưỡng tâm", tradition: "Đối chiếu nhiều truyền thống", intro: "Từ, bi, hỷ và xả là bốn phẩm chất rộng lớn có thể rèn luyện.", deep: "Từ không phải nuông chiều; bi không phải thương hại; hỷ không phải so sánh; xả không phải thờ ơ.", application: "Bắt đầu với lời nguyện lành thực tế cho bản thân rồi mở rộng dần tới người khác.", sourceId: "suttacentral" },
    { id: "chanh-niem", title: "Chánh niệm", category: "Thực hành", tradition: "Đối chiếu nhiều truyền thống", intro: "Khả năng nhớ biết rõ điều đang xảy ra trong thân và tâm.", deep: "Chánh niệm đi cùng tỉnh giác và định hướng đạo đức; không chỉ là kỹ thuật tăng năng suất.", application: "Đặt ba khoảng dừng một phút trong ngày: biết thân, biết cảm thọ, biết ý định tiếp theo.", sourceId: "suttacentral" },
    { id: "bo-tat-hanh", title: "Bồ-tát hạnh", category: "Đại thừa", tradition: "Phật giáo Đại thừa", intro: "Con đường nuôi dưỡng trí tuệ và lòng bi mẫn vì lợi ích của muôn loài.", deep: "Nhiều truyền thống trình bày hệ thống thực hành khác nhau; cần đọc trong bối cảnh và theo hướng dẫn đáng tin cậy.", application: "Chọn một việc giúp người cụ thể, kín đáo và trong khả năng, không biến nó thành phương tiện khoe thành tích.", sourceId: "ghpgvn" },
    { id: "tinh-do", title: "Tịnh độ và tín–nguyện–hạnh", category: "Tịnh độ", tradition: "Phật giáo Đại thừa", intro: "Pháp môn nhấn mạnh niềm tin có hiểu biết, nguyện hướng thiện và thực hành niệm Phật.", deep: "Cách giải thích khác nhau theo tông phái; nền tảng vẫn là chuyển hóa thân, khẩu và ý trong đời sống.", application: "Kết hợp thời niệm Phật ngắn với một việc thiện và một lần nhìn lại lời nói trong ngày.", sourceId: "ghpgvn" }
  ]);

  const SCRIPTURES = Object.freeze([
    { id: "dhammacakkappavattana", code: "SN 56.11", canonicalTitle: "Dhammacakkappavattanasutta", title: "Kinh Chuyển Pháp Luân", collection: "Tương Ưng Bộ", tradition: "Phật giáo sơ kỳ", sourceLanguage: "Pāli", translator: "Xem theo bản dịch đang chọn tại nguồn", license: "Theo từng bản dịch tại SuttaCentral", verifiedAt: "2026-08-23", type: "Kinh", topic: "Nền tảng", difficulty: "Nhập môn", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/sn56.11", verified: true, parallelIds: ["tu-dieu-de", "bat-chanh-dao"], summary: "Bài kinh trình bày Trung đạo, Tứ Diệu Đế và cách mỗi sự thật gắn với nhận biết, nhiệm vụ cùng sự hoàn tất. Đây là tóm lược nguyên bản của HH, không phải bản dịch kinh văn.", keywords: "tứ diệu đế trung đạo khổ" },
    { id: "metta", code: "Snp 1.8", canonicalTitle: "Karaṇīyamettasutta", title: "Kinh Từ Bi", collection: "Tiểu Bộ", tradition: "Phật giáo sơ kỳ", sourceLanguage: "Pāli", translator: "Xem theo bản dịch đang chọn tại nguồn", license: "Theo từng bản dịch tại SuttaCentral", verifiedAt: "2026-08-23", type: "Kinh", topic: "Từ bi", difficulty: "Nhập môn", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/snp1.8", verified: true, parallelIds: ["tu-vo-luong-tam"], summary: "Văn bản nuôi dưỡng tâm từ rộng lớn, đi cùng đời sống ngay thẳng, khiêm cung và biết đủ. Phần hiển thị là tóm lược học tập, không thay thế bản dịch được cấp phép.", keywords: "từ bi tâm từ metta" },
    { id: "mangala", code: "Snp 2.4", canonicalTitle: "Maṅgalasutta", title: "Kinh Điềm Lành", collection: "Tiểu Bộ", tradition: "Phật giáo sơ kỳ", sourceLanguage: "Pāli", translator: "Xem theo bản dịch đang chọn tại nguồn", license: "Theo từng bản dịch tại SuttaCentral", verifiedAt: "2026-08-23", type: "Kinh", topic: "Đời sống", difficulty: "Nhập môn", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/snp2.4", verified: true, parallelIds: ["ngu-gioi"], summary: "Điềm lành được trình bày qua lựa chọn bạn lành, học hỏi, hiếu kính, nghề nghiệp chân chính và tâm vững trước biến đổi, thay vì qua bói đoán.", keywords: "điềm lành đời sống đạo đức" },
    { id: "anapanasati", code: "MN 118", canonicalTitle: "Ānāpānassatisutta", title: "Kinh Niệm Hơi Thở", collection: "Trung Bộ", tradition: "Phật giáo sơ kỳ", sourceLanguage: "Pāli", translator: "Xem theo bản dịch đang chọn tại nguồn", license: "Theo từng bản dịch tại SuttaCentral", verifiedAt: "2026-08-23", type: "Kinh", topic: "Thiền", difficulty: "Thực hành", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/mn118", verified: true, parallelIds: ["chanh-niem"], summary: "Trình bày tiến trình niệm hơi thở gắn với thân, cảm thọ, tâm và pháp. Người mới nên bắt đầu nhẹ nhàng và tìm hướng dẫn đủ chuyên môn khi có phản ứng tâm lý bất thường.", keywords: "thiền hơi thở anapanasati" },
    { id: "heart", code: "T 251", canonicalTitle: "Prajñāpāramitāhṛdaya", title: "Bát Nhã Tâm Kinh", collection: "Kinh Đại thừa", tradition: "Đại thừa", sourceLanguage: "Sanskrit · Hán văn", translator: "Xem metadata của bản đang đọc", license: "Theo từng bản dịch tại nguồn", verifiedAt: "2026-08-23", type: "Kinh", topic: "Trí tuệ", difficulty: "Nghiên cứu", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/taisho251", verified: true, parallelIds: ["duyen-khoi", "ngu-uan"], summary: "Bản kinh ngắn khai triển trí tuệ Bát Nhã và tính không của các pháp. Cần học cùng chú giải có bối cảnh để tránh hiểu tính không thành phủ nhận đạo đức hoặc đời sống.", keywords: "bát nhã tâm kinh tính không" },
    { id: "sigalovada", code: "DN 31", canonicalTitle: "Sigālovādasutta", title: "Kinh Giáo Thọ Thi-ca-la-việt", collection: "Trường Bộ", tradition: "Phật giáo sơ kỳ", sourceLanguage: "Pāli", translator: "Xem theo bản dịch đang chọn tại nguồn", license: "Theo từng bản dịch tại SuttaCentral", verifiedAt: "2026-08-23", type: "Kinh", topic: "Đời sống", difficulty: "Thực hành", sourceId: "suttacentral", sourceUrl: "https://suttacentral.net/dn31", verified: true, parallelIds: ["ngu-gioi"], summary: "Các mối quan hệ gia đình, bạn bè, thầy trò và công việc được nhìn qua trách nhiệm hai chiều. Đây là nguồn hữu ích để đưa giáo lý vào đời sống xã hội.", keywords: "gia đình quan hệ trách nhiệm xã hội" }
  ]);

  const GLOSSARY = Object.freeze([
    { id: "dhamma", pali: "Dhamma", sanskrit: "Dharma", han: "法", hanViet: "Pháp", vietnamese: "Lời dạy, sự thật và con đường thực hành", note: "Nghĩa thay đổi theo ngữ cảnh; không nên dịch mọi trường hợp bằng một từ duy nhất.", related: ["Tứ Diệu Đế", "Bát Chánh Đạo"] },
    { id: "sati", pali: "Sati", sanskrit: "Smṛti", han: "念", hanViet: "Niệm", vietnamese: "Khả năng nhớ biết rõ điều đang xảy ra", note: "Thường được dịch là chánh niệm khi đi cùng định hướng đúng đắn và tỉnh giác.", related: ["Tứ niệm xứ", "Thiền hơi thở"] },
    { id: "metta", pali: "Mettā", sanskrit: "Maitrī", han: "慈", hanViet: "Từ", vietnamese: "Ước nguyện chân thành cho mình và người được an lành", note: "Không đồng nghĩa với nuông chiều hay đồng ý với mọi hành vi.", related: ["Tứ Vô Lượng Tâm", "Kinh Từ Bi"] },
    { id: "karuna", pali: "Karuṇā", sanskrit: "Karuṇā", han: "悲", hanViet: "Bi", vietnamese: "Khả năng nhận ra khổ và mong muốn làm vơi khổ", note: "Không phải thương hại; lòng bi cần đi cùng trí tuệ và giới hạn lành mạnh.", related: ["Tứ Vô Lượng Tâm"] },
    { id: "kamma", pali: "Kamma", sanskrit: "Karma", han: "業", hanViet: "Nghiệp", vietnamese: "Hành động có chủ ý và khuynh hướng được tạo bởi hành động", note: "Không dùng nghiệp để quy kết nạn nhân, đoán số phận hoặc từ chối trợ giúp chuyên môn.", related: ["Nghiệp và nhân quả"] },
    { id: "nibbana", pali: "Nibbāna", sanskrit: "Nirvāṇa", han: "涅槃", hanViet: "Niết-bàn", vietnamese: "Thuật ngữ chỉ sự đoạn tận tham, sân và si", note: "Các truyền thống có hệ thống giải thích khác nhau; nên học với bối cảnh và vị thầy đủ phẩm hạnh.", related: ["Tứ Diệu Đế"] }
  ]);

  const GLOSSARY_DETAILS = Object.freeze({
    dhamma: { pronunciation: "đăm-ma", etymology: "Từ căn dhṛ trong Sanskrit, mang nghĩa nâng đỡ hoặc duy trì; nghĩa cụ thể thay đổi theo văn cảnh.", contexts: "Có thể chỉ lời dạy, hiện tượng, phẩm chất hoặc con đường thực hành tùy bộ kinh.", misunderstanding: "Không nên mặc định mọi chữ Dhamma đều có nghĩa duy nhất là “giáo lý”.", backlinks: ["Kinh Chuyển Pháp Luân", "Bát Chánh Đạo", "Duyên khởi"] },
    sati: { pronunciation: "sa-ti", etymology: "Liên hệ với nghĩa nhớ, ghi nhớ và không quên đối tượng thực hành.", contexts: "Trong các bài thiền, sati thường đi cùng tỉnh giác, nỗ lực đúng và nền tảng đạo đức.", misunderstanding: "Không chỉ là chú ý trung tính để tăng hiệu suất hoặc ép mình luôn bình tĩnh.", backlinks: ["Kinh Niệm Hơi Thở", "Chánh niệm", "Thiền đường số"] },
    metta: { pronunciation: "mét-ta", etymology: "Liên hệ với mitta, nghĩa là bạn hữu; chỉ thái độ thân thiện và mong cầu an lành.", contexts: "Được triển khai trong các thực hành tâm từ và những bài kinh thuộc nhiều truyền thống.", misunderstanding: "Tâm từ không đòi hỏi đồng ý với hành vi gây hại hay xóa bỏ giới hạn an toàn.", backlinks: ["Kinh Từ Bi", "Tứ Vô Lượng Tâm", "Pháp học đời sống"] },
    karuna: { pronunciation: "ka-ru-na", etymology: "Thuật ngữ Pāli/Sanskrit chỉ sự rung động trước đau khổ cùng ý hướng làm vơi khổ.", contexts: "Cách trình bày có khác nhau giữa các truyền thống; thường đi cùng trí tuệ và phương tiện thích hợp.", misunderstanding: "Không phải thương hại, cứu giúp quá khả năng hoặc chịu đựng bạo hành.", backlinks: ["Tứ Vô Lượng Tâm", "Kinh Từ Bi", "Pháp học đời sống"] },
    kamma: { pronunciation: "kam-ma", etymology: "Kamma trong Pāli, karma trong Sanskrit, nghĩa căn bản là hành động; giáo lý nhấn mạnh hành động có chủ ý.", contexts: "Được dùng khi khảo sát ý định, thói quen và hệ quả, không phải một công thức đoán định cá nhân.", misunderstanding: "Không dùng để đổ lỗi cho nạn nhân, giải thích mọi tai nạn hoặc từ chối trợ giúp.", backlinks: ["Nghiệp và nhân quả đúng nghĩa", "Kinh Điềm Lành", "Ngũ giới"] },
    nibbana: { pronunciation: "nib-ba-na", etymology: "Nibbāna trong Pāli, Nirvāṇa trong Sanskrit; thường được giải thích qua hình ảnh dập tắt lửa tham, sân và si.", contexts: "Các truyền thống có hệ thống diễn giải và thuật ngữ liên hệ khác nhau.", misunderstanding: "Không nên giản lược thành hư vô, cái chết hoặc một lời hứa thoát khỏi trách nhiệm đời sống.", backlinks: ["Kinh Chuyển Pháp Luân", "Tứ Diệu Đế", "Bát Nhã Tâm Kinh"] }
  });

  const DHARMA_MAP = Object.freeze([
    { id: "four-truths", label: "Tứ Diệu Đế", icon: "四", summary: "Khung nhận diện khổ, nguyên nhân, khả năng chấm dứt và con đường.", links: ["eightfold", "dependent"] },
    { id: "eightfold", label: "Bát Chánh Đạo", icon: "八", summary: "Tuệ, giới và định được nuôi dưỡng đồng thời.", links: ["threefold", "seven"] },
    { id: "threefold", label: "Tam học", icon: "三", summary: "Giới · Định · Tuệ là cấu trúc thực hành hỗ trợ lẫn nhau.", links: ["mindfulness"] },
    { id: "aggregates", label: "Ngũ uẩn", icon: "五", summary: "Năm nhóm tiến trình tạo nên kinh nghiệm đang diễn ra.", links: ["dependent", "mindfulness"] },
    { id: "dependent", label: "Thập nhị nhân duyên", icon: "緣", summary: "Khảo sát cách các điều kiện nương nhau hình thành và chấm dứt.", links: ["four-truths", "aggregates"] },
    { id: "mindfulness", label: "Tứ niệm xứ", icon: "念", summary: "Quán thân, thọ, tâm và pháp với sự tỉnh giác.", links: ["seven"] },
    { id: "seven", label: "Thất giác chi", icon: "七", summary: "Bảy yếu tố hỗ trợ tiến trình tỉnh thức.", links: ["eightfold"] }
  ]);

  const CHANTS = Object.freeze([
    { id: "refuge", tradition: "Căn bản", title: "Ba lần hướng về Tam Bảo", sourceLabel: "Bài thực tập HH · không phải bản kinh dịch", lines: [
      { text: "Con xin hướng về Phật, người chỉ đường tỉnh thức.", transliteration: "Buddhaṃ saraṇaṃ gacchāmi", meaning: "Nương tựa phẩm chất giác ngộ và con đường tỉnh thức." },
      { text: "Con xin hướng về Pháp, con đường hiểu và thương.", transliteration: "Dhammaṃ saraṇaṃ gacchāmi", meaning: "Nương tựa giáo pháp có thể học, thực hành và kiểm nghiệm." },
      { text: "Con xin hướng về Tăng, đoàn thể cùng tu học.", transliteration: "Saṅghaṃ saraṇaṃ gacchāmi", meaning: "Nương tựa cộng đồng tu học chân chính và có giới hạnh." }
    ] },
    { id: "loving-kindness", tradition: "Tâm từ", title: "Lời nguyện lành ngắn", sourceLabel: "Bài thực tập HH · diễn đạt hiện đại", lines: [
      { text: "Nguyện cho tôi được an ổn và sáng suốt.", transliteration: "Mettā · lời hướng dẫn tiếng Việt", meaning: "Bắt đầu bằng thái độ không gây hại và biết chăm sóc bản thân." },
      { text: "Nguyện cho người thân được an ổn và sáng suốt.", transliteration: "Mettā · lời hướng dẫn tiếng Việt", meaning: "Mở rộng ý nguyện lành tới người gần gũi." },
      { text: "Nguyện cho mọi người được an ổn và biết nâng đỡ nhau.", transliteration: "Mettā · lời hướng dẫn tiếng Việt", meaning: "Mở rộng tâm từ nhưng vẫn giữ giới hạn và trách nhiệm." }
    ] }
  ]);

  const LEARNING_TIERS = Object.freeze([
    { id: "intro", label: "Nhập môn", icon: "初", lessonIds: ["duc-phat", "tam-bao", "tu-dieu-de", "bat-chanh-dao", "ngu-gioi"], description: "Hiểu nền tảng bằng tiếng Việt rõ ràng, không đòi hỏi kiến thức trước." },
    { id: "practice", label: "Thực hành", icon: "行", lessonIds: ["nhan-qua", "thien-hoi-tho", "niem-phat", "di-chua", "thoi-khoa"], description: "Đưa chánh niệm, giới và thời khóa vừa sức vào đời sống." },
    { id: "deep", label: "Nghiên cứu sâu", icon: "慧", lessonIds: ["tu-dieu-de", "bat-chanh-dao", "nhan-qua", "thien-hoi-tho"], description: "Đọc đối chiếu kinh, thuật ngữ và khác biệt truyền thống; không khóa cứng." }
  ]);

  const LIFE_JOURNEYS = Object.freeze([
    { id: "anxiety", icon: "息", title: "Khi căng thẳng, mất ngủ hoặc bất an", recognize: "Nhận biết thân đang căng, suy nghĩ lặp lại và nhu cầu nghỉ ngơi; không tự kết luận đây chỉ là vấn đề tinh thần.", teachingId: "chanh-niem", scriptureId: "anapanasati", practice: "Ngồi hoặc nằm an toàn, mở mắt nếu cần và theo dõi năm hơi thở tự nhiên trong 5 phút.", reflection: "Điều kiện nào có thể được giảm bớt ngay hôm nay mà không né tránh trách nhiệm?", support: "Tìm bác sĩ hoặc chuyên gia tâm lý khi mất ngủ kéo dài, hoảng sợ, khó thở, tuyệt vọng hoặc ảnh hưởng nghiêm trọng tới sinh hoạt." },
    { id: "anger", icon: "水", title: "Khi giận dữ và xung đột", recognize: "Gọi tên cảm giác trong thân trước khi tranh luận; tạm dừng không đồng nghĩa né tránh vấn đề.", teachingId: "tu-vo-luong-tam", scriptureId: "metta", practice: "Dừng 10 phút trước khi phản hồi, thả lỏng bàn tay và chọn một câu nói chân thật, đúng lúc, có ích.", reflection: "Mình đang bảo vệ điều gì và có thể nói nhu cầu đó mà không làm tổn thương ai?", support: "Rời nơi nguy hiểm và tìm hỗ trợ khẩn cấp khi có nguy cơ bạo lực, tự hại hoặc gây hại." },
    { id: "grief", icon: "蓮", title: "Khi mất người thân", recognize: "Đau buồn có nhiều nhịp độ. Phật pháp không yêu cầu bạn phải bình an ngay hoặc dùng vô thường để phủ nhận cảm xúc.", teachingId: "duyen-khoi", scriptureId: "metta", practice: "Dành 7 phút nhớ một phẩm chất lành của người đã mất và cho phép cảm xúc hiện diện.", reflection: "Hôm nay mình cần được nâng đỡ theo cách cụ thể nào?", support: "Tìm người thân, cộng đồng hoặc chuyên gia khi đau buồn khiến bạn mất khả năng chăm sóc bản thân hay có ý nghĩ tự hại." },
    { id: "family", icon: "家", title: "Gia đình, hôn nhân và nuôi dạy con", recognize: "Phân biệt nhu cầu, giới hạn và trách nhiệm hai chiều; không dùng hiếu đạo hay nghiệp để ép một người chịu bạo hành.", teachingId: "ngu-gioi", scriptureId: "sigalovada", practice: "Thực hành một cuộc trò chuyện 10 phút: nghe hết câu, nhắc lại điều đã hiểu rồi mới trả lời.", reflection: "Giới hạn nào giúp cả hai bên an toàn và tôn trọng hơn?", support: "Liên hệ dịch vụ bảo vệ, pháp lý hoặc chuyên gia khi có bạo lực, kiểm soát hay trẻ em không an toàn." },
    { id: "work", icon: "業", title: "Áp lực công việc và tiền bạc", recognize: "Nhìn rõ áp lực thực tế, điều có thể kiểm soát và điều cần hỗ trợ chuyên môn; không xem khó khăn tài chính là nghiệp báo.", teachingId: "bat-chanh-dao", scriptureId: "mangala", practice: "Trong 10 phút, ghi ba việc: cần làm, có thể hoãn và cần nhờ người khác hỗ trợ.", reflection: "Quyết định tiếp theo có phù hợp với sinh kế chân chính và sức khỏe không?", support: "Tìm tư vấn tài chính, pháp lý hoặc y tế phù hợp khi vấn đề vượt quá khả năng tự xử lý." },
    { id: "gratitude", icon: "慈", title: "Nuôi dưỡng lòng từ và sự biết ơn", recognize: "Biết ơn không phủ nhận khó khăn; lòng từ bắt đầu bằng thái độ không gây hại cho mình và người.", teachingId: "tu-vo-luong-tam", scriptureId: "metta", practice: "Trong 8 phút, nhớ ba sự nâng đỡ cụ thể và gửi một lời cảm ơn chân thành, không phô trương.", reflection: "Mình có thể biến lòng biết ơn thành một hành động chăm sóc cụ thể nào?", support: "Nếu thực hành làm dấy lên ký ức đau buồn mạnh, hãy dừng và chọn một người an toàn để trò chuyện." },
    { id: "letting-go", icon: "放", title: "Buông bỏ mà không trốn tránh trách nhiệm", recognize: "Buông là giảm bám chấp vào cách mọi thứ phải diễn ra, không phải bỏ mặc hậu quả hay nghĩa vụ.", teachingId: "duyen-khoi", scriptureId: "dhammacakkappavattana", practice: "Dành 12 phút chia giấy thành hai cột: việc cần chịu trách nhiệm và điều không thể kiểm soát.", reflection: "Mình cần hoàn thành trách nhiệm nào trước khi nói rằng đã buông?", support: "Hỏi người có chuyên môn khi quyết định liên quan sức khỏe, pháp lý, tài chính hoặc an toàn của người khác." }
  ]);

  const SCRIPTURE_SEGMENTS = Object.freeze({
    dhammacakkappavattana: [
      { id: "sn56.11-1", label: "Bối cảnh", reference: "SN 56.11 · đoạn mở đầu", summary: "Bài giảng được đặt trong bối cảnh lần chuyển vận bánh xe Pháp đầu tiên.", terms: ["dhamma"] },
      { id: "sn56.11-2", label: "Trung đạo", reference: "SN 56.11 · phần Trung đạo", summary: "Con đường thực hành tránh hai cực đoan và hướng đến hiểu biết trực tiếp.", terms: ["dhamma"] },
      { id: "sn56.11-3", label: "Bốn sự thật", reference: "SN 56.11 · phần Tứ Diệu Đế", summary: "Mỗi sự thật đi cùng một nhiệm vụ thực hành, không chỉ là điều để ghi nhớ.", terms: ["dhamma", "nibbana"] }
    ],
    metta: [
      { id: "snp1.8-1", label: "Phẩm chất nền", reference: "Snp 1.8 · phần đầu", summary: "Tâm từ đi cùng sự ngay thẳng, khiêm cung, biết đủ và dễ được nhắc nhở.", terms: ["metta"] },
      { id: "snp1.8-2", label: "Không gây hại", reference: "Snp 1.8 · phần giữa", summary: "Ý nguyện lành được mở rộng mà không nuôi dưỡng ý định làm hại.", terms: ["metta", "karuna"] },
      { id: "snp1.8-3", label: "Tâm rộng lớn", reference: "Snp 1.8 · phần cuối", summary: "Việc tu tập hướng đến thái độ rộng mở, bền vững trong các tư thế đời thường.", terms: ["metta"] }
    ],
    mangala: [
      { id: "snp2.4-1", label: "Môi trường lành", reference: "Snp 2.4 · nhóm đầu", summary: "Bạn lành, môi trường phù hợp và nền học tập đúng giúp nâng đỡ đời sống.", terms: ["dhamma"] },
      { id: "snp2.4-2", label: "Trách nhiệm", reference: "Snp 2.4 · nhóm giữa", summary: "Gia đình, nghề nghiệp và hành vi chân chính là phần của đời sống tốt đẹp.", terms: ["kamma"] },
      { id: "snp2.4-3", label: "Tâm vững", reference: "Snp 2.4 · nhóm cuối", summary: "Điềm lành được nhận biết qua phẩm chất và sự vững chãi, không qua bói đoán.", terms: ["nibbana"] }
    ],
    anapanasati: [
      { id: "mn118-1", label: "Chuẩn bị", reference: "MN 118 · thiết lập thực hành", summary: "Chọn tư thế ổn định và nhận biết hơi thở tự nhiên trong giới hạn an toàn.", terms: ["sati"] },
      { id: "mn118-2", label: "Thân và cảm thọ", reference: "MN 118 · nhóm thân, thọ", summary: "Sự chú ý được mở rộng từ hơi thở tới toàn thân và cảm thọ đang sinh khởi.", terms: ["sati"] },
      { id: "mn118-3", label: "Tâm và pháp", reference: "MN 118 · nhóm tâm, pháp", summary: "Tiến trình tiếp tục với trạng thái tâm và các phẩm chất hỗ trợ tuệ giác.", terms: ["sati", "dhamma"] }
    ],
    heart: [
      { id: "t251-1", label: "Ngũ uẩn", reference: "T 251 · phần quán chiếu", summary: "Ngũ uẩn được khảo sát trong ánh sáng của trí tuệ Bát Nhã.", terms: ["dhamma"] },
      { id: "t251-2", label: "Tính không", reference: "T 251 · phần trung tâm", summary: "Các khái niệm cần được đọc cùng chú giải để tránh hiểu tính không thành phủ nhận đời sống.", terms: ["dhamma"] },
      { id: "t251-3", label: "Thực hành trí tuệ", reference: "T 251 · phần kết", summary: "Văn bản hướng người học về trí tuệ không mắc kẹt trong sợ hãi và chấp trước.", terms: ["nibbana"] }
    ],
    sigalovada: [
      { id: "dn31-1", label: "Bối cảnh", reference: "DN 31 · phần mở đầu", summary: "Nghi lễ được giải thích lại thành cách chăm sóc các mối quan hệ thực tế.", terms: ["dhamma"] },
      { id: "dn31-2", label: "Trách nhiệm hai chiều", reference: "DN 31 · các phương", summary: "Cha mẹ, con cái, thầy trò, bạn bè và người lao động đều có trách nhiệm qua lại.", terms: ["kamma"] },
      { id: "dn31-3", label: "Bảo hộ đời sống", reference: "DN 31 · phần kết", summary: "Đời sống được bảo hộ bằng hành vi, quan hệ và cách sử dụng tài sản có trách nhiệm.", terms: ["dhamma"] }
    ]
  });

  const MEDITATION_COURSE = Object.freeze([
    { day: 1, title: "Ngồi vững và biết mình đang thở", type: "breath", minutes: 5 },
    { day: 2, title: "Trở về hơi thở sau khi tâm đi xa", type: "breath", minutes: 7 },
    { day: 3, title: "Nhận biết điểm tiếp xúc của thân", type: "body", minutes: 8 },
    { day: 4, title: "Gọi tên cảm thọ mà không phán xét", type: "feeling", minutes: 8 },
    { day: 5, title: "Nuôi dưỡng một lời nguyện lành", type: "kindness", minutes: 10 },
    { day: 6, title: "Thiền đi bộ chậm và an toàn", type: "walking", minutes: 10 },
    { day: 7, title: "Tự xây thời khóa vừa sức", type: "breath", minutes: 12 }
  ]);

  const TEMPLE_DIRECTORY = Object.freeze([
    { id: "ghpgvn-directory", province: "Toàn quốc", tradition: "Nhiều truyền thống", access: "Tra cứu tại nguồn", title: "Danh bạ Giáo hội Phật giáo Việt Nam", organization: "GHPGVN", url: "https://ghpgvn.vn/", verified: true, verifiedAt: "2026-08-23", note: "Dùng cổng chính thức để tìm Ban Trị sự và thông tin địa phương. HH không lưu số điện thoại hay tài khoản cúng dường." },
    { id: "phatsu-events", province: "Toàn quốc", tradition: "Phật giáo Việt Nam", access: "Livestream và tin tức", title: "Lịch Phật sự công khai", organization: "Phật Sự Online", url: "https://www.phatsuonline.vn/", verified: true, verifiedAt: "2026-08-23", note: "Theo dõi thông báo, chương trình và truyền hình trực tiếp tại trang của đơn vị cung cấp." }
  ]);

  const SOURCE_HISTORY = Object.freeze([
    { id: "source-2026-08-23", at: "2026-08-23", editor: "HH Editorial", action: "Bổ sung mã kinh, nguyên ngữ, ngôn ngữ nguồn và trạng thái giấy phép.", status: "Đã xuất bản" },
    { id: "source-2026-08-22", at: "2026-08-22", editor: "HH Editorial", action: "Đối chiếu liên kết SuttaCentral và nguồn chính thức tại Việt Nam.", status: "Đã xuất bản" },
    { id: "source-2026-08-21", at: "2026-08-21", editor: "HH Editorial", action: "Tách tóm lược HH khỏi nhãn bản dịch và nguyên văn.", status: "Đã xuất bản" }
  ]);

  const TALKS = Object.freeze([
    { id: "phatsu-live", title: "Truyền hình trực tiếp Phật sự", provider: "Phật Sự Online", type: "Trực tiếp", url: "https://www.phatsuonline.vn/tin/truyen-hinh-truc-tiep", note: "Mở lịch phát và chương trình trực tiếp tại nguồn chính thức." },
    { id: "phatsu-youtube", title: "Phật Sự Online TV", provider: "Phật Sự Online", type: "Video", url: "https://www.youtube.com/PhatsuonlineTV", note: "Kênh YouTube của Phật Sự Online; nội dung và quyền phát thuộc đơn vị cung cấp." },
    { id: "ghpgvn-news", title: "Tin và hoạt động Giáo hội", provider: "GHPGVN", type: "Thông tin", url: "https://ghpgvn.vn/", note: "Tra cứu thông báo và hoạt động từ cổng Giáo hội Phật giáo Việt Nam." },
    { id: "suttacentral-guide", title: "Tra cứu kinh điển đa ngôn ngữ", provider: "SuttaCentral", type: "Thư viện", url: "https://suttacentral.net/", note: "Đọc metadata, nguyên bản và các bản dịch với giấy phép hiển thị trên từng trang." }
  ]);

  const NAV = Object.freeze([
    { id: "today", label: "Hôm nay", icon: "灯", group: "Bắt đầu" },
    { id: "beginner", label: "Lộ trình tu học", icon: "路", group: "Bắt đầu" },
    { id: "situations", label: "Pháp học đời sống", icon: "心", group: "Bắt đầu" },
    { id: "teachings", label: "Giáo lý", icon: "法", group: "Học Pháp" },
    { id: "scriptures", label: "Scripture Study Lab", icon: "經", group: "Học Pháp" },
    { id: "glossary", label: "Từ điển Phật học", icon: "字", group: "Học Pháp" },
    { id: "map", label: "Bản đồ giáo pháp", icon: "圖", group: "Học Pháp" },
    { id: "provenance", label: "Kiểm chứng nguồn", icon: "證", group: "Học Pháp" },
    { id: "qna", label: "Hỏi đáp có nguồn", icon: "問", group: "Học Pháp" },
    { id: "review", label: "Ôn giáo lý", icon: "習", group: "Học Pháp" },
    { id: "practice", label: "Thiền đường số", icon: "禪", group: "Thực hành" },
    { id: "chanting", label: "Phòng tụng niệm", icon: "誦", group: "Thực hành" },
    { id: "audio", label: "Thư viện nghe", icon: "聽", group: "Thực hành" },
    { id: "schedule", label: "Lịch tu học", icon: "曆", group: "Thực hành" },
    { id: "temple", label: "Chùa online", icon: "寺", group: "Kết nối" },
    { id: "talks", label: "Pháp thoại", icon: "聽", group: "Kết nối" },
    { id: "request", label: "Thỉnh kinh", icon: "請", group: "Kết nối" },
    { id: "circles", label: "Nhóm đọc riêng tư", icon: "眾", group: "Kết nối" },
    { id: "journal", label: "Nhật ký mã hóa", icon: "記", group: "Cá nhân" },
    { id: "accessibility", label: "Trợ năng", icon: "輔", group: "Cá nhân" },
    { id: "data-control", label: "Tủ dữ liệu", icon: "庫", group: "Cá nhân" }
  ]);

  const DEFAULT_STATE = Object.freeze({
    completedLessons: [], bookmarks: [], lessonNotes: {}, practiceHistory: [], chantCount: 0,
    savedTalks: [], savedSources: [], studySchedule: { program: 7, minutes: 15, time: "20:00" },
    recentScripture: "", routineProgress: {}, printRequests: [], events: [],
    learningTier: "intro", lifePathProgress: {}, scriptureNotes: {}, scriptureSegmentNotes: {}, scriptureHighlights: [], scriptureHighlightColors: {}, readingPosition: {}, offlinePacks: [], readingPath: [], readingProgram: 21, sourceReports: [], metadataDrafts: [],
    meditation: { type: "breath", bellInterval: 0, silent: false, locked: false, presets: [], courseDays: [], checkIn: "steady" }, chant: { selected: "refuge", pace: "normal", repeat: false, showTransliteration: true, showMeaning: true, fontSize: 18, lineHeight: 1.7, sleepMinutes: 0 },
    calendar: { view: "week", template: "balanced", paused: false, missedSessions: 0 }, circles: [], circlePrivateNotes: {}, glossaryDeck: [],
    reviewSchedule: {}, reviewHistory: [], audio: { queue: [], rate: .88 }, exportHistory: [],
    accessibility: { contrast: "normal", senior: false, readerSize: 20, audioDescriptions: false },
    visual: { aura: "radiant" }
  });

  const AURA_MODES = Object.freeze([
    { id: "gentle", label: "Tĩnh", icon: "◐" },
    { id: "radiant", label: "Trang nghiêm", icon: "☀" },
    { id: "ceremonial", label: "Nghi lễ", icon: "✺" }
  ]);

  let root = null;
  let state = null;
  let accountKey = "guest";
  let activeView = "today";
  let selectedLesson = "";
  let selectedLifePath = "";
  let selectedTeaching = "";
  let selectedScripture = "";
  let selectedScriptureSegment = "";
  let scriptureHighlightColor = "gold";
  let scriptureQuery = "";
  let scriptureTradition = "all";
  let scriptureTopic = "all";
  let scriptureDifficulty = "all";
  let scriptureSavedOnly = false;
  let scriptureShelf = "all";
  let activeScriptureTab = "study";
  let selectedGlossary = "dhamma";
  let selectedMapNode = "four-truths";
  let templeProvince = "all";
  let templeTradition = "all";
  let templeAccess = "all";
  let activeCircle = "";
  let glossaryReviewIndex = 0;
  let glossaryReveal = false;
  let selectedReviewKey = "";
  let studyReviewReveal = false;
  let audioStudyIndex = 0;
  let audioStudyPlaying = false;
  let pendingImport = null;
  let chantSelectedLine = -1;
  let currentUser = {};
  let canEditSources = false;
  let openNavGroup = "Bắt đầu";
  let inspectorMode = "progress";
  let inspectorItem = "";
  let timerId = 0;
  let timerRemaining = 300;
  let timerInitial = 300;
  let timerRunning = false;
  let chantTimerId = 0;
  let chantLineIndex = -1;
  let chantStopAt = 0;
  let journalKey = null;
  let journalEntries = null;
  let listeners = [];

  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const sourceById = (id) => SOURCES.find((item) => item.id === id) || SOURCES[0];
  const unique = (items) => [...new Set(items)];
  const storageKey = () => `${STATE_PREFIX}:${accountKey}`;
  const journalStorageKey = () => `${JOURNAL_PREFIX}:${accountKey}`;
  const localDayKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const todayKey = () => localDayKey(new Date());
  const formatDate = (iso) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: iso?.includes("T") ? "short" : undefined }).format(new Date(iso));

  function accountScope(user = {}) {
    return String(user.id || user._id || user.email || "guest").toLowerCase().replace(/[^a-z0-9@._-]/g, "-").slice(0, 96) || "guest";
  }

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey()) || "null");
      const next = { ...structuredClone(DEFAULT_STATE), ...(stored && typeof stored === "object" ? stored : {}) };
      next.visual = { ...DEFAULT_STATE.visual, ...(stored?.visual && typeof stored.visual === "object" ? stored.visual : {}) };
      next.meditation = { ...DEFAULT_STATE.meditation, ...(stored?.meditation && typeof stored.meditation === "object" ? stored.meditation : {}) };
      next.chant = { ...DEFAULT_STATE.chant, ...(stored?.chant && typeof stored.chant === "object" ? stored.chant : {}) };
      next.audio = { ...DEFAULT_STATE.audio, ...(stored?.audio && typeof stored.audio === "object" ? stored.audio : {}) };
      next.calendar = { ...DEFAULT_STATE.calendar, ...(stored?.calendar && typeof stored.calendar === "object" ? stored.calendar : {}) };
      next.accessibility = { ...DEFAULT_STATE.accessibility, ...(stored?.accessibility && typeof stored.accessibility === "object" ? stored.accessibility : {}) };
      for (const key of ["completedLessons", "bookmarks", "practiceHistory", "offlinePacks", "readingPath", "scriptureHighlights", "sourceReports", "metadataDrafts", "circles", "glossaryDeck", "reviewHistory", "exportHistory"]) if (!Array.isArray(next[key])) next[key] = [];
      if (!Array.isArray(next.audio.queue)) next.audio.queue = [];
      for (const key of ["lessonNotes", "scriptureNotes", "scriptureSegmentNotes", "scriptureHighlightColors", "readingPosition", "lifePathProgress", "routineProgress", "circlePrivateNotes", "reviewSchedule"]) if (!next[key] || typeof next[key] !== "object" || Array.isArray(next[key])) next[key] = {};
      if (!Array.isArray(next.meditation.presets)) next.meditation.presets = [];
      if (!Array.isArray(next.meditation.courseDays)) next.meditation.courseDays = [];
      if (!["steady", "uneasy", "overwhelmed"].includes(next.meditation.checkIn)) next.meditation.checkIn = "steady";
      next.audio.queue = unique(next.audio.queue.filter((key) => typeof key === "string")).slice(-30);
      next.audio.rate = Math.max(.65, Math.min(1.1, Number(next.audio.rate) || .88));
      if (!AURA_MODES.some((mode) => mode.id === next.visual.aura)) next.visual.aura = "radiant";
      if (!["intro", "practice", "deep"].includes(next.learningTier)) next.learningTier = "intro";
      return next;
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch {}
    updateProgressPanel();
  }

  function setState(patch) {
    state = { ...state, ...patch };
    saveState();
  }

  function toast(message, tone = "success", undo = null) {
    if (!root) return;
    root.querySelector("[data-dharma-toast]")?.remove();
    const node = document.createElement("div");
    node.className = `dharma-toast is-${tone}`;
    node.dataset.dharmaToast = "";
    node.setAttribute("role", "status");
    node.innerHTML = `<span>${safe(message)}</span>${undo ? '<button type="button" data-toast-undo>Hoàn tác</button>' : ""}<button type="button" data-toast-close aria-label="Đóng">×</button>`;
    root.append(node);
    if (undo) node.querySelector("[data-toast-undo]")?.addEventListener("click", () => { undo(); node.remove(); });
    node.querySelector("[data-toast-close]")?.addEventListener("click", () => node.remove());
    global.setTimeout(() => node.remove(), 4800);
  }

  function navigate(view) {
    const next = NAV.some((item) => item.id === view) ? view : "today";
    if (activeView === "audio" && next !== "audio") stopAudioStudy();
    openNavGroup = NAV.find((item) => item.id === next)?.group || openNavGroup;
    if (location.hash.replace(/^#/, "") === `/phat-phap/${next}` || (next === "today" && location.hash.replace(/^#/, "") === "/phat-phap")) {
      activeView = next;
      renderView();
      return;
    }
    location.hash = `#/phat-phap/${next}`;
  }

  function navMarkup() {
    const groups = unique(NAV.map((item) => item.group));
    return `<div class="dharma-nav-groups">${groups.map((group) => {
      const items = NAV.filter((item) => item.group === group);
      const expanded = group === openNavGroup;
      return `<section data-dharma-nav-group="${safe(group)}" class="${expanded ? "is-open" : ""}"><button class="dharma-nav-group" type="button" data-toggle-nav-group="${safe(group)}" aria-expanded="${expanded}"><i>${items[0]?.icon || "☸"}</i><span>${safe(group)}</span><small>${items.length}</small><b>${expanded ? "⌄" : "›"}</b></button><div class="dharma-nav-items" ${expanded ? "" : "hidden"}>${items.map((item) => `<button type="button" data-dharma-nav="${item.id}" class="${activeView === item.id ? "is-active" : ""}" aria-current="${activeView === item.id ? "page" : "false"}"><i>${item.icon}</i><span>${safe(item.label)}</span><b>›</b></button>`).join("")}</div></section>`;
    }).join("")}</div>`;
  }

  function progressStats() {
    return {
      lessons: state.completedLessons.length,
      bookmarks: state.bookmarks.length,
      practice: state.practiceHistory.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      today: Object.values(state.routineProgress[todayKey()] || {}).filter(Boolean).length
    };
  }

  function shellMarkup() {
    const current = NAV.find((item) => item.id === activeView) || NAV[0];
    const aura = AURA_MODES.find((mode) => mode.id === state.visual.aura) || AURA_MODES[1];
    return `<section class="dharma-hub is-progress-closed" data-dharma-hub data-view="${activeView}" data-aura="${aura.id}" data-contrast="${safe(state.accessibility.contrast)}" data-senior="${state.accessibility.senior}" style="--dharma-reader-size:${Number(state.accessibility.readerSize) || 20}px">
      <div class="dharma-aura-field" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><b></b>${Array.from({ length: 10 }, (_, index) => `<i style="--aura-particle:${index}"></i>`).join("")}</div>
      <div class="dharma-ornament" aria-hidden="true"><i></i><i></i><i></i><span class="dharma-incense"></span><span class="dharma-lamp"></span></div>
      <header class="dharma-topbar">
        <button class="dharma-brand" type="button" data-dharma-nav="today"><span class="dharma-wheel" aria-hidden="true">☸</span><span><small>TRUNG TÂM TU HỌC</small><strong>Phật Pháp</strong></span></button>
        <nav aria-label="Điều hướng nhanh"><button type="button" data-dharma-nav="today">Hôm nay</button><button type="button" data-dharma-nav="scriptures">Tra cứu</button><button type="button" data-dharma-nav="schedule">Lịch tu học</button><button type="button" data-dharma-nav="accessibility" aria-label="Mở trợ năng">Trợ năng</button></nav>
        <label class="dharma-search"><span>⌕</span><input type="search" data-dharma-search aria-label="Tìm giáo lý, kinh điển và thuật ngữ" placeholder="Tìm…" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <button class="dharma-aura-control" type="button" data-dharma-aura title="Đổi chế độ hiệu ứng trang nghiêm"><i>${aura.icon}</i><span>Hiệu ứng</span><b data-dharma-aura-label>${aura.label}</b></button>
        <button class="dharma-topbar__progress" type="button" data-dharma-toggle-progress aria-expanded="false"><span>Hành trình</span><b data-dharma-progress-percent>0%</b></button>
      </header>
      <div class="dharma-layout">
        <aside class="dharma-sidebar" aria-label="Danh mục Phật Pháp">${navMarkup()}<footer><span>✦</span><p><strong>Học có nguồn</strong><small>Không bói nghiệp · Không thay thế chuyên gia</small></p></footer></aside>
        <main class="dharma-workspace" tabindex="-1"><header class="dharma-workspace__head"><div><small>${safe(current.group)}</small><h1>${safe(current.label)}</h1></div><button type="button" data-dharma-reader-toggle hidden>Chế độ đọc</button></header><div class="dharma-content" data-dharma-content></div></main>
        <aside class="dharma-progress" data-dharma-progress-panel aria-hidden="true"><header><span><small data-inspector-kicker>THÔNG TIN THEO NGỮ CẢNH</small><strong data-inspector-title>Hành trình tu học</strong></span><button type="button" data-dharma-toggle-progress aria-label="Đóng bảng thông tin">×</button></header><div data-dharma-progress-content></div></aside>
      </div>
      <footer class="dharma-actionbar"><ol aria-label="Luồng học"><li class="is-active"><i>1</i>Nghe</li><li><i>2</i>Đọc</li><li><i>3</i>Suy ngẫm</li><li><i>4</i>Thực hành</li><li><i>5</i>Ghi nhận</li></ol><nav aria-label="Thao tác nhanh"><button type="button" data-action-note title="Mở ghi chú">記 <span>Ghi chú</span></button><button type="button" data-action-mark title="Đánh dấu tài liệu đang đọc">☆ <span>Đánh dấu</span></button><button type="button" data-action-static title="Chuyển về chế độ tĩnh">◐ <span>Tĩnh tâm</span></button></nav><button type="button" data-dharma-primary>${activeView === "practice" ? "Bắt đầu thực hành" : "Tiếp tục hành trình"} →</button></footer>
      <nav class="dharma-mobile-nav" aria-label="Điều hướng Phật Pháp trên điện thoại"><button data-dharma-nav="today"><i>灯</i>Hôm nay</button><button data-dharma-nav="scriptures"><i>經</i>Kinh</button><button data-dharma-nav="practice"><i>禪</i>Thiền</button><button data-dharma-nav="temple"><i>寺</i>Chùa</button><button data-dharma-mobile-menu><i>☰</i>Thêm</button></nav>
      <div class="dharma-mobile-sheet" data-dharma-mobile-sheet hidden><button type="button" data-dharma-mobile-menu aria-label="Đóng"></button><div><i></i><header><strong>Toàn bộ chức năng</strong><button type="button" data-dharma-mobile-menu>×</button></header>${navMarkup()}</div></div>
    </section>`;
  }

  function updateProgressPanel() {
    if (!root) return;
    const stats = progressStats();
    const percent = Math.round((stats.lessons / LESSONS.length) * 100);
    root.querySelectorAll("[data-dharma-progress-percent]").forEach((node) => { node.textContent = `${percent}%`; });
    const panel = root.querySelector("[data-dharma-progress-content]");
    if (!panel) return;
    const title = root.querySelector("[data-inspector-title]");
    const kicker = root.querySelector("[data-inspector-kicker]");
    if (inspectorMode === "source") {
      const scripture = SCRIPTURES.find((item) => item.id === inspectorItem);
      if (scripture) {
        const source = sourceById(scripture.sourceId);
        if (title) title.textContent = "Nguồn & xuất xứ";
        if (kicker) kicker.textContent = "THẺ MINH BẠCH";
        panel.innerHTML = `<section class="dharma-provenance-card"><span class="dharma-source-state">✓ Đã kiểm tra liên kết</span><h3>${safe(scripture.title)}</h3><dl><div><dt>Mã tham chiếu</dt><dd>${safe(scripture.code)}</dd></div><div><dt>Tên nguyên ngữ</dt><dd>${safe(scripture.canonicalTitle)}</dd></div><div><dt>Bộ kinh</dt><dd>${safe(scripture.collection)}</dd></div><div><dt>Ngôn ngữ nguồn</dt><dd>${safe(scripture.sourceLanguage)}</dd></div><div><dt>Truyền thống</dt><dd>${safe(scripture.tradition)}</dd></div><div><dt>Dịch giả</dt><dd>${safe(scripture.translator)}</dd></div><div><dt>Quyền sử dụng</dt><dd>${safe(scripture.license)}</dd></div><div><dt>Kiểm chứng</dt><dd>${safe(scripture.verifiedAt)}</dd></div></dl><p>${safe(source.note)}</p><a href="${safe(scripture.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở tài liệu nguồn ↗</a><button type="button" data-report-source="${scripture.id}">Báo lỗi nguồn hoặc trích dẫn</button></section>`;
        return;
      }
    }
    if (inspectorMode === "notes") {
      const scripture = SCRIPTURES.find((item) => item.id === inspectorItem);
      if (title) title.textContent = "Ghi chú cá nhân";
      if (kicker) kicker.textContent = "LƯU TRÊN THIẾT BỊ";
      panel.innerHTML = scripture ? `<section class="dharma-inspector-note"><small>${safe(scripture.code)} · ${safe(scripture.title)}</small><label>Ghi điều bạn hiểu<textarea data-scripture-note="${scripture.id}" maxlength="4000" placeholder="Ghi chú của riêng bạn…">${safe(state.scriptureNotes[scripture.id] || "")}</textarea></label><p>Ghi chú học tập này không phải chú giải kinh điển. Nhật ký riêng tư ở mục Cá nhân được mã hóa riêng.</p></section>` : "";
      return;
    }
    if (title) title.textContent = "Hành trình tu học";
    if (kicker) kicker.textContent = "TIẾN ĐỘ RIÊNG TƯ";
    const nextLesson = LESSONS.find((item) => !state.completedLessons.includes(item.id));
    panel.innerHTML = `<section class="dharma-progress-ring" style="--progress:${percent * 3.6}deg"><div><strong>${percent}%</strong><small>${stats.lessons}/${LESSONS.length} bài nền tảng</small></div></section>
      <section class="dharma-stat-list"><p><i>讀</i><span><strong>${stats.bookmarks}</strong><small>Kinh/bài đã lưu</small></span></p><p><i>禪</i><span><strong>${stats.practice}</strong><small>Phút thực hành</small></span></p><p><i>念</i><span><strong>${state.chantCount}</strong><small>Lần niệm đã ghi nhận</small></span></p></section>
      <section class="dharma-next"><small>Gợi ý tiếp theo</small><strong>${safe(nextLesson?.title || "Duy trì thời khóa nhẹ nhàng")}</strong><p>${nextLesson ? `${nextLesson.duration} phút · ${nextLesson.tradition}` : "Bạn đã hoàn thành lộ trình nền tảng."}</p><button type="button" data-dharma-next-lesson="${nextLesson?.id || ""}">${nextLesson ? "Mở bài tiếp theo" : "Mở thực hành"} →</button></section>
      <section class="dharma-privacy-note"><span>⌾</span><p><strong>Dữ liệu thuộc về bạn</strong><small>Tiến độ lưu trên thiết bị. Nhật ký chỉ mở sau khi nhập PIN riêng.</small></p></section>`;
  }

  function openInspector(mode = "progress", itemId = "") {
    inspectorMode = mode;
    inspectorItem = itemId;
    const hub = root?.querySelector("[data-dharma-hub]");
    if (!hub) return;
    hub.classList.remove("is-progress-closed");
    const panel = root.querySelector("[data-dharma-progress-panel]");
    panel?.setAttribute("aria-hidden", "false");
    root.querySelectorAll("[data-dharma-toggle-progress]").forEach((button) => button.setAttribute("aria-expanded", "true"));
    updateProgressPanel();
  }

  function cycleAuraMode() {
    const currentIndex = Math.max(0, AURA_MODES.findIndex((mode) => mode.id === state.visual.aura));
    const next = AURA_MODES[(currentIndex + 1) % AURA_MODES.length];
    state.visual = { ...state.visual, aura: next.id };
    saveState();
    const hub = root?.querySelector("[data-dharma-hub]");
    if (hub) hub.dataset.aura = next.id;
    const control = root?.querySelector("[data-dharma-aura]");
    if (control) {
      const icon = control.querySelector("i");
      if (icon) icon.textContent = next.icon;
      const label = control.querySelector("[data-dharma-aura-label]");
      if (label) label.textContent = next.label;
    }
    toast(`Hiệu ứng: ${next.label}.`);
  }

  function sourceBadge(sourceId) {
    const source = sourceById(sourceId);
    return `<span class="dharma-source-badge" title="${safe(source.note)}"><i>✓</i>${safe(source.organization)}</span>`;
  }

  function todayMarkup() {
    const next = LESSONS.find((item) => !state.completedLessons.includes(item.id)) || LESSONS[0];
    const daily = state.routineProgress[todayKey()] || {};
    const routine = [
      { id: "listen", label: "Nghe một đoạn tóm lược", minutes: 3 },
      { id: "learn", label: `Học: ${next.title}`, minutes: next.duration },
      { id: "practice", label: "Ngồi yên và theo dõi hơi thở", minutes: 5 },
      { id: "kindness", label: "Một hành động thiện lành kín đáo", minutes: 2 }
    ];
    return `<section class="dharma-hero dharma-paper-card"><div class="dharma-hero__copy"><p class="dharma-kicker"><i></i>THỜI KHÓA HÔM NAY · ${safe(new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date()))}</p><h2>Mỗi ngày một bước tỉnh thức</h2><p>Học vừa đủ, thực hành thật và ghi nhận bằng sự thành thật. Không chạy theo thành tích hay so sánh với người khác.</p><div class="dharma-hero__meta"><span><b>${state.studySchedule.minutes}</b> phút dự kiến</span><span><b>${Object.values(daily).filter(Boolean).length}/4</b> việc đã làm</span><span><b>${state.studySchedule.time}</b> giờ nhắc</span></div><button class="dharma-primary" type="button" data-open-lesson="${next.id}">Bắt đầu bài hôm nay →</button></div><figure class="dharma-buddha-portrait"><span aria-hidden="true"></span><img src="assets/phat-phap/duc-phat-hao-quang-v1.webp" width="1536" height="1024" loading="eager" decoding="async" alt="Tranh minh họa Đức Phật Thích Ca tọa thiền trên tòa sen trong hào quang vàng"><figcaption>Hình minh họa nguyên bản · Không đại diện một pho tượng cụ thể</figcaption></figure></section>
      <div class="dharma-section-title"><div><small>15 PHÚT TĨNH TÂM</small><h2>Thời khóa rõ ràng, không quá tải</h2></div><button type="button" data-dharma-schedule>Chỉnh thời khóa</button></div>
      <section class="dharma-routine">${routine.map((item, index) => `<button type="button" data-routine="${item.id}" class="${daily[item.id] ? "is-done" : ""}"><i>${daily[item.id] ? "✓" : index + 1}</i><span><strong>${safe(item.label)}</strong><small>${item.minutes} phút</small></span><b>${daily[item.id] ? "Đã ghi nhận" : "Bắt đầu"}</b></button>`).join("")}</section>
      <section class="dharma-split"><article class="dharma-paper-card dharma-daily-reading"><header><span>經</span><div><small>TÓM LƯỢC KINH ĐIỂN</small><h3>${SCRIPTURES[0].title}</h3></div>${sourceBadge(SCRIPTURES[0].sourceId)}</header><p>${SCRIPTURES[0].summary}</p><footer><button type="button" data-open-scripture="${SCRIPTURES[0].id}">Đọc trong thư viện</button><a href="${SCRIPTURES[0].sourceUrl}" target="_blank" rel="noopener noreferrer">Mở nguồn gốc ↗</a></footer></article>
      <article class="dharma-paper-card dharma-kindness"><span class="dharma-lamp-icon">灯</span><small>VIỆC THIỆN GỢI Ý</small><h3>Lắng nghe mà không vội phán xét</h3><p>Dành một cuộc trò chuyện hôm nay để nghe hết câu, hỏi lại điều chưa rõ và không biến việc tốt thành thành tích công khai.</p><button type="button" data-routine="kindness">${daily.kindness ? "✓ Đã ghi nhận" : "Ghi nhận sau khi thực hiện"}</button></article></section>`;
  }

  function beginnerMarkup() {
    const selected = LESSONS.find((item) => item.id === selectedLesson);
    if (selected) return lessonDetailMarkup(selected);
    const tier = LEARNING_TIERS.find((item) => item.id === state.learningTier) || LEARNING_TIERS[0];
    const lessons = tier.lessonIds.map((id) => LESSONS.find((lesson) => lesson.id === id)).filter(Boolean);
    const done = lessons.filter((lesson) => state.completedLessons.includes(lesson.id)).length;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>PHÁP HỌC CÓ HỆ THỐNG</small><h2>Từ người mới đến tự học có phương pháp</h2><p>Ba chặng học độc lập, không khóa cứng. Mỗi bài đi qua sáu bước: hiểu nghĩa, đọc nguồn, biết bối cảnh, liên hệ đời sống, tự suy ngẫm và ghi chú.</p></div><div class="dharma-program-picker" role="group" aria-label="Chọn chương trình">${[7,21,49].map((day) => `<button type="button" data-program="${day}" class="${state.studySchedule.program === day ? "is-active" : ""}"><b>${day}</b><span>ngày</span></button>`).join("")}</div></section>
      <section class="dharma-tier-picker" aria-label="Chọn mức lộ trình">${LEARNING_TIERS.map((item) => { const count = item.lessonIds.filter((id) => state.completedLessons.includes(id)).length; return `<button type="button" data-learning-tier="${item.id}" class="${tier.id === item.id ? "is-active" : ""}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${count}/${item.lessonIds.length} bài · ${item.description}</small></span><b>${tier.id === item.id ? "Đang mở" : "Mở"}</b></button>`; }).join("")}</section>
      <section class="dharma-roadmap"><header><span>${safe(tier.label)} · ${safe(tier.description)}</span><strong>${done}/${lessons.length} bài</strong><i><b style="width:${done / Math.max(1, lessons.length) * 100}%"></b></i></header><div>${lessons.map((lesson) => `<button type="button" data-open-lesson="${lesson.id}" class="${state.completedLessons.includes(lesson.id) ? "is-complete" : ""}"><i>${state.completedLessons.includes(lesson.id) ? "✓" : lesson.order}</i><span><small>${safe(lesson.tradition)} · ${lesson.duration} phút</small><strong>${safe(lesson.title)}</strong><p>${safe(lesson.summary)}</p></span><b>›</b></button>`).join("")}</div></section>`;
  }

  function lessonDetailMarkup(lesson) {
    const note = state.lessonNotes[lesson.id] || "";
    const source = sourceById(lesson.sourceId);
    const complete = state.completedLessons.includes(lesson.id);
    const relatedScripture = SCRIPTURES.find((item) => item.parallelIds?.includes(lesson.id)) || SCRIPTURES.find((item) => normalize(`${item.summary} ${item.keywords}`).includes(normalize(lesson.title.split(" ")[0])));
    return `<button class="dharma-back" type="button" data-back-list="beginner">← Trở lại lộ trình</button><article class="dharma-lesson dharma-paper-card"><header><span>${String(lesson.order).padStart(2, "0")}</span><div><small>${safe(lesson.tradition)} · ${lesson.duration} PHÚT</small><h2>${safe(lesson.title)}</h2></div>${sourceBadge(lesson.sourceId)}</header><ol class="dharma-lesson-flow"><li><i>1</i><span><small>Ý NGHĨA DỄ HIỂU</small><p>${safe(lesson.summary)}</p></span></li><li><i>2</i><span><small>ĐOẠN KINH LIÊN QUAN</small><p>${relatedScripture ? `${safe(relatedScripture.title)} · ${safe(relatedScripture.code)}. HH chỉ dẫn tới tài liệu nguồn, không chép bản dịch chưa rõ quyền.` : "Chưa ghép một tài liệu nguồn đủ phù hợp; hãy dùng Tra cứu để kiểm tra thêm."}</p>${relatedScripture ? `<button type="button" data-open-scripture="${relatedScripture.id}">Mở trong Study Lab →</button>` : ""}</span></li><li><i>3</i><span><small>BỐI CẢNH & NGUỒN</small><p>${safe(source.note)}</p><button type="button" data-open-provenance="${relatedScripture?.id || ""}" ${relatedScripture ? "" : "disabled"}>Xem thẻ minh bạch</button></span></li><li><i>4</i><span><small>ĐƯA VÀO ĐỜI SỐNG</small><p>${safe(lesson.practice)}</p><button type="button" data-dharma-nav="practice">Mở thiền đường</button></span></li><li><i>5</i><span><small>TỰ SUY NGẪM</small><p>Điều gì trong bài này có thể được kiểm nghiệm bằng một thay đổi nhỏ, lành mạnh và không gây hại trong hôm nay?</p></span></li><li><i>6</i><label class="dharma-note"><span>GHI CHÚ CÁ NHÂN</span><textarea data-lesson-note="${lesson.id}" maxlength="2000" placeholder="Viết điều bạn hiểu hoặc muốn áp dụng…">${safe(note)}</textarea><small>Ghi chú học tập lưu trên thiết bị này.</small></label></li></ol><footer><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Kiểm tra nguồn · ${safe(source.organization)} ↗</a><button class="dharma-primary" type="button" data-complete-lesson="${lesson.id}">${complete ? "✓ Đã hoàn thành" : "Hoàn thành bài học"}</button></footer></article>`;
  }

  function situationsMarkup() {
    const selected = LIFE_JOURNEYS.find((item) => item.id === selectedLifePath);
    if (selected) return situationDetailMarkup(selected);
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>PHÁP HỌC THEO ĐỜI SỐNG</small><h2>Bắt đầu từ điều bạn đang trải qua</h2><p>Mỗi hành trình giúp nhận diện vấn đề, tìm giáo lý và nguồn tham khảo, thực hành một bước nhỏ rồi biết rõ khi nào cần người có chuyên môn. Không dùng nghiệp hay nhân quả để đổ lỗi.</p></div><span class="dharma-seal">心</span></section><section class="dharma-life-grid">${LIFE_JOURNEYS.map((item) => `<button type="button" data-life-path="${item.id}" class="${state.lifePathProgress[item.id]?.completed ? "is-complete" : ""}"><i>${item.icon}</i><span><small>${state.lifePathProgress[item.id]?.completed ? "ĐÃ SUY NGẪM" : "HÀNH TRÌNH ĐỜI SỐNG"}</small><strong>${safe(item.title)}</strong><p>${safe(item.recognize)}</p></span><b>${state.lifePathProgress[item.id]?.completed ? "✓" : "›"}</b></button>`).join("")}</section><aside class="dharma-practice-warning"><strong>Không thay thế hỗ trợ chuyên môn</strong><p>Nội dung này hỗ trợ học và suy ngẫm. Trong tình huống nguy hiểm, khẩn cấp hoặc sức khỏe suy giảm, hãy ưu tiên cơ quan khẩn cấp và chuyên gia phù hợp tại nơi bạn sống.</p></aside>`;
  }

  function situationDetailMarkup(item) {
    const teaching = TEACHINGS.find((entry) => entry.id === item.teachingId);
    const scripture = SCRIPTURES.find((entry) => entry.id === item.scriptureId);
    const progress = state.lifePathProgress[item.id] || {};
    return `<button class="dharma-back" type="button" data-back-life>← Tất cả hành trình</button><article class="dharma-life-detail dharma-paper-card"><header><span>${item.icon}</span><div><small>PHÁP HỌC THEO TÌNH HUỐNG</small><h2>${safe(item.title)}</h2><p>Không chẩn đoán · Không phán nghiệp · Không thay thế chuyên gia</p></div></header><ol><li><i>1</i><div><small>NHẬN DIỆN VẤN ĐỀ</small><p>${safe(item.recognize)}</p></div></li><li><i>2</i><div><small>GIÁO LÝ LIÊN QUAN</small><h3>${safe(teaching?.title || "Chủ đề đang được biên tập")}</h3><p>${safe(teaching?.intro || "Chưa có nội dung đã kiểm chứng.")}</p>${teaching ? `<button type="button" data-open-teaching="${teaching.id}">Mở bài giáo lý →</button>` : ""}</div></li><li><i>3</i><div><small>KINH THAM KHẢO</small><h3>${safe(scripture?.title || "Chưa ghép tài liệu")}</h3><p>${scripture ? `${safe(scripture.code)} · ${safe(scripture.collection)} · ${safe(scripture.sourceLanguage)}` : "Chỉ hiển thị khi có nguồn rõ ràng."}</p>${scripture ? `<button type="button" data-open-scripture="${scripture.id}">Mở Study Lab →</button>` : ""}</div></li><li><i>4</i><div><small>THỰC HÀNH 5–15 PHÚT</small><p>${safe(item.practice)}</p><button type="button" data-life-practice="${item.id}">Đưa vào Thiền đường</button></div></li><li><i>5</i><div><small>CÂU HỎI SUY NGẪM</small><p>${safe(item.reflection)}</p><label class="dharma-note"><textarea data-life-note="${item.id}" maxlength="2000" placeholder="Ghi câu trả lời của riêng bạn…">${safe(progress.note || "")}</textarea></label></div></li><li class="is-support"><i>!</i><div><small>KHI NÀO CẦN TÌM HỖ TRỢ</small><p>${safe(item.support)}</p><button type="button" data-dharma-nav="qna">Xem cách tìm người hướng dẫn</button></div></li></ol><footer><button type="button" data-life-complete="${item.id}">${progress.completed ? "✓ Đã ghi nhận" : "Ghi nhận đã suy ngẫm"}</button><button class="dharma-primary" type="button" data-dharma-nav="journal">Viết vào nhật ký mã hóa</button></footer></article>`;
  }

  function teachingsMarkup() {
    const selected = TEACHINGS.find((item) => item.id === selectedTeaching);
    if (selected) return teachingDetailMarkup(selected);
    const categories = unique(TEACHINGS.map((item) => item.category));
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>GIÁO LÝ CÓ BỐI CẢNH</small><h2>Học theo chủ đề, biết rõ truyền thống</h2><p>Mỗi nội dung phân biệt phần giải thích, đào sâu, ứng dụng và nguồn tham khảo. Không trộn lẫn các truyền thống thành một kết luận duy nhất.</p></div><span class="dharma-seal">法</span></section>${categories.map((category) => `<section class="dharma-teaching-group"><header><h3>${safe(category)}</h3><span>${TEACHINGS.filter((item) => item.category === category).length} chủ đề</span></header><div>${TEACHINGS.filter((item) => item.category === category).map((item) => `<button type="button" data-open-teaching="${item.id}"><i>☸</i><span><small>${safe(item.tradition)}</small><strong>${safe(item.title)}</strong><p>${safe(item.intro)}</p></span><b>Đọc →</b></button>`).join("")}</div></section>`).join("")}`;
  }

  function teachingDetailMarkup(item) {
    const source = sourceById(item.sourceId);
    return `<button class="dharma-back" type="button" data-back-list="teachings">← Tất cả chủ đề</button><article class="dharma-teaching-detail dharma-paper-card"><header><div><small>${safe(item.category)} · ${safe(item.tradition)}</small><h2>${safe(item.title)}</h2></div>${sourceBadge(item.sourceId)}</header><nav role="tablist"><button type="button" data-teaching-tab="explain" aria-selected="true">Giải thích</button><button type="button" data-teaching-tab="deep">Đào sâu</button><button type="button" data-teaching-tab="apply">Ứng dụng</button><button type="button" data-teaching-tab="source">Nguồn</button><button type="button" data-teaching-tab="note">Ghi chú</button></nav><section data-teaching-panel="explain"><h3>Hiểu ngắn gọn</h3><p>${safe(item.intro)}</p></section><section data-teaching-panel="deep" hidden><h3>Đọc sâu hơn</h3><p>${safe(item.deep)}</p></section><section data-teaching-panel="apply" hidden><h3>Đưa vào đời sống</h3><p>${safe(item.application)}</p></section><section data-teaching-panel="source" hidden><h3>Nguồn tham khảo</h3><p>${safe(source.note)}</p><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Mở ${safe(source.organization)} ↗</a></section><section data-teaching-panel="note" hidden><label class="dharma-note"><span>Ghi chú cá nhân</span><textarea data-lesson-note="teaching:${item.id}" maxlength="2000" placeholder="Điều bạn muốn ghi nhớ…">${safe(state.lessonNotes[`teaching:${item.id}`] || "")}</textarea></label></section></article>`;
  }

  function scripturesMarkup() {
    const selected = SCRIPTURES.find((item) => item.id === selectedScripture);
    if (selected) return scriptureDetailMarkup(selected);
    const filtered = SCRIPTURES.filter((item) =>
      (scriptureTradition === "all" || item.tradition === scriptureTradition)
      && (scriptureTopic === "all" || item.topic === scriptureTopic)
      && (scriptureDifficulty === "all" || item.difficulty === scriptureDifficulty)
      && (!scriptureSavedOnly || state.bookmarks.includes(item.id))
      && (scriptureShelf === "all" || (scriptureShelf === "path" ? state.readingPath.includes(item.id) : state.offlinePacks.includes(item.id)))
      && normalize(`${item.title} ${item.canonicalTitle} ${item.code} ${item.collection} ${item.summary} ${item.keywords}`).includes(normalize(scriptureQuery))
    );
    const traditions = unique(SCRIPTURES.map((item) => item.tradition));
    const topics = unique(SCRIPTURES.map((item) => item.topic));
    const difficulties = unique(SCRIPTURES.map((item) => item.difficulty));
    return `<section class="dharma-library-head dharma-paper-card"><div><small>SCRIPTURE STUDY LAB</small><h2>Đọc đối chiếu, biết rõ nguồn</h2><p>Kho học tập phân biệt nguyên ngữ, metadata, tóm lược HH và bản dịch ở nguồn. Không sao chép bản dịch chưa rõ giấy phép.</p></div><span>經</span></section>
      <div class="dharma-library-toolbar dharma-library-toolbar--advanced"><label><span>⌕</span><input type="search" data-scripture-search value="${safe(scriptureQuery)}" placeholder="Tên kinh, mã SN/MN/DN, chủ đề…"></label><select data-scripture-tradition aria-label="Lọc truyền thống"><option value="all">Mọi truyền thống</option>${traditions.map((item) => `<option value="${safe(item)}" ${scriptureTradition === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select><select data-scripture-topic aria-label="Lọc chủ đề"><option value="all">Mọi chủ đề</option>${topics.map((item) => `<option value="${safe(item)}" ${scriptureTopic === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select><select data-scripture-difficulty aria-label="Lọc độ khó"><option value="all">Mọi cấp độ</option>${difficulties.map((item) => `<option value="${safe(item)}" ${scriptureDifficulty === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select><button type="button" data-scripture-saved-only aria-pressed="${scriptureSavedOnly}">${scriptureSavedOnly ? "★ Đang xem đã lưu" : "☆ Chỉ mục đã lưu"}</button>${scriptureShelf !== "all" ? '<button type="button" data-scripture-clear-shelf>× Bỏ lọc kệ</button>' : ""}</div>
      <section class="dharma-reading-shelf"><article><i>路</i><span><strong>Đường đọc cá nhân · ${state.readingProgram} ngày</strong><small>${state.readingPath.length} tài liệu · sắp theo thứ tự bạn thêm</small></span><select data-reading-program aria-label="Chọn độ dài đường đọc">${[7,21,49].map((day) => `<option value="${day}" ${state.readingProgram === day ? "selected" : ""}>${day} ngày</option>`).join("")}</select><button type="button" data-reading-path-view ${state.readingPath.length ? "" : "disabled"}>Mở đường đọc</button></article><article><i>↓</i><span><strong>Gói đọc ngoại tuyến</strong><small>${state.offlinePacks.length} bản tóm lược và metadata đã lưu cục bộ</small></span><button type="button" data-offline-view ${state.offlinePacks.length ? "" : "disabled"}>Xem gói</button></article></section>
      <section class="dharma-scripture-grid">${filtered.map((item) => `<article><header><span>經</span><div><small>${safe(item.code)} · ${safe(item.collection)}</small><h3>${safe(item.title)}</h3><em>${safe(item.canonicalTitle)}</em></div><button type="button" data-bookmark-scripture="${item.id}" aria-label="${state.bookmarks.includes(item.id) ? "Bỏ lưu" : "Lưu"}">${state.bookmarks.includes(item.id) ? "★" : "☆"}</button></header><div class="dharma-scripture-tags"><span>${safe(item.topic)}</span><span>${safe(item.difficulty)}</span><span>${safe(item.sourceLanguage)}</span></div><p>${safe(item.summary)}</p><footer>${sourceBadge(item.sourceId)}<button type="button" data-open-scripture="${item.id}">Mở Study Lab →</button></footer></article>`).join("") || '<div class="dharma-empty"><span>經</span><strong>Không tìm thấy nội dung</strong><p>Thử tên ngắn hơn hoặc bỏ bớt bộ lọc.</p></div>'}</section>`;
  }

  function scriptureDetailMarkup(item) {
    const source = sourceById(item.sourceId);
    const offline = state.offlinePacks.includes(item.id);
    const inPath = state.readingPath.includes(item.id);
    const related = [...TEACHINGS.filter((entry) => item.parallelIds?.includes(entry.id)), ...SCRIPTURES.filter((entry) => entry.id !== item.id && entry.topic === item.topic)].slice(0, 4);
    const segments = SCRIPTURE_SEGMENTS[item.id] || [{ id: `${item.id}-summary`, label: "Tóm lược", reference: item.code, summary: item.summary, terms: [] }];
    const resumeId = selectedScriptureSegment || state.readingPosition[item.id] || segments[0].id;
    const panels = {
      study: `<section class="dharma-segment-reader"><aside><small>MỤC LỤC TỰ ĐỘNG</small>${segments.map((segment, index) => `<button type="button" data-scripture-segment="${segment.id}" class="${resumeId === segment.id ? "is-active" : ""}"><i>${index + 1}</i><span><strong>${safe(segment.label)}</strong><small>${safe(segment.reference)}</small></span></button>`).join("")}<a href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở toàn văn tại nguồn ↗</a></aside><div><header><span><small>ĐANG TIẾP TỤC</small><strong>${safe(segments.find((entry) => entry.id === resumeId)?.label || segments[0].label)}</strong></span><div class="dharma-highlight-palette" aria-label="Chọn màu đánh dấu">${[["gold","Vàng"],["green","Xanh"],["rose","Hồng"],["blue","Lam"]].map(([id,label]) => `<button type="button" data-highlight-color="${id}" class="${scriptureHighlightColor === id ? "is-active" : ""}" title="${label}"></button>`).join("")}</div></header>${segments.map((segment) => { const color = state.scriptureHighlightColors[segment.id] || ""; const glossary = segment.terms.map((id) => GLOSSARY.find((term) => term.id === id)).filter(Boolean); return `<article id="segment-${segment.id}" data-segment-id="${segment.id}" data-highlight="${safe(color)}" class="${resumeId === segment.id ? "is-current" : ""}"><small>${safe(segment.reference)} · HH TÓM LƯỢC</small><h3>${safe(segment.label)}</h3><p>${safe(segment.summary)}</p>${glossary.length ? `<div class="dharma-inline-terms">${glossary.map((term) => `<button type="button" data-open-glossary="${term.id}"><b>${term.han}</b>${safe(term.pali)} · ${safe(term.hanViet)}</button>`).join("")}</div>` : ""}<footer><button type="button" data-segment-highlight="${segment.id}">${color ? `Đổi màu · ${safe(color)}` : "Tô sáng đoạn"}</button><button type="button" data-segment-note="${segment.id}">Ghi chú cạnh đoạn</button></footer></article>`; }).join("")}</div></section>`,
      compare: `<section class="dharma-translation-compare"><article><header><span>NGUYÊN NGỮ</span><b>THAM CHIẾU</b></header><h3>${safe(item.canonicalTitle)}</h3><p>${safe(item.sourceLanguage)} · ${safe(item.code)}</p><small>HH chỉ hiển thị metadata và mã đoạn; mở nguồn để đọc văn bản đầy đủ.</small><a href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở nguyên ngữ ↗</a></article><article><header><span>HH DIỄN GIẢI</span><b>NỘI DUNG GỐC HH</b></header><h3>${safe(item.title)}</h3><p>${safe(item.summary)}</p><small>Không phải nguyên văn hoặc bản dịch kinh.</small></article><article><header><span>BẢN DỊCH ĐƯỢC CẤP PHÉP</span><b>MỞ TẠI NGUỒN</b></header><h3>Chọn dịch giả tại ${safe(source.organization)}</h3><p>${safe(item.translator)}</p><small>${safe(item.license)}. HH không sao chép văn bản khi chưa xác nhận quyền theo từng bản dịch.</small><a href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Chọn bản dịch ↗</a></article></section><aside class="dharma-comparison-note"><strong>Vì sao không hiện ba bản dịch trực tiếp?</strong><p>Quyền sử dụng thuộc từng dịch giả. Study Lab chỉ dựng nội dung vào cột so sánh khi giấy phép cụ thể cho phép; hiện tại các cột chưa đủ quyền được giữ ở dạng liên kết minh bạch.</p></aside>`,
      provenance: `<section class="dharma-provenance-table"><header><span>✓</span><div><small>THẺ MINH BẠCH</small><h3>Nguồn, dịch giả và giấy phép</h3></div></header><dl><div><dt>Tên kinh</dt><dd>${safe(item.title)}</dd></div><div><dt>Tên nguyên ngữ</dt><dd>${safe(item.canonicalTitle)}</dd></div><div><dt>Mã tham chiếu</dt><dd>${safe(item.code)}</dd></div><div><dt>Truyền thống</dt><dd>${safe(item.tradition)}</dd></div><div><dt>Dịch giả</dt><dd>${safe(item.translator)}</dd></div><div><dt>Giấy phép</dt><dd>${safe(item.license)}</dd></div><div><dt>Ngày kiểm chứng</dt><dd>${safe(item.verifiedAt)}</dd></div></dl><div class="dharma-citation-builder"><small>TRÍCH DẪN TỪ METADATA · KHÔNG TỰ ĐIỀN DỊCH GIẢ</small><p>${safe(citationText(item, "academic"))}</p><div><button type="button" data-copy-citation="${item.id}" data-citation-style="academic">Sao chép trích dẫn</button><button type="button" data-export-citation="${item.id}">Xuất BibTeX</button><button type="button" data-open-provenance="${item.id}">Mở trong Inspector</button></div></div></section>`,
      relations: `<section class="dharma-related-study"><header><small>LIÊN HỆ & BẢN SONG SONG</small><h3>Học trong mạng lưới giáo pháp</h3><p>Đây là liên hệ biên tập nội bộ để hỗ trợ học tập, không khẳng định các văn bản là bản song song học thuật.</p></header>${related.map((entry) => `<button type="button" ${entry.collection ? `data-open-scripture="${entry.id}"` : `data-open-teaching="${entry.id}"`}><i>${entry.collection ? "經" : "法"}</i><span><strong>${safe(entry.title)}</strong><small>${safe(entry.collection || entry.tradition)}</small></span><b>›</b></button>`).join("") || '<p class="dharma-empty-line">Chưa có liên hệ đã biên tập.</p>'}</section>`,
      notes: `<section class="dharma-study-notes"><label>Ghi chú toàn bài<textarea data-scripture-note="${item.id}" maxlength="4000" placeholder="Điều bạn hiểu, câu hỏi cần hỏi vị thầy…">${safe(state.scriptureNotes[item.id] || "")}</textarea><small>Lưu trên thiết bị. Không được xem là chú giải kinh điển.</small></label><div class="dharma-segment-note-list">${segments.map((segment) => `<label><span>${safe(segment.reference)} · ${safe(segment.label)}</span><textarea data-scripture-segment-note="${segment.id}" maxlength="2000" placeholder="Ghi chú cạnh đoạn…">${safe(state.scriptureSegmentNotes[segment.id] || "")}</textarea></label>`).join("")}</div><footer><button type="button" data-open-inspector-note="${item.id}">Viết trong Inspector</button><button type="button" data-export-scripture-notes="${item.id}">Xuất Markdown</button><button type="button" data-print-scripture-notes="${item.id}">In / lưu PDF</button></footer></section>`
    };
    return `<button class="dharma-back" type="button" data-back-list="scriptures">← Trở lại thư viện</button><article class="dharma-scripture-reader dharma-paper-card"><header><div><small>${safe(item.code)} · ${safe(item.collection)} · ${safe(item.tradition)}</small><h2>${safe(item.title)}</h2><p>${sourceBadge(item.sourceId)} <span class="dharma-original-label">HH TÓM LƯỢC · KHÔNG PHẢI BẢN DỊCH</span></p></div><div><button type="button" data-speak-scripture="${item.id}">▷ Nghe tóm lược</button><button type="button" data-reader-mode>Chế độ tập trung</button></div></header><nav class="dharma-study-tabs" role="tablist">${[["study","Đọc theo đoạn"],["compare","So sánh"],["provenance","Nguồn"],["relations","Liên hệ"],["notes","Ghi chú"]].map(([id,label]) => `<button type="button" data-scripture-tab="${id}" aria-selected="${activeScriptureTab === id}">${label}</button>`).join("")}</nav><div class="dharma-study-panel">${panels[activeScriptureTab] || panels.study}</div><aside><strong>Ranh giới nội dung</strong><p>HH chỉ giải thích và tóm lược để hỗ trợ học. Với giáo pháp chuyên sâu hoặc khác biệt truyền thống, hãy tham khảo vị thầy đủ phẩm hạnh trong truyền thống liên quan.</p></aside><footer><button type="button" data-bookmark-scripture="${item.id}">${state.bookmarks.includes(item.id) ? "★ Đã lưu" : "☆ Lưu thư viện"}</button><button type="button" data-reading-path="${item.id}">${inPath ? "✓ Trong đường đọc" : "+ Đường đọc"}</button><button type="button" data-offline-scripture="${item.id}">${offline ? "✓ Đã lưu offline" : "↓ Lưu offline"}</button><a class="dharma-primary" href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a></footer></article>`;
  }

  function practiceMarkup() {
    const recent = state.practiceHistory.slice(-5).reverse();
    const practices = [
      { id: "breath", label: "Hơi thở", icon: "息", guidance: "Biết rõ hơi thở tự nhiên, không kéo dài hay điều khiển." },
      { id: "body", label: "Quán thân", icon: "身", guidance: "Nhẹ nhàng nhận biết điểm tiếp xúc và cảm giác toàn thân." },
      { id: "feeling", label: "Cảm thọ", icon: "受", guidance: "Nhận biết dễ chịu, khó chịu hoặc trung tính mà không vội phản ứng." },
      { id: "kindness", label: "Tâm từ", icon: "慈", guidance: "Khởi đầu bằng lời nguyện lành thực tế, rồi mở rộng dần." },
      { id: "walking", label: "Thiền đi bộ", icon: "行", guidance: "Đi chậm trong nơi an toàn, biết rõ nhấc chân, đưa chân và đặt chân." }
    ];
    const current = practices.find((item) => item.id === state.meditation.type) || practices[0];
    const now = Date.now();
    const weekMinutes = state.practiceHistory.filter((entry) => now - new Date(entry.at).getTime() <= 7 * 86400000).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    const monthMinutes = state.practiceHistory.filter((entry) => now - new Date(entry.at).getTime() <= 30 * 86400000).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    const completedCourse = state.meditation.courseDays || [];
    const checkIns = [{ id: "steady", icon: "安", label: "Đủ ổn để bắt đầu", note: "Thực hành nhẹ và vẫn để ý giới hạn." }, { id: "uneasy", icon: "息", label: "Đang khó chịu nhẹ", note: "Chọn 5 phút, mở mắt nếu cần." }, { id: "overwhelmed", icon: "!", label: "Đang bất an mạnh", note: "Ưu tiên ổn định và hỗ trợ phù hợp." }];
    const lock = state.meditation.locked ? `<section class="dharma-focus-lock" role="dialog" aria-modal="true"><div class="dharma-focus-lock__breath"><i></i><strong data-timer-display>${formatTimer(timerRemaining)}</strong><small>${safe(current.label)} · Không gian tĩnh tâm đang khóa</small></div><p>Thả lỏng vai, biết rõ thân và giữ hơi thở tự nhiên.</p><div><button type="button" data-grounding> Dừng và ổn định lại</button><button type="button" data-meditation-unlock>Mở khóa thao tác</button></div></section>` : "";
    return `${lock}<section class="dharma-meditation-course dharma-paper-card"><header><div><small>7 NGÀY THIỀN CHO NGƯỜI MỚI</small><h2>Mỗi ngày một thực hành vừa sức</h2></div><span>${completedCourse.length}/7 ngày</span></header><div>${MEDITATION_COURSE.map((day) => `<button type="button" data-course-day="${day.day}" class="${completedCourse.includes(day.day) ? "is-complete" : ""}"><i>${completedCourse.includes(day.day) ? "✓" : day.day}</i><span><strong>${safe(day.title)}</strong><small>${day.minutes} phút · ${safe(practices.find((item) => item.id === day.type)?.label || day.type)}</small></span></button>`).join("")}</div></section><section class="dharma-practice-chooser">${practices.map((item) => `<button type="button" data-meditation-type="${item.id}" class="${current.id === item.id ? "is-active" : ""}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.guidance}</small></span></button>`).join("")}</section><section class="dharma-meditation-checkin dharma-paper-card"><header><div><small>KIỂM TRA AN TOÀN TRƯỚC BUỔI THIỀN</small><h2>Lúc này bạn cảm thấy thế nào?</h2></div><span>Không chẩn đoán</span></header><div>${checkIns.map((item) => `<button type="button" data-meditation-checkin="${item.id}" class="${state.meditation.checkIn === item.id ? "is-active" : ""}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.note}</small></span></button>`).join("")}</div>${state.meditation.checkIn === "overwhelmed" ? '<aside><strong>Hãy ổn định trước khi bắt đầu</strong><p>HH tạm không khởi chạy timer. Mở mắt, quan sát môi trường và tìm một người an toàn hoặc hỗ trợ chuyên môn khi cần.</p><button type="button" data-grounding>Mở hướng dẫn ổn định</button></aside>' : ""}</section><section class="dharma-practice-stage"><article class="dharma-meditation dharma-paper-card"><header><div><small>THIỀN ĐƯỜNG SỐ · ${safe(current.label.toUpperCase())}</small><h2>Ngồi yên, biết rõ, không ép buộc</h2></div><span class="dharma-bell" aria-hidden="true">♩</span></header><div class="dharma-timer"><i></i><strong data-timer-display>${formatTimer(timerRemaining)}</strong><small>${timerRunning ? "Đang thực hành" : state.meditation.checkIn === "overwhelmed" ? "Đang tạm dừng vì an toàn" : "Sẵn sàng"}</small></div><div class="dharma-presets">${[5,10,15,30,45,60].map((minutes) => `<button type="button" data-timer-preset="${minutes}" class="${timerInitial === minutes * 60 ? "is-active" : ""}">${minutes}′</button>`).join("")}</div>${state.meditation.presets.length ? `<div class="dharma-saved-presets">${state.meditation.presets.map((preset) => `<button type="button" data-use-meditation-preset="${preset.id}"><strong>${safe(preset.label)}</strong><small>${preset.minutes}′ · ${preset.bellInterval ? `chuông ${preset.bellInterval}′` : "không chuông"}</small></button>`).join("")}</div>` : ""}<div class="dharma-meditation-options"><label>Chuông giữa buổi<select data-bell-interval><option value="0" ${state.meditation.bellInterval === 0 ? "selected" : ""}>Không dùng</option>${[5,10,15].map((value) => `<option value="${value}" ${state.meditation.bellInterval === value ? "selected" : ""}>Mỗi ${value} phút</option>`).join("")}</select></label><label class="dharma-check"><input type="checkbox" data-meditation-silent ${state.meditation.silent ? "checked" : ""}><span>Im lặng hoàn toàn</span></label></div><div class="dharma-timer-actions"><button type="button" data-save-meditation-preset>Lưu preset</button><button type="button" data-timer-reset>Đặt lại</button><button type="button" data-meditation-lock ${timerRunning ? "" : "disabled"}>Khóa tĩnh tâm</button><button class="dharma-primary" type="button" data-timer-toggle ${state.meditation.checkIn === "overwhelmed" ? "disabled" : ""}>${timerRunning ? "Tạm dừng" : "Bắt đầu"}</button></div><button class="dharma-grounding" type="button" data-grounding>! Dừng và ổn định lại</button><p>${safe(current.guidance)} Nếu thấy hoảng sợ, khó thở hoặc bất ổn, hãy dừng lại, mở mắt và tìm hỗ trợ phù hợp.</p></article><article class="dharma-chant dharma-paper-card"><header><div><small>NIỆM PHẬT</small><h2>Bộ đếm riêng tư</h2></div><span>念</span></header><p>Đếm để duy trì thời khóa, không quy đổi thành công đức và không xếp hạng.</p><div><button type="button" data-chant-minus aria-label="Giảm một">−</button><strong data-chant-count>${state.chantCount}</strong><button type="button" data-chant-plus aria-label="Tăng một">+</button></div><footer><button type="button" data-chant-add="10">+10</button><button type="button" data-chant-add="108">+108</button><button type="button" data-dharma-nav="chanting">Mở phòng tụng</button></footer></article></section><section class="dharma-practice-stats"><article><small>7 NGÀY</small><strong>${weekMinutes} phút</strong><p>Theo dõi thói quen, không tạo chuỗi thành tích.</p></article><article><small>30 NGÀY</small><strong>${monthMinutes} phút</strong><p>Không so sánh với người học khác.</p></article><article><small>PHIÊN ĐÃ LƯU</small><strong>${state.practiceHistory.length}</strong><p>Dữ liệu riêng trên thiết bị.</p></article></section><section class="dharma-history dharma-paper-card"><header><div><small>LỊCH SỬ RIÊNG TƯ</small><h2>Các lần thực hành gần đây</h2></div><div><button type="button" data-dharma-nav="journal">Ghi cảm nhận</button><button type="button" data-clear-practice ${recent.length ? "" : "disabled"}>Xóa lịch sử</button></div></header><div>${recent.map((item) => `<p><i>禪</i><span><strong>${item.minutes} phút · ${safe(item.type || "Hơi thở")}</strong><small>${safe(formatDate(item.at))}</small></span><b>Đã hoàn thành</b></p>`).join("") || "<p class=\"dharma-empty-line\">Chưa có lần thực hành nào được lưu.</p>"}</div></section>`;
  }

  function chantingMarkup() {
    const chant = CHANTS.find((item) => item.id === state.chant.selected) || CHANTS[0];
    const currentLine = Math.max(0, Math.min(chant.lines.length - 1, chantLineIndex < 0 ? chantSelectedLine : chantLineIndex));
    return `${chantTimerId ? `<div class="dharma-chant-mini"><span>誦</span><p><small>GIỌNG TỔNG HỢP · ${safe(chant.title)}</small><strong>${safe(chant.lines[Math.max(0, currentLine)]?.text || "Đang chuẩn bị…")}</strong></p><button type="button" data-chant-play>Ⅱ</button><button type="button" data-chant-stop>×</button></div>` : ""}<section class="dharma-route-intro dharma-paper-card"><div><small>PHÒNG TỤNG NIỆM</small><h2>Đọc chậm, hiểu nghĩa, không chạy theo số lượng</h2><p>Các bài dưới đây là lời hướng dẫn do HH biên soạn, không giả là nguyên văn kinh. Âm đọc được tạo cục bộ bằng giọng tổng hợp của trình duyệt, không phải giọng tăng ni.</p></div><span class="dharma-seal">誦</span></section><section class="dharma-chant-room"><aside>${CHANTS.map((item) => `<button type="button" data-select-chant="${item.id}" class="${chant.id === item.id ? "is-active" : ""}"><i>誦</i><span><strong>${safe(item.title)}</strong><small>${safe(item.tradition)} · ${safe(item.sourceLabel)}</small></span></button>`).join("")}</aside><article class="dharma-paper-card" style="--chant-font:${Number(state.chant.fontSize)}px;--chant-line:${Number(state.chant.lineHeight)}"><header><div><small>${safe(chant.sourceLabel)}</small><h2>${safe(chant.title)}</h2></div><span class="dharma-bell">♩</span></header><div class="dharma-chant-display-options"><label class="dharma-check"><input type="checkbox" data-chant-transliteration ${state.chant.showTransliteration ? "checked" : ""}><span>Phiên âm</span></label><label class="dharma-check"><input type="checkbox" data-chant-meaning ${state.chant.showMeaning ? "checked" : ""}><span>Giải nghĩa</span></label><label>Cỡ chữ<select data-chant-font>${[18,20,22,24,28].map((size) => `<option value="${size}" ${state.chant.fontSize === size ? "selected" : ""}>${size}px</option>`).join("")}</select></label><label>Dòng<select data-chant-line-height>${[[1.5,"Gọn"],[1.7,"Vừa"],[2,"Rộng"]].map(([value,label]) => `<option value="${value}" ${Number(state.chant.lineHeight) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><ol data-chant-lines>${chant.lines.map((line, index) => `<li class="${chantLineIndex === index ? "is-speaking" : ""} ${chantSelectedLine === index ? "is-selected" : ""}"><button type="button" data-chant-line="${index}" aria-label="Chọn câu ${index + 1}"><i>${index + 1}</i><span><strong>${safe(line.text)}</strong>${state.chant.showTransliteration ? `<em>${safe(line.transliteration)}</em>` : ""}${state.chant.showMeaning ? `<small>${safe(line.meaning)}</small>` : ""}</span></button></li>`).join("")}</ol><footer><label>Tốc độ<select data-chant-pace><option value="slow" ${state.chant.pace === "slow" ? "selected" : ""}>Chậm</option><option value="normal" ${state.chant.pace === "normal" ? "selected" : ""}>Tự nhiên</option></select></label><label>Hẹn dừng<select data-chant-sleep><option value="0" ${state.chant.sleepMinutes === 0 ? "selected" : ""}>Không hẹn</option>${[5,10,15,30].map((value) => `<option value="${value}" ${state.chant.sleepMinutes === value ? "selected" : ""}>${value} phút</option>`).join("")}</select></label><label class="dharma-check"><input type="checkbox" data-chant-repeat ${state.chant.repeat ? "checked" : ""}><span>Lặp lại</span></label><button type="button" data-chant-stop>Đặt lại</button><button class="dharma-primary" type="button" data-chant-play>${chantTimerId ? "Tạm dừng" : "Bắt đầu đọc"}</button></footer></article></section><aside class="dharma-practice-warning"><strong>Giữ sự tỉnh táo</strong><p>Nếu thuộc một nghi thức hoặc truyền thống cụ thể, hãy dùng nghi quỹ và hướng dẫn từ cơ sở tôn giáo hoặc vị thầy có thẩm quyền. HH không thay thế hướng dẫn đó.</p></aside>`;
  }

  function scheduleMarkup() {
    const view = state.calendar.view;
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - (view === "week" ? (now.getDay() || 7) - 1 : 0)); start.setHours(0,0,0,0);
    const days = Array.from({ length: view === "month" ? 30 : view === "week" ? 7 : 1 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
    const missed = state.events.filter((item) => new Date(item.at) < now && !item.completed).length;
    const suggestedMinutes = missed >= 3 ? Math.max(5, Math.min(10, state.studySchedule.minutes)) : state.studySchedule.minutes;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>THỜI KHÓA THÔNG MINH</small><h2>Một lịch vừa sức và có thể nghỉ</h2><p>Chọn nhịp sáng hoặc tối, xem ngày–tuần–tháng và xuất lịch. Việc bỏ lỡ chỉ dùng để giảm tải gợi ý, không tạo hình phạt hay chuỗi thành tích.</p></div><span class="dharma-seal">曆</span></section><section class="dharma-calendar-toolbar"><div role="tablist">${[["day","Ngày"],["week","Tuần"],["month","Tháng"]].map(([id,label]) => `<button type="button" data-calendar-view="${id}" aria-selected="${view === id}">${label}</button>`).join("")}</div><label>Mẫu thời khóa<select data-calendar-template><option value="balanced" ${state.calendar.template === "balanced" ? "selected" : ""}>Cân bằng</option><option value="morning" ${state.calendar.template === "morning" ? "selected" : ""}>Buổi sáng</option><option value="evening" ${state.calendar.template === "evening" ? "selected" : ""}>Buổi tối</option><option value="reading" ${state.calendar.template === "reading" ? "selected" : ""}>Đọc kinh</option></select></label><button type="button" data-calendar-rest aria-pressed="${state.calendar.paused}">${state.calendar.paused ? "▶ Tiếp tục thời khóa" : "Ⅱ Chế độ nghỉ"}</button><button type="button" data-export-calendar ${state.events.length ? "" : "disabled"}>Xuất .ics</button></section>${state.calendar.paused ? '<aside class="dharma-calendar-rest"><span>休</span><div><strong>Thời khóa đang nghỉ</strong><p>Không có nội dung nào bị xóa. Bạn có thể tiếp tục bất cứ lúc nào mà không bị phạt hoặc mất “chuỗi”.</p></div></aside>' : ""}<section class="dharma-calendar-grid dharma-paper-card">${days.map((date) => { const key = localDayKey(date); const entries = state.events.filter((item) => String(item.at).startsWith(key)); return `<article class="${key === todayKey() ? "is-today" : ""}"><header><small>${safe(new Intl.DateTimeFormat("vi-VN",{weekday:"short"}).format(date))}</small><strong>${date.getDate()}</strong></header><div>${entries.map((item) => `<button type="button" data-event-complete="${safe(item.id)}" class="${item.completed ? "is-complete" : ""}"><i>${item.completed ? "✓" : "灯"}</i><span><strong>${safe(item.title)}</strong><small>${safe(new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(new Date(item.at)))}</small></span></button>`).join("") || '<span>Thời gian trống</span>'}</div></article>`; }).join("")}</section><section class="dharma-schedule-columns"><article class="dharma-event-planner dharma-paper-card"><header><div><small>THÊM VÀO LỊCH RIÊNG</small><h2>Học, thiền hoặc pháp thoại</h2></div><span>Không gửi ra ngoài</span></header><form data-event-form><label>Tên hoạt động<input name="title" required maxlength="120" placeholder="Ví dụ: Đọc Kinh Từ Bi"></label><label>Thời gian<input name="at" type="datetime-local" required></label><label>Loại<select name="type"><option>Học Pháp</option><option>Đọc kinh</option><option>Thiền</option><option>Tụng niệm</option><option>Pháp thoại</option><option>Ngày ăn chay / ngày lễ</option></select></label><button class="dharma-primary" type="submit">Thêm vào lịch</button></form></article><article class="dharma-schedule-advice dharma-paper-card"><small>GỢI Ý TỰ ĐIỀU CHỈNH</small><h2>${missed >= 3 ? "Giảm tải để bắt đầu lại" : "Giữ nhịp hiện tại"}</h2><p>${missed >= 3 ? `Có ${missed} hoạt động đã qua chưa ghi nhận. HH đề xuất tạm dùng ${suggestedMinutes} phút/ngày.` : `Thời khóa hiện tại ${state.studySchedule.minutes} phút vào ${safe(state.studySchedule.time)}.`}</p><button type="button" data-apply-schedule-suggestion="${suggestedMinutes}">Áp dụng ${suggestedMinutes} phút/ngày</button><p class="dharma-calendar-lunar">Ngày ăn chay và ngày lễ theo âm lịch chỉ được lưu dưới dạng nhắc cá nhân cho đến khi có lịch pháp sự chính thức đã kiểm chứng.</p></article></section>`;
  }

  function reviewCatalog() {
    const lessonItems = state.completedLessons.map((id) => {
      const item = LESSONS.find((entry) => entry.id === id); if (!item) return null;
      return { key: `lesson:${id}`, kind: "Bài học", title: item.title, prompt: "Bài này giúp bạn hiểu điều gì và đề xuất thực hành nào?", answer: `${item.summary} Thực hành: ${item.practice}`, sourceId: item.sourceId };
    });
    const scriptureItems = state.bookmarks.map((id) => {
      const item = SCRIPTURES.find((entry) => entry.id === id); if (!item) return null;
      return { key: `scripture:${id}`, kind: "Kinh điển", title: item.title, prompt: `Mã ${item.code} thuộc bộ nào và tóm lược HH nêu ý chính gì?`, answer: `${item.collection}. ${item.summary}`, sourceId: item.sourceId };
    });
    const glossaryItems = state.glossaryDeck.map((id) => {
      const item = GLOSSARY.find((entry) => entry.id === id); if (!item) return null;
      return { key: `glossary:${id}`, kind: "Thuật ngữ", title: `${item.hanViet} · ${item.pali}`, prompt: `${item.han} có nghĩa học tập nào và cần tránh hiểu sai ra sao?`, answer: `${item.vietnamese}. ${item.note}`, sourceId: "suttacentral" };
    });
    return [...lessonItems, ...scriptureItems, ...glossaryItems].filter(Boolean);
  }

  function reviewMarkup() {
    const items = reviewCatalog();
    const now = Date.now();
    const due = items.filter((item) => !state.reviewSchedule[item.key]?.dueAt || new Date(state.reviewSchedule[item.key].dueAt).getTime() <= now);
    const selected = items.find((item) => item.key === selectedReviewKey) || due[0] || items[0];
    if (selected) selectedReviewKey = selected.key;
    const upcoming = items.filter((item) => state.reviewSchedule[item.key]?.dueAt && new Date(state.reviewSchedule[item.key].dueAt).getTime() > now).sort((a,b) => state.reviewSchedule[a.key].dueAt.localeCompare(state.reviewSchedule[b.key].dueAt));
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>ÔN GIÁO LÝ CÓ NGUỒN</small><h2>Nhắc lại điều đã học, không chạy theo điểm số</h2><p>Hàng ôn chỉ lấy từ bài đã hoàn thành, kinh đã lưu và thuật ngữ bạn chủ động đưa vào bộ ôn. “Đã hiểu” chỉ là tự đánh giá tạm thời, không phải chứng nhận hay cấp bậc tâm linh.</p></div><span class="dharma-seal">習</span></section><section class="dharma-review-dashboard"><article><small>ĐẾN LÚC XEM LẠI</small><strong>${due.length}</strong><p>Nội dung cần nhắc lại hôm nay</p></article><article><small>ĐANG HẸN SAU</small><strong>${upcoming.length}</strong><p>Được giãn theo lựa chọn của bạn</p></article><article><small>LẦN ÔN ĐÃ GHI</small><strong>${state.reviewHistory.length}</strong><p>Không quy đổi thành điểm hoặc streak</p></article></section>${selected ? `<section class="dharma-review-workspace"><aside>${items.map((item) => { const schedule = state.reviewSchedule[item.key]; const isDue = !schedule?.dueAt || new Date(schedule.dueAt).getTime() <= now; return `<button type="button" data-select-study-review="${safe(item.key)}" class="${selected.key === item.key ? "is-active" : ""}"><i>${isDue ? "•" : "○"}</i><span><small>${safe(item.kind)} · ${isDue ? "Đến lúc xem" : `Hẹn ${safe(formatDate(schedule.dueAt))}`}</small><strong>${safe(item.title)}</strong></span></button>`; }).join("")}</aside><article class="dharma-paper-card"><header><div><small>${safe(selected.kind)} · TỰ KIỂM TRA</small><h2>${safe(selected.title)}</h2></div>${sourceBadge(selected.sourceId)}</header><section><small>CÂU GỢI NHỚ</small><p>${safe(selected.prompt)}</p></section><section class="dharma-review-answer ${studyReviewReveal ? "is-revealed" : ""}"><small>${studyReviewReveal ? "TÓM LƯỢC HH / NỘI DUNG ĐÃ BIÊN SOẠN" : "CHƯA MỞ GIẢI THÍCH"}</small><p>${studyReviewReveal ? safe(selected.answer) : "Tự nhớ lại bằng lời của bạn trước, sau đó mở phần đối chiếu."}</p></section><footer>${studyReviewReveal ? `<button type="button" data-rate-study-review="again">Cần xem lại ngày mai</button><button type="button" data-rate-study-review="soon">Xem lại sau 3 ngày</button><button type="button" data-rate-study-review="later">Tạm hiểu · sau 7 ngày</button>` : '<button class="dharma-primary" type="button" data-reveal-study-review>Mở phần đối chiếu</button>'}</footer></article></section>` : '<section class="dharma-empty dharma-paper-card"><span>習</span><strong>Hàng ôn đang trống</strong><p>Hoàn thành một bài, lưu một kinh hoặc thêm thuật ngữ vào bộ ôn để bắt đầu.</p><button type="button" data-dharma-nav="beginner">Mở lộ trình tu học</button></section>'}<aside class="dharma-practice-warning"><strong>Ôn tập không thay thế học với bối cảnh</strong><p>Khi một câu trả lời liên quan khác biệt truyền thống, nghi lễ hoặc giới luật, hãy mở nguồn và hỏi người hướng dẫn đủ phẩm hạnh thay vì ghi nhớ một câu rút gọn.</p></aside>`;
  }

  function audioStudyCatalog() {
    return [...LESSONS.map((item) => ({ key: `lesson:${item.id}`, kind: "Bài học HH", title: item.title, text: `${item.title}. ${item.summary} Gợi ý thực hành. ${item.practice}`, sourceId: item.sourceId, minutes: Math.max(2, Math.round(item.summary.length / 700)) })), ...SCRIPTURES.map((item) => ({ key: `scripture:${item.id}`, kind: "Tóm lược kinh", title: item.title, text: `${item.title}, ${item.code}. ${item.summary}`, sourceId: item.sourceId, minutes: Math.max(2, Math.round(item.summary.length / 700)) }))];
  }

  function audioMarkup() {
    const catalog = audioStudyCatalog();
    const queue = state.audio.queue.map((key) => catalog.find((item) => item.key === key)).filter(Boolean);
    const current = queue[audioStudyIndex] || queue[0];
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>THƯ VIỆN NGHE PHÁP HỌC</small><h2>Nghe tóm lược đã biên soạn, biết rõ loại âm thanh</h2><p>Trình duyệt đọc nội dung HH bằng giọng tổng hợp và luôn gắn nhãn rõ ràng. Đây không phải giọng tăng ni, không phải bản tụng có bản quyền và không phải nguyên văn kinh.</p></div><span class="dharma-seal">聽</span></section><section class="dharma-audio-library"><div><header><small>NỘI DUNG CÓ THỂ NGHE</small><h2>Chọn bài vào hàng nghe</h2></header>${catalog.map((item) => `<article><span>${item.kind === "Bài học HH" ? "法" : "經"}</span><div><small>${safe(item.kind)} · khoảng ${item.minutes} phút</small><h3>${safe(item.title)}</h3>${sourceBadge(item.sourceId)}</div><button type="button" data-audio-queue="${safe(item.key)}">${state.audio.queue.includes(item.key) ? "✓ Đã thêm" : "+ Thêm"}</button></article>`).join("")}</div><aside class="dharma-paper-card"><header><div><small>HÀNG NGHE RIÊNG TƯ</small><h2>${queue.length} nội dung</h2></div><span class="${audioStudyPlaying ? "is-playing" : ""}">♩</span></header>${current ? `<section class="dharma-audio-now"><small>${audioStudyPlaying ? "ĐANG ĐỌC" : "SẴN SÀNG"}</small><strong>${safe(current.title)}</strong><p>Giọng tổng hợp của trình duyệt · ${safe(current.kind)}</p></section>` : '<p class="dharma-empty-line">Chưa có nội dung trong hàng nghe.</p>'}<ol>${queue.map((item,index) => `<li class="${index === audioStudyIndex ? "is-current" : ""}"><i>${index + 1}</i><span><strong>${safe(item.title)}</strong><small>${safe(item.kind)}</small></span><button type="button" data-remove-audio="${safe(item.key)}" aria-label="Bỏ ${safe(item.title)}">×</button></li>`).join("")}</ol><footer><label>Tốc độ<select data-audio-rate>${[[.72,"Chậm"],[.88,"Tự nhiên"],[1,"Nhanh"]].map(([value,label]) => `<option value="${value}" ${Number(state.audio.rate) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><button type="button" data-audio-stop ${audioStudyPlaying ? "" : "disabled"}>Dừng</button><button class="dharma-primary" type="button" data-audio-play ${queue.length ? "" : "disabled"}>${audioStudyPlaying ? "Tạm dừng" : "Bắt đầu nghe"}</button></footer></aside></section><aside class="dharma-practice-warning"><strong>Quyền sử dụng âm thanh</strong><p>Phiên bản này chỉ dùng SpeechSynthesis cục bộ cho nội dung HH. Tệp pháp thoại hoặc tụng niệm của bên thứ ba chỉ được thêm khi có giấy phép âm thanh riêng, người đọc và nguồn công bố rõ ràng.</p></aside>`;
  }

  function dataControlMarkup() {
    const journalMeta = readJournalMeta();
    const studySize = new Blob([JSON.stringify(state)]).size;
    const pending = pendingImport ? `<section class="dharma-import-preview"><header><span>✓</span><div><small>TỆP ĐÃ KIỂM TRA CHECKSUM</small><h3>${safe(pendingImport.label)}</h3></div></header><dl><div><dt>Loại</dt><dd>${safe(pendingImport.type === "study" ? "Dữ liệu tu học" : "Nhật ký mã hóa")}</dd></div><div><dt>Ngày xuất</dt><dd>${safe(formatDate(pendingImport.exportedAt))}</dd></div><div><dt>Phạm vi</dt><dd>${safe(pendingImport.summary)}</dd></div></dl><div><button type="button" data-cancel-import>Hủy</button><button class="dharma-primary" type="button" data-confirm-import>Xác nhận khôi phục</button></div></section>` : "";
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>TỦ DỮ LIỆU CÁ NHÂN</small><h2>Sao lưu có kiểm tra, khôi phục có xem trước</h2><p>Dữ liệu học và nhật ký được xuất thành hai gói riêng. Gói học không chứa PIN hoặc nhật ký; gói nhật ký chỉ chứa bản mã AES-GCM, không chứa PIN giải mã.</p></div><span class="dharma-seal">庫</span></section><section class="dharma-data-vault"><article class="dharma-paper-card"><header><span>學</span><div><small>GÓI TU HỌC · JSON</small><h2>${Math.max(1,Math.round(studySize/1024))} KB cục bộ</h2></div></header><p>Bao gồm lộ trình, mục đã lưu, thời khóa, bộ ôn, tùy chọn trợ năng và nhóm đọc cục bộ. Không chứa thông tin đăng nhập.</p><button class="dharma-primary" type="button" data-export-study-backup>Xuất gói <code>.hhphap</code></button><label class="dharma-file-picker">Khôi phục gói tu học<input type="file" data-import-backup="study" accept=".hhphap,application/json"><span>Chọn gói <code>.hhphap</code> từ thiết bị</span></label></article><article class="dharma-paper-card"><header><span>鎖</span><div><small>NHẬT KÝ ĐÃ MÃ HÓA</small><h2>${journalMeta ? "Có bản mã trên thiết bị" : "Chưa tạo nhật ký"}</h2></div></header><p>${journalMeta ? "Xuất nguyên bản mã AES-GCM cùng salt và IV. Bạn vẫn cần PIN hiện tại để mở sau khi khôi phục." : "Tạo nhật ký mã hóa trước khi xuất. HH không cho phép sao lưu dạng văn bản rõ."}</p><button type="button" data-export-journal-backup ${journalMeta ? "" : "disabled"}>Xuất <code>.hhjournal</code> đã mã hóa</button><label class="dharma-file-picker">Khôi phục bản mã<input type="file" data-import-backup="journal" accept=".hhjournal,application/json"><span>Chọn gói <code>.hhjournal</code> từ thiết bị</span></label></article></section>${pending}<section class="dharma-data-boundaries"><article><span>✓</span><div><strong>Checksum SHA-256</strong><p>Tệp bị thay đổi sau khi xuất sẽ bị từ chối trước màn hình xác nhận.</p></div></article><article><span>⌾</span><div><strong>Không tự đồng bộ</strong><p>Chỉ đọc tệp bạn chủ động chọn; không tải dữ liệu lên máy chủ.</p></div></article><article><span>!</span><div><strong>Không thể khôi phục PIN</strong><p>Mất PIN nhật ký đồng nghĩa không thể giải mã bản sao lưu.</p></div></article></section><section class="dharma-export-history dharma-paper-card"><header><small>LỊCH SỬ XUẤT TRÊN THIẾT BỊ</small><h2>Các gói gần đây</h2></header>${state.exportHistory.slice(-6).reverse().map((item) => `<p><i>${item.type === "study" ? "學" : "鎖"}</i><span><strong>${safe(item.label)}</strong><small>${safe(formatDate(item.at))}</small></span><b>${safe(item.type === "study" ? "Tu học" : "Bản mã")}</b></p>`).join("") || '<p class="dharma-empty-line">Chưa xuất gói sao lưu nào.</p>'}</section>`;
  }

  function glossaryMarkup() {
    const selected = GLOSSARY.find((item) => item.id === selectedGlossary) || GLOSSARY[0];
    const detail = GLOSSARY_DETAILS[selected.id] || {};
    const inDeck = state.glossaryDeck.includes(selected.id);
    const review = state.glossaryDeck.length ? GLOSSARY.find((item) => item.id === state.glossaryDeck[glossaryReviewIndex % state.glossaryDeck.length]) : null;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>TỪ ĐIỂN PHẬT HỌC VIỆT NAM</small><h2>Hiểu thuật ngữ trong đúng ngữ cảnh</h2><p>Tìm không dấu hoặc Hán tự, nghe cách đọc tham khảo và lưu thẻ ôn cá nhân. Mọi định nghĩa đều là giải thích học tập của HH, không thay thế từ điển chuyên ngành.</p></div><span class="dharma-seal">字</span></section><section class="dharma-glossary"><aside><label><span>⌕</span><input type="search" data-glossary-search placeholder="Tìm Pāli, Sanskrit, Hán tự…"></label><div data-glossary-list>${GLOSSARY.map((item) => `<button type="button" data-glossary="${item.id}" class="${selected.id === item.id ? "is-active" : ""}"><i>${item.han}</i><span><strong>${safe(item.hanViet)}</strong><small>${safe(item.pali)} · ${safe(item.sanskrit)}</small></span></button>`).join("")}</div></aside><article class="dharma-paper-card dharma-glossary-detail" data-glossary-detail><header><span>${selected.han}</span><div><small>${safe(selected.pali)} · ${safe(selected.sanskrit)}</small><h2>${safe(selected.hanViet)}</h2><p>${safe(detail.pronunciation || "Phát âm đang biên tập")}</p></div><button type="button" data-speak-glossary="${selected.id}">▷ Nghe</button></header><section><small>NGHĨA TIẾNG VIỆT · HH GIẢI THÍCH</small><p>${safe(selected.vietnamese)}</p></section><section><small>TỪ NGUYÊN</small><p>${safe(detail.etymology || selected.note)}</p></section><section><small>NGHĨA THEO NGỮ CẢNH</small><p>${safe(detail.contexts || selected.note)}</p></section><section class="dharma-glossary-caution"><small>CÁCH HIỂU SAI THƯỜNG GẶP</small><p>${safe(detail.misunderstanding || selected.note)}</p></section><section><small>LIÊN KẾT NGƯỢC</small><div class="dharma-backlinks">${(detail.backlinks || selected.related).map((item) => `<span>${safe(item)}</span>`).join("")}</div></section><footer><button type="button" data-glossary-deck="${selected.id}">${inDeck ? "✓ Đã ở trong bộ ôn" : "+ Đưa vào bộ ôn"}</button>${selected.related.map((item) => `<span>${safe(item)}</span>`).join("")}</footer></article></section><section class="dharma-glossary-review dharma-paper-card"><header><div><small>BỘ THẺ THUẬT NGỮ CÁ NHÂN</small><h2>Ôn để hiểu đúng, không chấm “điểm tâm linh”</h2></div><span>${state.glossaryDeck.length} thẻ</span></header>${review ? `<article class="${glossaryReveal ? "is-revealed" : ""}"><span>${review.han}</span><small>${safe(review.pali)} · ${safe(review.sanskrit)}</small><h3>${safe(review.hanViet)}</h3><p>${glossaryReveal ? safe(review.vietnamese) : "Tự nhắc lại nghĩa và bối cảnh, rồi mở phần giải thích."}</p><div><button type="button" data-glossary-reveal>${glossaryReveal ? "Ẩn giải thích" : "Mở giải thích"}</button><button type="button" data-glossary-next>Thẻ tiếp theo →</button></div></article>` : '<p class="dharma-empty-line">Chọn “Đưa vào bộ ôn” ở một thuật ngữ để bắt đầu.</p>'}</section>`;
  }

  function mapMarkup() {
    const selected = DHARMA_MAP.find((item) => item.id === selectedMapNode) || DHARMA_MAP[0];
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>BẢN ĐỒ GIÁO PHÁP</small><h2>Thấy mối liên hệ, không học từng khái niệm rời rạc</h2><p>Chọn một nút để chỉ làm sáng nhánh liên quan. Đây là sơ đồ học tập HH, không phải cách phân loại duy nhất của mọi truyền thống.</p></div><span class="dharma-seal">圖</span></section><section class="dharma-map-stage" style="--map-index:${DHARMA_MAP.indexOf(selected)}"><div class="dharma-map-wheel">${DHARMA_MAP.map((item, index) => `<button type="button" data-map-node="${item.id}" class="${selected.id === item.id || selected.links.includes(item.id) ? "is-related" : ""} ${selected.id === item.id ? "is-active" : ""}" style="--node:${index}"><i>${item.icon}</i><span>${safe(item.label)}</span></button>`).join("")}<strong>法</strong></div><article class="dharma-paper-card"><small>NHÁNH ĐANG HỌC</small><h2>${safe(selected.label)}</h2><p>${safe(selected.summary)}</p><div>${selected.links.map((id) => { const item = DHARMA_MAP.find((entry) => entry.id === id); return item ? `<button type="button" data-map-node="${item.id}">${safe(item.label)} →</button>` : ""; }).join("")}</div><button class="dharma-primary" type="button" data-open-teaching="${selected.id === "four-truths" ? "tu-dieu-de" : selected.id === "eightfold" ? "bat-chanh-dao" : selected.id === "aggregates" ? "ngu-uan" : selected.id === "dependent" ? "duyen-khoi" : selected.id === "mindfulness" ? "chanh-niem" : "tu-vo-luong-tam"}">Mở bài giáo lý liên quan</button></article></section>`;
  }

  function provenanceMarkup() {
    const reports = Array.isArray(state.sourceReports) ? state.sourceReports.slice().reverse() : [];
    const drafts = Array.isArray(state.metadataDrafts) ? state.metadataDrafts.slice().reverse() : [];
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>TRUNG TÂM KIỂM CHỨNG NGUỒN</small><h2>Mọi nội dung đều có xuất xứ và trạng thái</h2><p>Theo dõi liên kết, dịch giả, giấy phép, lịch sử biên tập và phản hồi. Tóm lược HH luôn tách khỏi nguyên văn và bản dịch.</p></div><span class="dharma-seal">證</span></section><section class="dharma-source-dashboard"><article><i>✓</i><span><strong>${SCRIPTURES.filter((item) => item.verified).length}/${SCRIPTURES.length}</strong><small>Tài liệu có metadata nguồn</small></span></article><article><i>↗</i><span><strong>${SOURCES.length}</strong><small>Thư viện và tổ chức tham chiếu</small></span></article><article><i>!</i><span><strong>${reports.filter((item) => item.status === "Chờ biên tập").length}</strong><small>Phản hồi đang chờ</small></span></article><article><i>稿</i><span><strong>${drafts.length}</strong><small>Bản nháp metadata cục bộ</small></span></article></section><section class="dharma-source-ledger dharma-paper-card"><header><div><small>SỔ NGUỒN</small><h2>Tài liệu đang công bố</h2></div><span>Kiểm tra gần nhất · 23/08/2026</span></header><div>${SCRIPTURES.map((item) => `<button type="button" data-open-provenance="${item.id}"><i>${item.verified ? "✓" : "!"}</i><span><small>${safe(item.code)} · ${safe(item.sourceLanguage)}</small><strong>${safe(item.title)}</strong></span><em>${safe(item.license)}</em><b>›</b></button>`).join("")}</div></section><section class="dharma-provenance-columns"><article class="dharma-paper-card"><header><small>LỊCH SỬ CHỈNH SỬA</small><h2>Ai đã thay đổi điều gì</h2></header>${SOURCE_HISTORY.map((entry) => `<p><i>◉</i><span><strong>${safe(entry.action)}</strong><small>${safe(entry.at)} · ${safe(entry.editor)}</small></span><b>${safe(entry.status)}</b></p>`).join("")}</article><article class="dharma-paper-card"><header><small>SO SÁNH PHIÊN BẢN</small><h2>Trước và sau</h2></header><div class="dharma-version-diff"><section><small>TRƯỚC</small><p>“Tóm lược kinh điển” — chưa nêu rõ loại nội dung.</p></section><section><small>HIỆN TẠI</small><p><mark>“HH tóm lược · không phải bản dịch”</mark> cùng mã kinh, nguồn, ngôn ngữ và giấy phép.</p></section></div></article></section><section class="dharma-editorial-console dharma-paper-card"><header><div><small>BIÊN TẬP NGUỒN</small><h2>${canEditSources ? "Tạo bản nháp metadata" : "Quyền biên tập được bảo vệ"}</h2></div><span>${canEditSources ? "Quản trị viên / Biên tập viên" : "Chỉ người có quyền"}</span></header>${canEditSources ? `<form data-metadata-draft><label>Tài liệu<select name="scripture">${SCRIPTURES.map((item) => `<option value="${item.id}">${safe(item.code)} · ${safe(item.title)}</option>`).join("")}</select></label><label>Trường cần sửa<select name="field"><option value="translator">Dịch giả</option><option value="license">Giấy phép</option><option value="code">Mã tham chiếu</option><option value="sourceUrl">Liên kết nguồn</option></select></label><label>Giá trị đề xuất<input name="value" required maxlength="500" placeholder="Giá trị mới đã kiểm chứng"></label><label>Bằng chứng URL<input name="evidence" type="url" required maxlength="500" placeholder="https://nguon-chinh-thuc…"></label><button class="dharma-primary" type="submit">Lưu bản nháp chờ duyệt</button></form>` : '<p>Giao diện công khai chỉ được xem sổ nguồn và gửi báo lỗi. Quyền sửa metadata được kiểm tra từ vai trò tài khoản khi mount workspace, không dựa vào nút ẩn trên giao diện.</p>'}<div class="dharma-editorial-queue">${[...drafts.map((item) => ({ ...item, label: "Bản nháp" })), ...reports.map((item) => ({ ...item, label: "Phản hồi" }))].slice(0, 12).map((item) => `<article><span>${safe(item.label)}</span><div><strong>${safe(item.type || item.field || "Kiểm tra metadata")}</strong><small>${safe(item.status || "Chờ duyệt")} · ${safe(formatDate(item.createdAt))}</small></div><p>${safe(item.detail || item.value || "")}</p>${canEditSources ? `<button type="button" data-delete-editorial="${safe(item.id)}">Xóa khỏi hàng chờ</button>` : ""}</article>`).join("") || '<p class="dharma-empty-line">Chưa có phản hồi hoặc bản nháp đang chờ.</p>'}</div></section>`;
  }

  function templeMarkup() {
    const provinces = unique(TEMPLE_DIRECTORY.map((item) => item.province));
    const traditions = unique(TEMPLE_DIRECTORY.map((item) => item.tradition));
    const accessModes = unique(TEMPLE_DIRECTORY.map((item) => item.access));
    const filtered = TEMPLE_DIRECTORY.filter((item) => (templeProvince === "all" || item.province === templeProvince) && (templeTradition === "all" || item.tradition === templeTradition) && (templeAccess === "all" || item.access === templeAccess));
    return `<section class="dharma-route-intro dharma-paper-card dharma-temple-gate"><div><small>CHÙA ONLINE</small><h2>Kết nối đúng nguồn, giữ sự trang nghiêm</h2><p>Danh bạ chỉ đưa người dùng tới cổng chính thức. HH không nhúng livestream, không thu quyên góp và không lưu số tài khoản cúng dường.</p></div><span class="dharma-temple-mark">寺</span></section><section class="dharma-temple-filters"><select data-temple-province aria-label="Tỉnh thành"><option value="all">Mọi tỉnh thành</option>${provinces.map((item) => `<option value="${safe(item)}" ${templeProvince === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select><select data-temple-tradition aria-label="Truyền thống"><option value="all">Mọi truyền thống</option>${traditions.map((item) => `<option value="${safe(item)}" ${templeTradition === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select><select data-temple-access aria-label="Khả năng tiếp cận"><option value="all">Mọi hình thức tiếp cận</option>${accessModes.map((item) => `<option value="${safe(item)}" ${templeAccess === item ? "selected" : ""}>${safe(item)}</option>`).join("")}</select></section><section class="dharma-temple-directory">${filtered.map((item) => `<article class="dharma-paper-card"><header><span>寺</span><div><small>${safe(item.province)} · ${safe(item.tradition)}</small><h3>${safe(item.title)}</h3></div><b>${item.verified ? "✓ NGUỒN ĐÃ KIỂM TRA" : "CHƯA KIỂM CHỨNG"}</b></header><p>${safe(item.note)}</p><dl><div><dt>Đơn vị</dt><dd>${safe(item.organization)}</dd></div><div><dt>Tiếp cận</dt><dd>${safe(item.access)}</dd></div><div><dt>Kiểm tra</dt><dd>${safe(item.verifiedAt)}</dd></div></dl><footer><button type="button" data-report-temple="${item.id}">Báo liên kết giả mạo</button><a href="${safe(item.url)}" target="_blank" rel="noopener noreferrer">Mở nguồn chính thức ↗</a></footer></article>`).join("") || '<p class="dharma-empty-line">Chưa có nguồn phù hợp bộ lọc. HH không tự điền chùa chưa được kiểm chứng.</p>'}</section><section class="dharma-temple-etiquette"><article><i>衣</i><strong>Trang phục & không gian</strong><p>Ăn mặc lịch sự, giữ yên lặng và tôn trọng khu vực không quay phim.</p></article><article><i>問</i><strong>Hỏi trước khi tham dự</strong><p>Kiểm tra lịch, nội quy, đăng ký và hỗ trợ tiếp cận tại trang chính thức.</p></article><article><i>心</i><strong>Cúng dường tự nguyện</strong><p>Không chuyển tiền qua liên kết hoặc tài khoản chưa xác minh.</p></article></section><section class="dharma-event-planner dharma-paper-card"><header><div><small>LỊCH CÁ NHÂN</small><h2>Lưu một buổi lễ hoặc pháp thoại</h2></div><span>Không gửi dữ liệu ra ngoài</span></header><form data-event-form><label>Tên sự kiện<input name="title" required maxlength="120" placeholder="Ví dụ: Pháp thoại tối Chủ nhật"></label><label>Thời gian<input name="at" type="datetime-local" required></label><input type="hidden" name="type" value="Phật sự"><button class="dharma-primary" type="submit">Lưu vào lịch</button></form><div>${state.events.slice().sort((a,b) => a.at.localeCompare(b.at)).map((item) => `<p><i>灯</i><span><strong>${safe(item.title)}</strong><small>${safe(formatDate(item.at))}</small></span><button type="button" data-delete-event="${safe(item.id)}">Xóa</button></p>`).join("") || '<p class="dharma-empty-line">Chưa có lịch cá nhân.</p>'}</div></section>`;
  }

  function talksMarkup() {
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>PHÁP THOẠI & NGUỒN HỌC</small><h2>Nghe từ kênh công khai, lưu lại để học sau</h2><p>Nội dung mở trong trang gốc để giữ đầy đủ thông tin người giảng, đơn vị đăng và quyền sử dụng.</p></div><span class="dharma-seal">聽</span></section><section class="dharma-talk-grid">${TALKS.map((talk) => `<article><header><span>${talk.type === "Video" ? "▷" : talk.type === "Trực tiếp" ? "●" : "☸"}</span><div><small>${safe(talk.type)} · ${safe(talk.provider)}</small><h3>${safe(talk.title)}</h3></div></header><p>${safe(talk.note)}</p><footer><button type="button" data-save-talk="${talk.id}">${state.savedTalks.includes(talk.id) ? "★ Đã lưu" : "☆ Lưu để xem sau"}</button><a href="${safe(talk.url)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a></footer></article>`).join("")}</section>`;
  }

  function circleInviteCode(circle) {
    const owner = circle.members?.find((member) => member.role === "Chủ nhóm");
    const payload = { version: 1, kind: "hh-dharma-reading-circle", title: circle.title, scriptureId: circle.scriptureId, discussionAt: circle.discussionAt, sharedNotes: circle.sharedNotes || [], coordinator: circle.privacy?.shareAlias ? { alias: owner?.alias || "Chủ nhóm", role: "Chủ nhóm" } : null };
    return `HHC1.${bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)))}`;
  }

  function parseCircleInvite(code) {
    const value = String(code || "").trim();
    if (!value.startsWith("HHC1.")) throw new Error("Mã lời mời không đúng định dạng.");
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(value.slice(5))));
    if (parsed?.kind !== "hh-dharma-reading-circle" || parsed.version !== 1 || !String(parsed.title || "").trim()) throw new Error("Mã lời mời không hợp lệ.");
    return parsed;
  }

  function circlesMarkup() {
    const circle = state.circles.find((item) => item.id === activeCircle);
    if (!circle) return `<section class="dharma-route-intro dharma-paper-card"><div><small>NHÓM ĐỌC KINH RIÊNG TƯ</small><h2>Học cùng nhau mà không lộ dữ liệu cá nhân</h2><p>Nhóm được lưu cục bộ và trao tay bằng mã lời mời. Đây chưa phải đồng bộ máy chủ; nhật ký, thời lượng thiền và tiến độ riêng không bao giờ được đưa vào mã.</p></div><span class="dharma-seal">眾</span></section><section class="dharma-circle-overview"><div class="dharma-circle-list">${state.circles.map((item) => `<button type="button" data-open-circle="${safe(item.id)}"><i>眾</i><span><small>${safe(item.role || "Thành viên")} · ${item.members?.length || 1} người</small><strong>${safe(item.title)}</strong><p>${safe(SCRIPTURES.find((scripture) => scripture.id === item.scriptureId)?.title || "Chưa chọn bài đọc")}</p></span><b>›</b></button>`).join("") || '<div class="dharma-empty"><span>眾</span><strong>Chưa có nhóm đọc</strong><p>Tạo nhóm mới hoặc nhập mã lời mời do người quen gửi trực tiếp.</p></div>'}</div><div class="dharma-circle-create"><article class="dharma-paper-card"><small>TẠO NHÓM CỤC BỘ</small><h2>Một bài đọc, một lịch thảo luận</h2><form data-circle-create><label>Tên nhóm<input name="title" required maxlength="80" placeholder="Ví dụ: Cùng đọc Kinh Từ Bi"></label><label>Bài đọc<select name="scripture">${SCRIPTURES.map((item) => `<option value="${item.id}">${safe(item.title)} · ${safe(item.code)}</option>`).join("")}</select></label><label>Lịch thảo luận<input name="discussionAt" type="datetime-local" required></label><label>Bí danh trong nhóm<input name="alias" maxlength="40" placeholder="Ví dụ: An Tâm"></label><button class="dharma-primary" type="submit">Tạo nhóm riêng tư</button></form></article><article class="dharma-paper-card"><small>NHẬP LỜI MỜI THỦ CÔNG</small><h2>Tham gia từ mã HHC1</h2><form data-circle-join><label>Mã lời mời<textarea name="code" required maxlength="12000" placeholder="HHC1.…"></textarea></label><label>Bí danh của bạn<input name="alias" maxlength="40" placeholder="Không bắt buộc"></label><button type="submit">Kiểm tra và nhập nhóm</button></form><p>Không dán mã từ người lạ. Mã chỉ chứa bài đọc, lịch và ghi chú chia sẻ; không thực hiện đăng nhập hay tải dữ liệu từ mạng.</p></article></div></section>`;
    const scripture = SCRIPTURES.find((item) => item.id === circle.scriptureId);
    const privateNote = state.circlePrivateNotes[circle.id] || "";
    return `<button class="dharma-back" type="button" data-back-circles>← Tất cả nhóm đọc</button><section class="dharma-circle-workspace"><article class="dharma-circle-main dharma-paper-card"><header><span>眾</span><div><small>${safe(circle.role || "Thành viên")} · NHÓM LƯU CỤC BỘ</small><h2>${safe(circle.title)}</h2><p>${safe(scripture?.title || "Chưa chọn bài đọc")} · ${safe(circle.discussionAt ? formatDate(circle.discussionAt) : "Chưa có lịch")}</p></div></header><div class="dharma-circle-privacy"><strong>Riêng tư mặc định</strong><p>Không chia sẻ nhật ký, thời lượng thiền, tiến độ bài học hoặc tài khoản của bạn.</p><label class="dharma-check"><input type="checkbox" data-circle-share-alias="${safe(circle.id)}" ${circle.privacy?.shareAlias ? "checked" : ""}><span>Cho phép đưa bí danh vào mã lời mời</span></label></div><section><header><small>GHI CHÚ CHIA SẺ</small><span>${circle.sharedNotes?.length || 0} ghi chú</span></header>${(circle.sharedNotes || []).map((note) => `<article><small>${safe(note.alias || "Thành viên ẩn danh")} · ${safe(formatDate(note.createdAt))}</small><p>${safe(note.body)}</p></article>`).join("") || '<p class="dharma-empty-line">Chưa có ghi chú chia sẻ.</p>'}<form data-circle-shared-note="${safe(circle.id)}"><label>Nội dung<textarea name="body" required maxlength="2000" placeholder="Chỉ viết điều bạn đồng ý chia sẻ với nhóm…"></textarea></label><button type="submit">Thêm ghi chú chia sẻ</button></form></section><section><header><small>GHI CHÚ RIÊNG</small><span>Chỉ trên thiết bị</span></header><label class="dharma-note"><textarea data-circle-private-note="${safe(circle.id)}" maxlength="3000" placeholder="Không đi vào mã lời mời…">${safe(privateNote)}</textarea></label></section></article><aside class="dharma-circle-side"><article class="dharma-paper-card"><small>THÀNH VIÊN & VAI TRÒ</small><h3>${circle.members?.length || 1} thành viên cục bộ</h3>${(circle.members || []).map((member) => `<p><span><strong>${safe(member.alias || "Ẩn danh")}</strong><small>${safe(member.role)}</small></span></p>`).join("")}</article><article class="dharma-paper-card"><small>LỜI MỜI THỦ CÔNG</small><p>Mỗi lần sao chép sẽ tạo mã từ trạng thái chia sẻ hiện tại. Đây không phải liên kết máy chủ.</p><button type="button" data-copy-circle-invite="${safe(circle.id)}">Sao chép mã lời mời</button></article><article class="dharma-paper-card dharma-circle-safety"><small>AN TOÀN CỘNG ĐỒNG</small><p>Báo nội dung gây sợ hãi, mê tín, giả danh người tu hoặc lợi dụng tài chính.</p><button type="button" data-report-circle="${safe(circle.id)}">Mở biểu mẫu báo cáo</button><button type="button" data-delete-circle="${safe(circle.id)}">Rời / xóa nhóm cục bộ</button></article></aside></section>`;
  }

  function accessibilityMarkup() {
    const access = state.accessibility;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>TRỢ NĂNG & CHẾ ĐỘ ĐỌC</small><h2>Đọc rõ, thao tác chắc và không mất chức năng</h2><p>Mọi lựa chọn lưu trên thiết bị. Chế độ tương phản cao, chữ 18–24px và giao diện người lớn tuổi áp dụng ngay cho toàn Trung tâm Phật Pháp.</p></div><span class="dharma-seal">輔</span></section><section class="dharma-accessibility-grid"><article class="dharma-paper-card"><header><span>字</span><div><small>CỠ CHỮ NỘI DUNG</small><h2>${Number(access.readerSize)}px</h2></div></header><input type="range" data-access-reader-size min="18" max="24" step="1" value="${Number(access.readerSize)}" aria-label="Cỡ chữ nội dung"><p style="font-size:${Number(access.readerSize)}px">Phật pháp được học bằng sự hiểu biết, thực hành và kiểm chứng trong đời sống.</p></article><article class="dharma-paper-card"><header><span>◐</span><div><small>ĐỘ TƯƠNG PHẢN</small><h2>${access.contrast === "high" ? "Cao" : "Trang nhã"}</h2></div></header><button type="button" data-access-contrast aria-pressed="${access.contrast === "high"}">${access.contrast === "high" ? "Chuyển về trang nhã" : "Bật tương phản cao"}</button><label class="dharma-check"><input type="checkbox" data-access-senior ${access.senior ? "checked" : ""}><span>Chế độ người lớn tuổi: vùng bấm lớn, chữ rõ</span></label></article><article class="dharma-paper-card"><header><span>聽</span><div><small>MÔ TẢ BẰNG ÂM THANH</small><h2>Hướng dẫn giao diện</h2></div></header><p>Giọng tổng hợp của trình duyệt đọc tên màn hình, vùng cuộn và các phím tắt; không giả giọng tăng ni.</p><button type="button" data-access-audio-description>▷ Nghe mô tả màn hình này</button></article><article class="dharma-paper-card"><header><span>⌨</span><div><small>BÀN PHÍM</small><h2>Điều hướng đầy đủ</h2></div></header><dl class="dharma-shortcuts"><div><dt>Ctrl/⌘ + K</dt><dd>Tìm toàn bộ trung tâm</dd></div><div><dt>Tab / Shift+Tab</dt><dd>Đi tới nút kế tiếp / trước</dd></div><div><dt>Enter / Space</dt><dd>Mở chức năng đang chọn</dd></div><div><dt>Escape</dt><dd>Đóng lớp đọc, hộp thoại hoặc kết quả tìm</dd></div></dl><button type="button" data-access-focus-workspace>Đưa tiêu điểm tới nội dung</button></article></section><aside class="dharma-accessibility-note"><strong>Hỗ trợ phóng to 200%</strong><p>Bố cục sẽ chuyển thành một cột hoặc bottom navigation, không che nội dung. Timer và chuông có nhãn đọc màn hình; các hiệu ứng dừng theo prefers-reduced-motion.</p></aside>`;
  }

  function requestMarkup() {
    const saved = state.savedSources;
    return `<section class="dharma-route-intro dharma-paper-card"><div><small>THỈNH KINH CÓ TRÁCH NHIỆM</small><h2>Ưu tiên bản số hợp pháp và nguồn rõ ràng</h2><p>HH không thu tiền, địa chỉ hay tạo đơn hàng giả. Bản in hiện chỉ lưu nguyện vọng trên thiết bị cho tới khi có nhà phát hành được xác minh.</p></div><span class="dharma-seal">請</span></section><div class="dharma-request-tabs" role="tablist"><button type="button" data-request-tab="digital" aria-selected="true">Bản số</button><button type="button" data-request-tab="print">Bản in</button></div><section data-request-panel="digital" class="dharma-digital-sources">${SOURCES.map((source) => `<article><span>${source.id === "suttacentral" ? "經" : "☸"}</span><div><small>${safe(source.status)}</small><h3>${safe(source.title)}</h3><p>${safe(source.note)}</p></div><footer><button type="button" data-save-source="${source.id}">${saved.includes(source.id) ? "★ Đã lưu" : "☆ Lưu nguồn"}</button><a href="${safe(source.url)}" target="_blank" rel="noopener noreferrer">Mở thư viện ↗</a></footer></article>`).join("")}</section><section data-request-panel="print" class="dharma-print-request dharma-paper-card" hidden><header><small>BẢN IN · CHƯA KẾT NỐI NHÀ PHÁT HÀNH</small><h2>Lưu nguyện vọng thỉnh kinh</h2><p>Biểu mẫu này không phải đơn hàng, không thu địa chỉ và không thực hiện thanh toán.</p></header><form data-print-request><label>Tên kinh hoặc chủ đề<input name="title" required maxlength="160" placeholder="Ví dụ: Kinh Từ Bi"></label><label>Mục đích sử dụng<select name="purpose"><option>Đọc và tu học cá nhân</option><option>Tặng người thân</option><option>Đạo tràng hoặc thư viện</option></select></label><button class="dharma-primary" type="submit">Lưu nguyện vọng trên thiết bị</button></form><div>${state.printRequests.map((item) => `<p><span><strong>${safe(item.title)}</strong><small>${safe(item.purpose)} · ${safe(formatDate(item.createdAt))}</small></span><button type="button" data-delete-print="${safe(item.id)}">Xóa</button></p>`).join("") || '<p class="dharma-empty-line">Chưa có nguyện vọng đã lưu.</p>'}</div></section>`;
  }

  function qnaMarkup() {
    return `<section class="dharma-qna dharma-paper-card"><header><span>問</span><div><small>TRỢ LÝ HỌC PHÁP CÓ GIỚI HẠN</small><h2>Tra cứu trước, suy ngẫm sau</h2><p>Kết quả được tìm trong thư viện nội bộ đã biên soạn; không gọi AI bên ngoài khi bạn chỉ điều hướng và không tự tạo “lời Phật dạy”.</p></div></header><form data-qna-form><label><textarea name="question" required maxlength="500" placeholder="Ví dụ: Tứ Diệu Đế có phải là cách nhìn bi quan không?"></textarea><button class="dharma-primary" type="submit">Tìm trong giáo lý</button></label></form><div data-qna-answer><p class="dharma-empty-line">Nhập câu hỏi để tìm chủ đề phù hợp trong giáo lý và tóm lược kinh.</p></div></section><section class="dharma-ai-boundaries"><article><header><span>✓</span><h3>HH được phép hỗ trợ</h3></header><ul><li>Giải thích thuật ngữ bằng tiếng Việt dễ hiểu.</li><li>Gợi ý bài đã duyệt và tạo câu hỏi tự kiểm tra.</li><li>Tóm tắt ghi chú cá nhân ngay trên thiết bị.</li><li>Phát hiện metadata hoặc trích dẫn đang thiếu nguồn.</li></ul></article><article><header><span>×</span><h3>HH tuyệt đối không làm</h3></header><ul><li>Giả danh tăng ni hoặc đưa phán quyết tâm linh.</li><li>Phán nghiệp, hứa chữa bệnh hay đổi số phận.</li><li>Tự tạo lời Phật dạy hoặc bịa mã kinh, dịch giả.</li><li>Trộn các truyền thống thành một kết luận duy nhất.</li></ul></article></section><section class="dharma-safety-grid"><article><span>✓</span><h3>Luôn dẫn nguồn</h3><p>Cho biết đây là tóm lược HH và mở được tài liệu tham khảo.</p></article><article><span>!</span><h3>Biết giới hạn</h3><p>Không thay thế tăng ni đủ phẩm hạnh, bác sĩ, chuyên gia tâm lý hoặc tư vấn pháp lý.</p></article><article><span>⌾</span><h3>Không phán nghiệp</h3><p>Không dùng giáo lý để đổ lỗi, gieo sợ hãi hoặc hứa hẹn kết quả siêu nhiên.</p></article></section><section class="dharma-teacher-referral dharma-paper-card"><header><div><small>HỎI NGƯỜI HƯỚNG DẪN</small><h2>HH không mô phỏng một vị thầy</h2></div><span>☸</span></header><p>Khi câu hỏi liên quan nghi lễ, giới luật, pháp môn chuyên biệt hoặc khó khăn trong thực hành, hãy liên hệ cơ sở Phật giáo chính thức và tự kiểm tra danh tính người hướng dẫn.</p><div><a href="https://ghpgvn.vn/" target="_blank" rel="noopener noreferrer"><strong>Giáo hội Phật giáo Việt Nam</strong><small>Tra cứu tổ chức và thông tin liên hệ chính thức ↗</small></a><a href="https://www.phatsuonline.vn/" target="_blank" rel="noopener noreferrer"><strong>Phật Sự Online</strong><small>Theo dõi lịch, pháp sự và kênh công khai ↗</small></a></div></section>`;
  }

  function journalMarkup() {
    const cryptoReady = Boolean(global.crypto?.subtle);
    if (!cryptoReady) return `<section class="dharma-journal-lock dharma-paper-card"><span>鎖</span><h2>Trình duyệt chưa hỗ trợ khóa an toàn</h2><p>HH không cho phép viết nhật ký ở chế độ không mã hóa. Hãy dùng trình duyệt hiện đại có Web Crypto.</p></section>`;
    const meta = readJournalMeta();
    if (!meta) return `<section class="dharma-journal-lock dharma-paper-card"><span>記</span><small>NHẬT KÝ TU HỌC RIÊNG TƯ</small><h2>Tạo PIN để bắt đầu</h2><p>Nội dung được mã hóa AES-GCM trên thiết bị. PIN không được lưu và không thể khôi phục nếu bạn quên.</p><form data-journal-setup><label>PIN mới<input name="pin" type="password" inputmode="numeric" minlength="6" maxlength="32" required autocomplete="new-password" placeholder="Tối thiểu 6 ký tự"></label><label>Nhập lại PIN<input name="confirm" type="password" inputmode="numeric" minlength="6" maxlength="32" required autocomplete="new-password"></label><button class="dharma-primary" type="submit">Tạo nhật ký mã hóa</button></form><aside>Không dùng ngày sinh, số điện thoại hoặc mật khẩu tài khoản làm PIN.</aside></section>`;
    if (!journalKey || !Array.isArray(journalEntries)) return `<section class="dharma-journal-lock dharma-paper-card"><span>鎖</span><small>AES-GCM · PBKDF2</small><h2>Nhật ký đang khóa</h2><p>Nhập PIN của nhật ký. Dữ liệu chỉ được giải mã trong phiên hiện tại và khóa lại khi rời mục Phật Pháp.</p><form data-journal-unlock><label>PIN nhật ký<input name="pin" type="password" minlength="6" maxlength="32" required autocomplete="current-password"></label><button class="dharma-primary" type="submit">Mở khóa</button></form><button class="dharma-danger-link" type="button" data-journal-reset>Xóa vĩnh viễn nhật ký đã mã hóa</button></section>`;
    return `<section class="dharma-journal-editor"><article class="dharma-paper-card"><header><div><small>KHÔNG GIAN SUY NGẪM</small><h2>Ghi điều đã học và đã thực hành</h2></div><div><button type="button" data-export-journal ${journalEntries.length ? "" : "disabled"}>Xuất Markdown</button><button type="button" data-journal-lock>Khóa ngay</button></div></header><form data-journal-entry><label>Tiêu đề<input name="title" maxlength="120" required placeholder="Điều tôi nhận ra hôm nay"></label><label>Nội dung<textarea name="body" maxlength="8000" required placeholder="Viết thành thật, không cần hoàn hảo…"></textarea></label><label>Tâm trạng<select name="mood"><option>Bình an</option><option>Biết ơn</option><option>Đang quan sát</option><option>Còn nhiều băn khoăn</option><option>Cần nghỉ ngơi</option></select></label><button class="dharma-primary" type="submit">Mã hóa và lưu</button></form></article><section>${journalEntries.slice().reverse().map((entry) => `<article class="dharma-paper-card"><header><div><small>${safe(entry.mood)} · ${safe(formatDate(entry.createdAt))}</small><h3>${safe(entry.title)}</h3></div><button type="button" data-delete-journal="${safe(entry.id)}">Xóa</button></header><p>${safe(entry.body).replace(/\n/g, "<br>")}</p></article>`).join("") || '<div class="dharma-empty"><span>記</span><strong>Chưa có ghi chép</strong><p>Nhật ký đầu tiên sẽ được mã hóa ngay khi lưu.</p></div>'}</section></section>`;
  }

  function viewMarkup() {
    if (activeView === "beginner") return beginnerMarkup();
    if (activeView === "situations") return situationsMarkup();
    if (activeView === "teachings") return teachingsMarkup();
    if (activeView === "scriptures") return scripturesMarkup();
    if (activeView === "glossary") return glossaryMarkup();
    if (activeView === "map") return mapMarkup();
    if (activeView === "provenance") return provenanceMarkup();
    if (activeView === "review") return reviewMarkup();
    if (activeView === "practice") return practiceMarkup();
    if (activeView === "chanting") return chantingMarkup();
    if (activeView === "audio") return audioMarkup();
    if (activeView === "schedule") return scheduleMarkup();
    if (activeView === "temple") return templeMarkup();
    if (activeView === "talks") return talksMarkup();
    if (activeView === "request") return requestMarkup();
    if (activeView === "circles") return circlesMarkup();
    if (activeView === "qna") return qnaMarkup();
    if (activeView === "journal") return journalMarkup();
    if (activeView === "accessibility") return accessibilityMarkup();
    if (activeView === "data-control") return dataControlMarkup();
    return todayMarkup();
  }

  function renderView(options = {}) {
    if (!root) return;
    const hub = root.querySelector("[data-dharma-hub]");
    if (!hub) return;
    hub.dataset.view = activeView;
    hub.dataset.contrast = state.accessibility.contrast;
    hub.dataset.senior = String(Boolean(state.accessibility.senior));
    hub.style.setProperty("--dharma-reader-size", `${Math.max(18, Math.min(24, Number(state.accessibility.readerSize) || 20))}px`);
    const current = NAV.find((item) => item.id === activeView) || NAV[0];
    openNavGroup = current.group;
    root.querySelectorAll("[data-dharma-nav-group]").forEach((section) => {
      const open = section.dataset.dharmaNavGroup === openNavGroup;
      section.classList.toggle("is-open", open);
      section.querySelector("[data-toggle-nav-group]")?.setAttribute("aria-expanded", String(open));
      const arrow = section.querySelector(".dharma-nav-group > b");
      if (arrow) arrow.textContent = open ? "⌄" : "›";
      const items = section.querySelector(".dharma-nav-items");
      if (items) items.hidden = !open;
    });
    root.querySelectorAll("[data-dharma-nav]").forEach((button) => {
      const active = button.dataset.dharmaNav === activeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    const head = root.querySelector(".dharma-workspace__head");
    if (head) head.querySelector("div").innerHTML = `<small>${safe(current.group)}</small><h1>${safe(current.label)}</h1>`;
    const content = root.querySelector("[data-dharma-content]");
    if (content) content.innerHTML = viewMarkup();
    const primary = root.querySelector("[data-dharma-primary]");
    if (primary) {
      const groundingNeeded = activeView === "practice" && state.meditation.checkIn === "overwhelmed" && !timerRunning;
      primary.innerHTML = groundingNeeded ? "Mở hướng dẫn ổn định →" : activeView === "practice" ? `${timerRunning ? "Tạm dừng" : "Bắt đầu thiền"} →` : activeView === "scriptures" ? "Tiếp tục đọc →" : activeView === "chanting" ? "Bắt đầu tụng đọc →" : activeView === "audio" ? `${audioStudyPlaying ? "Tạm dừng" : "Bắt đầu nghe"} →` : activeView === "review" ? "Ôn nội dung tiếp theo →" : activeView === "data-control" ? "Sao lưu dữ liệu →" : "Tiếp tục hành trình →";
      primary.toggleAttribute("data-grounding", groundingNeeded);
    }
    updateProgressPanel();
    const panelOpen = !hub.classList.contains("is-progress-closed");
    root.querySelector("[data-dharma-progress-panel]")?.setAttribute("aria-hidden", String(!panelOpen));
    root.querySelectorAll("[data-dharma-toggle-progress]").forEach((button) => button.setAttribute("aria-expanded", String(panelOpen)));
    if (!options.preserveScroll) {
      const workspace = root.querySelector(".dharma-workspace");
      if (workspace) workspace.scrollTop = 0;
    }
  }

  function formatTimer(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function updateTimerDisplay() {
    if (!root) return;
    const display = root.querySelector("[data-timer-display]");
    if (display) display.textContent = formatTimer(timerRemaining);
    const status = root.querySelector(".dharma-timer small");
    if (status) status.textContent = timerRunning ? "Đang thực hành" : (timerRemaining === 0 ? "Đã hoàn thành" : "Sẵn sàng");
    const button = root.querySelector("[data-timer-toggle]");
    if (button) button.textContent = timerRunning ? "Tạm dừng" : "Bắt đầu";
  }

  function playBell() {
    const hub = root?.querySelector("[data-dharma-hub]");
    hub?.classList.add("is-bell-ringing");
    global.setTimeout(() => hub?.classList.remove("is-bell-ringing"), 900);
    try {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(330, context.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.8);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 1.85);
      oscillator.addEventListener("ended", () => context.close());
    } catch {}
  }

  function stopTimer() {
    global.clearInterval(timerId);
    timerId = 0;
    timerRunning = false;
    if (state?.meditation?.locked) { state.meditation = { ...state.meditation, locked: false }; saveState(); }
    root?.querySelector("[data-dharma-hub]")?.classList.remove("is-practicing");
    updateTimerDisplay();
  }

  function toggleTimer() {
    if (timerRunning) return stopTimer();
    if (state.meditation.checkIn === "overwhelmed") { groundingDialog(); toast("Timer đang tạm dừng để ưu tiên ổn định.", "warning"); return; }
    if (timerRemaining <= 0) timerRemaining = timerInitial;
    timerRunning = true;
    if (!state.meditation.silent) playBell();
    root?.querySelector("[data-dharma-hub]")?.classList.add("is-practicing");
    updateTimerDisplay();
    timerId = global.setInterval(() => {
      timerRemaining -= 1;
      updateTimerDisplay();
      const elapsed = timerInitial - timerRemaining;
      const intervalSeconds = Number(state.meditation.bellInterval || 0) * 60;
      if (!state.meditation.silent && intervalSeconds > 0 && elapsed > 0 && timerRemaining > 0 && elapsed % intervalSeconds === 0) playBell();
      if (timerRemaining > 0) return;
      stopTimer();
      if (!state.meditation.silent) playBell();
      const minutes = Math.max(1, Math.round(timerInitial / 60));
      const practiceLabels = { breath: "Hơi thở", body: "Quán thân", feeling: "Cảm thọ", kindness: "Tâm từ", walking: "Thiền đi bộ" };
      state.practiceHistory = [...state.practiceHistory, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, minutes, type: practiceLabels[state.meditation.type] || "Hơi thở", at: new Date().toISOString() }].slice(-100);
      if (state.meditation.activeCourseDay) state.meditation = { ...state.meditation, courseDays: unique([...state.meditation.courseDays, Number(state.meditation.activeCourseDay)]), activeCourseDay: 0, locked: false };
      saveState();
      toast(`Đã lưu ${minutes} phút thực hành.`, "success");
      renderView({ preserveScroll: true });
    }, 1000);
  }

  function searchAll(query) {
    const term = normalize(query);
    if (!term) return [];
    const lessonMatches = LESSONS.filter((item) => normalize(`${item.title} ${item.summary}`).includes(term)).map((item) => ({ type: "Bài học", title: item.title, detail: item.tradition, action: "lesson", id: item.id }));
    const teachingMatches = TEACHINGS.filter((item) => normalize(`${item.title} ${item.intro} ${item.application}`).includes(term)).map((item) => ({ type: "Giáo lý", title: item.title, detail: item.tradition, action: "teaching", id: item.id }));
    const scriptureMatches = SCRIPTURES.filter((item) => normalize(`${item.title} ${item.summary} ${item.keywords}`).includes(term)).map((item) => ({ type: "Kinh điển", title: item.title, detail: item.collection, action: "scripture", id: item.id }));
    const glossaryMatches = GLOSSARY.filter((item) => normalize(`${item.pali} ${item.sanskrit} ${item.han} ${item.hanViet} ${item.vietnamese}`).includes(term)).map((item) => ({ type: "Thuật ngữ", title: item.hanViet, detail: `${item.pali} · ${item.han}`, action: "glossary", id: item.id }));
    const journeyMatches = LIFE_JOURNEYS.filter((item) => normalize(`${item.title} ${item.recognize} ${item.practice}`).includes(term)).map((item) => ({ type: "Đời sống", title: item.title, detail: "Hành trình thực hành", action: "situation", id: item.id }));
    return [...lessonMatches, ...teachingMatches, ...scriptureMatches, ...glossaryMatches, ...journeyMatches].slice(0, 10);
  }

  function showSearchResults(input) {
    root.querySelector("[data-dharma-search-results]")?.remove();
    if (!input.value.trim()) return;
    const results = searchAll(input.value);
    const panel = document.createElement("div");
    panel.className = "dharma-search-results";
    panel.dataset.dharmaSearchResults = "";
    panel.innerHTML = results.length ? results.map((item) => `<button type="button" data-search-action="${item.action}" data-search-id="${item.id}"><small>${item.type}</small><strong>${safe(item.title)}</strong><span>${safe(item.detail)}</span></button>`).join("") : '<p>Không tìm thấy nội dung phù hợp.</p>';
    input.closest(".dharma-search")?.append(panel);
  }

  function scheduleDialog() {
    root.querySelector("[data-dharma-dialog]")?.remove();
    const dialog = document.createElement("div");
    dialog.className = "dharma-dialog";
    dialog.dataset.dharmaDialog = "";
    dialog.innerHTML = `<button type="button" data-dialog-close aria-label="Đóng"></button><form data-schedule-form><header><span>灯</span><div><small>THỜI KHÓA CÁ NHÂN</small><h2>Một lịch vừa sức</h2></div><button type="button" data-dialog-close>×</button></header><label>Thời lượng mỗi ngày<select name="minutes">${[10,15,20,30].map((item) => `<option value="${item}" ${state.studySchedule.minutes === item ? "selected" : ""}>${item} phút</option>`).join("")}</select></label><label>Khung giờ gợi nhớ<input type="time" name="time" value="${safe(state.studySchedule.time)}"></label><label>Chương trình<select name="program">${[7,21,49].map((item) => `<option value="${item}" ${state.studySchedule.program === item ? "selected" : ""}>${item} ngày</option>`).join("")}</select></label><p>HH chỉ lưu lịch trên thiết bị; chưa tự gửi thông báo nếu bạn chưa cấp quyền cho PWA.</p><button class="dharma-primary" type="submit">Lưu thời khóa</button></form>`;
    root.append(dialog);
  }

  function groundingDialog() {
    stopTimer(); stopChant();
    root.querySelector("[data-dharma-dialog]")?.remove();
    const dialog = document.createElement("div"); dialog.className = "dharma-dialog dharma-grounding-dialog"; dialog.dataset.dharmaDialog = "";
    dialog.innerHTML = `<button type="button" data-dialog-close aria-label="Đóng"></button><section><header><span>安</span><div><small>DỪNG VÀ ỔN ĐỊNH LẠI</small><h2>Không cần tiếp tục buổi thiền</h2></div><button type="button" data-dialog-close>×</button></header><ol><li>Mở mắt và nhìn ba vật ở xung quanh.</li><li>Cảm nhận bàn chân hoặc điểm thân đang chạm ghế.</li><li>Để hơi thở diễn ra tự nhiên, không cố hít sâu.</li><li>Uống nước hoặc gọi một người bạn tin cậy nếu cần.</li></ol><p>Nếu có khó thở, đau ngực, mất định hướng, ý nghĩ tự hại hoặc nguy hiểm, hãy liên hệ dịch vụ khẩn cấp và chuyên gia tại nơi bạn sống.</p><button class="dharma-primary" type="button" data-dialog-close>Đã ổn định · trở lại</button></section>`;
    root.append(dialog);
  }

  function sourceReportDialog(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id);
    if (!item) return;
    root.querySelector("[data-dharma-dialog]")?.remove();
    const dialog = document.createElement("div");
    dialog.className = "dharma-dialog";
    dialog.dataset.dharmaDialog = "";
    dialog.innerHTML = `<button type="button" data-dialog-close aria-label="Đóng"></button><form data-source-report><input type="hidden" name="scripture" value="${safe(item.id)}"><header><span>!</span><div><small>PHẢN HỒI NGUỒN</small><h2>${safe(item.title)}</h2></div><button type="button" data-dialog-close>×</button></header><label>Vấn đề<select name="type"><option>Liên kết không hoạt động</option><option>Sai mã tham chiếu</option><option>Metadata chưa chính xác</option><option>Giấy phép chưa rõ</option><option>Nội dung HH cần xem lại</option></select></label><label>Mô tả<textarea name="detail" required maxlength="1000" placeholder="Cho biết vị trí và nội dung cần kiểm tra…"></textarea></label><p>Phản hồi được lưu cục bộ trong hàng chờ biên tập; không tự gửi dữ liệu cá nhân ra ngoài.</p><button class="dharma-primary" type="submit">Lưu vào hàng chờ</button></form>`;
    root.append(dialog);
  }

  function safetyReportDialog(kind, id, title) {
    root.querySelector("[data-dharma-dialog]")?.remove();
    const dialog = document.createElement("div");
    dialog.className = "dharma-dialog";
    dialog.dataset.dharmaDialog = "";
    dialog.innerHTML = `<button type="button" data-dialog-close aria-label="Đóng"></button><form data-safety-report><input type="hidden" name="kind" value="${safe(kind)}"><input type="hidden" name="target" value="${safe(id)}"><header><span>!</span><div><small>PHẢN HỒI AN TOÀN</small><h2>${safe(title)}</h2></div><button type="button" data-dialog-close>×</button></header><label>Vấn đề<select name="type">${kind === "temple" ? "<option>Liên kết hoặc website giả mạo</option><option>Thông tin liên hệ sai</option><option>Kêu gọi chuyển tiền chưa kiểm chứng</option>" : "<option>Nội dung gây sợ hãi hoặc mê tín</option><option>Giả danh tăng ni hoặc người hướng dẫn</option><option>Lợi dụng tài chính</option><option>Xâm phạm riêng tư</option>"}</select></label><label>Mô tả<textarea name="detail" required maxlength="1000" placeholder="Không nhập mật khẩu, số tài khoản hoặc dữ liệu nhạy cảm…"></textarea></label><p>Phản hồi lưu cục bộ trong hàng chờ để quản trị viên kiểm tra; chưa tự gửi ra máy chủ.</p><button class="dharma-primary" type="submit">Lưu phản hồi an toàn</button></form>`;
    root.append(dialog);
  }

  function localDateTimeValue(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function applyCalendarTemplate(template) {
    const settings = {
      morning: { hour: 6, minute: 30, type: "Thiền", title: "Thực hành buổi sáng" },
      evening: { hour: 20, minute: 0, type: "Học Pháp", title: "Học Pháp buổi tối" },
      reading: { hour: 20, minute: 15, type: "Đọc kinh", title: "Đọc theo đường đọc" },
      balanced: { hour: 19, minute: 30, type: "Học và thiền", title: "Thời khóa cân bằng" }
    };
    const preset = settings[template] || settings.balanced;
    const generated = Array.from({ length: 7 }, (_, index) => {
      const at = new Date(); at.setDate(at.getDate() + index); at.setHours(preset.hour, preset.minute, 0, 0);
      const key = localDateTimeValue(at).slice(0, 10);
      return { id: `template:${template}:${key}`, title: preset.title, at: localDateTimeValue(at), type: preset.type, completed: false, template: true };
    });
    state.events = [...state.events.filter((item) => !item.template), ...generated].sort((a, b) => a.at.localeCompare(b.at));
    state.calendar = { ...state.calendar, template };
    saveState();
  }

  function escapeIcs(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  function icsTimestamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function exportCalendarIcs() {
    if (!state.events.length) return toast("Lịch chưa có hoạt động để xuất.", "warning");
    const now = icsTimestamp(new Date());
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HH Platform//Dharma Study Schedule//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...state.events.flatMap((item) => {
      const start = new Date(item.at); const end = new Date(start.getTime() + Math.max(5, Number(state.studySchedule.minutes) || 15) * 60000);
      return ["BEGIN:VEVENT", `UID:${escapeIcs(item.id)}@hh-platform.local`, `DTSTAMP:${now}`, `DTSTART:${icsTimestamp(start)}`, `DTEND:${icsTimestamp(end)}`, `SUMMARY:${escapeIcs(item.title)}`, `DESCRIPTION:${escapeIcs(`${item.type || "Tu học"} · Lịch cá nhân từ HH Phật Pháp`)}`, "END:VEVENT"];
    }), "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `thoi-khoa-phat-phap-${todayKey()}.ics`; link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Đã tạo lịch .ics trên thiết bị.");
  }

  function speakGlossary(id) {
    const item = GLOSSARY.find((entry) => entry.id === id);
    if (!item || !("speechSynthesis" in global)) return toast("Trình duyệt chưa hỗ trợ đọc văn bản.", "warning");
    global.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${item.pali}. ${item.hanViet}. ${item.vietnamese}`);
    utterance.lang = "vi-VN"; utterance.rate = 0.72;
    global.speechSynthesis.speak(utterance);
    toast("Đang phát cách đọc tham khảo bằng giọng tổng hợp.");
  }

  function speakAccessibilityDescription() {
    if (!("speechSynthesis" in global)) return toast("Trình duyệt chưa hỗ trợ mô tả âm thanh.", "warning");
    const current = NAV.find((item) => item.id === activeView) || NAV[0];
    global.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Bạn đang ở mục ${current.label}, thuộc nhóm ${current.group}. Thanh trên cùng có tìm kiếm và trợ năng. Danh mục ở bên trái. Chỉ vùng nội dung chính ở giữa cuộn. Nhấn Control K để tìm, Tab để chuyển nút và Escape để đóng hộp thoại.`);
    utterance.lang = "vi-VN"; utterance.rate = 0.86;
    global.speechSynthesis.speak(utterance);
  }

  function stopChant() {
    global.clearInterval(chantTimerId);
    chantTimerId = 0;
    chantLineIndex = -1;
    chantStopAt = 0;
    global.speechSynthesis?.cancel?.();
    root?.querySelector("[data-dharma-hub]")?.classList.remove("is-practicing");
  }

  function speakChantLine() {
    const chant = CHANTS.find((item) => item.id === state.chant.selected) || CHANTS[0];
    if (chantStopAt && Date.now() >= chantStopAt) { stopChant(); renderView({ preserveScroll: true }); toast("Đã dừng theo hẹn giờ."); return; }
    if (chantLineIndex >= chant.lines.length) {
      if (state.chant.repeat) chantLineIndex = 0;
      else { stopChant(); renderView({ preserveScroll: true }); toast("Đã hoàn thành lượt tụng đọc."); return; }
    }
    root?.querySelectorAll("[data-chant-lines] li").forEach((line, index) => line.classList.toggle("is-speaking", index === chantLineIndex));
    if ("speechSynthesis" in global) {
      global.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(chant.lines[chantLineIndex].text);
      utterance.lang = "vi-VN";
      utterance.rate = state.chant.pace === "slow" ? 0.68 : 0.88;
      global.speechSynthesis.speak(utterance);
    }
    chantLineIndex += 1;
  }

  function toggleChant() {
    if (chantTimerId) { stopChant(); renderView({ preserveScroll: true }); return; }
    chantLineIndex = chantSelectedLine >= 0 ? chantSelectedLine : 0;
    chantStopAt = state.chant.sleepMinutes ? Date.now() + Number(state.chant.sleepMinutes) * 60000 : 0;
    root?.querySelector("[data-dharma-hub]")?.classList.add("is-practicing");
    speakChantLine();
    chantTimerId = global.setInterval(speakChantLine, state.chant.pace === "slow" ? 6500 : 4700);
    const button = root?.querySelector("[data-chant-play]");
    if (button) button.textContent = "Tạm dừng";
    const primary = root?.querySelector("[data-dharma-primary]");
    if (primary) primary.textContent = "Tạm dừng tụng đọc →";
  }

  function readerMode(item) {
    root.querySelector("[data-dharma-reader]")?.remove();
    const source = sourceById(item.sourceId);
    const reader = document.createElement("div");
    reader.className = "dharma-reader-mode";
    reader.dataset.dharmaReader = "";
    reader.innerHTML = `<header><button type="button" data-reader-close>← Thoát chế độ đọc</button><span>Tóm lược học tập · ${safe(source.organization)}</span><button type="button" data-speak-scripture="${item.id}">▷ Nghe</button></header><main><small>${safe(item.collection)} · ${safe(item.tradition)}</small><h1>${safe(item.title)}</h1><p>${safe(item.summary)}</p><aside>Phần này là tóm lược nguyên bản của HH, không phải bản dịch kinh văn.</aside><a href="${safe(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Mở tài liệu nguồn ↗</a></main>`;
    root.append(reader);
  }

  function speakScripture(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id);
    if (!item || !("speechSynthesis" in global)) return toast("Trình duyệt chưa hỗ trợ đọc văn bản.", "warning");
    global.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.summary);
    utterance.lang = "vi-VN";
    utterance.rate = 0.88;
    global.speechSynthesis.speak(utterance);
    toast("Đang đọc tóm lược HH, không phải nguyên văn kinh.", "success");
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function readJournalMeta() {
    try { return JSON.parse(localStorage.getItem(journalStorageKey()) || "null"); } catch { return null; }
  }

  async function deriveJournalKey(pin, salt) {
    const material = await global.crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return global.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: JOURNAL_ITERATIONS, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encryptJournal(entries, key, salt) {
    const iv = global.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(entries));
    const cipher = new Uint8Array(await global.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    localStorage.setItem(journalStorageKey(), JSON.stringify({ version: 1, algorithm: "AES-GCM", kdf: "PBKDF2-SHA256", iterations: JOURNAL_ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv), cipher: bytesToBase64(cipher) }));
  }

  async function setupJournal(pin) {
    const salt = global.crypto.getRandomValues(new Uint8Array(16));
    journalKey = await deriveJournalKey(pin, salt);
    journalEntries = [];
    await encryptJournal(journalEntries, journalKey, salt);
  }

  async function unlockJournal(pin) {
    const meta = readJournalMeta();
    if (!meta) throw new Error("Không tìm thấy nhật ký.");
    const salt = base64ToBytes(meta.salt);
    const key = await deriveJournalKey(pin, salt);
    const plain = await global.crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(meta.iv) }, key, base64ToBytes(meta.cipher));
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(parsed)) throw new Error("Dữ liệu nhật ký không hợp lệ.");
    journalKey = key;
    journalEntries = parsed;
  }

  async function persistJournal() {
    const meta = readJournalMeta();
    if (!meta || !journalKey || !journalEntries) throw new Error("Nhật ký đang khóa.");
    await encryptJournal(journalEntries, journalKey, base64ToBytes(meta.salt));
  }

  function lockJournal() {
    journalKey = null;
    journalEntries = null;
    if (activeView === "journal") renderView({ preserveScroll: true });
  }

  function exportJournalMarkdown() {
    if (!journalKey || !Array.isArray(journalEntries) || !journalEntries.length) return toast("Nhật ký đang khóa hoặc chưa có ghi chép.", "warning");
    const markdown = ["# Nhật ký tu học Phật Pháp", "", "> Bản xuất riêng tư do người dùng chủ động tạo. Nội dung dưới đây là ghi chép cá nhân.", "", ...journalEntries.slice().reverse().flatMap((entry) => [`## ${entry.title}`, "", `- Thời gian: ${formatDate(entry.createdAt)}`, `- Tâm trạng: ${entry.mood}`, "", entry.body, "", "---", ""])].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `nhat-ky-tu-hoc-${todayKey()}.md`; link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Đã tạo bản Markdown trên thiết bị.");
  }

  function scriptureNotesMarkdown(item) {
    const segments = SCRIPTURE_SEGMENTS[item.id] || [];
    return [`# Ghi chú · ${item.title}`, "", `- Mã: ${item.code}`, `- Nguồn: ${sourceById(item.sourceId).organization}`, `- Loại nội dung: Ghi chú cá nhân và tóm lược HH, không phải bản dịch`, "", "## Ghi chú toàn bài", "", state.scriptureNotes[item.id] || "_Chưa có ghi chú._", "", ...segments.flatMap((segment) => [`## ${segment.reference} · ${segment.label}`, "", `> HH tóm lược: ${segment.summary}`, "", state.scriptureSegmentNotes[segment.id] || "_Chưa có ghi chú._", ""])].join("\n");
  }

  function exportScriptureNotes(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id);
    if (!item) return;
    const url = URL.createObjectURL(new Blob([scriptureNotesMarkdown(item)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `ghi-chu-${item.id}-${todayKey()}.md`; link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Đã tạo bản ghi chú Markdown.");
  }

  function printScriptureNotes(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id);
    if (!item) return;
    const popup = global.open("", "_blank", "noopener,noreferrer,width=900,height=760");
    if (!popup) return toast("Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup rồi thử lại.", "warning");
    const segments = SCRIPTURE_SEGMENTS[item.id] || [];
    popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ghi chú · ${safe(item.title)}</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;color:#2b1d12;font:16px/1.7 Georgia,serif}h1,h2{color:#713719}small{color:#806a4d}article{padding:16px 0;border-top:1px solid #d7bd8a}blockquote{margin:10px 0;padding:10px 14px;border-left:3px solid #c18a31;background:#fff7e5}pre{white-space:pre-wrap;font:inherit}@media print{button{display:none}}</style></head><body><h1>${safe(item.title)}</h1><small>${safe(item.code)} · Ghi chú cá nhân · không phải bản dịch</small><h2>Ghi chú toàn bài</h2><pre>${safe(state.scriptureNotes[item.id] || "Chưa có ghi chú.")}</pre>${segments.map((segment) => `<article><h2>${safe(segment.reference)} · ${safe(segment.label)}</h2><blockquote>${safe(segment.summary)}</blockquote><pre>${safe(state.scriptureSegmentNotes[segment.id] || "Chưa có ghi chú.")}</pre></article>`).join("")}<button onclick="window.print()">In hoặc lưu PDF</button></body></html>`);
    popup.document.close();
    popup.focus();
  }

  function citationText(item, style = "academic") {
    const source = sourceById(item.sourceId);
    if (style === "bibtex") {
      const key = `HH${item.id.replace(/[^a-z0-9]/gi, "")}${new Date().getFullYear()}`;
      return `@misc{${key},\n  title = {${item.canonicalTitle || item.title}},\n  note = {${item.title}; ${item.code}; ${item.collection}; metadata accessed via ${source.organization}},\n  howpublished = {\\url{${item.sourceUrl}}},\n  year = {${new Date().getFullYear()}}\n}`;
    }
    return `${item.canonicalTitle || item.title} [${item.title}]. ${item.code}, ${item.collection}. ${source.organization}. ${item.sourceUrl} (truy cập ${new Intl.DateTimeFormat("vi-VN").format(new Date())}). Dịch giả và giấy phép: ${item.translator}; ${item.license}.`;
  }

  function copyCitation(id, style = "academic") {
    const item = SCRIPTURES.find((entry) => entry.id === id); if (!item) return;
    const text = citationText(item, style);
    if (global.navigator?.clipboard?.writeText) global.navigator.clipboard.writeText(text).then(() => toast("Đã sao chép trích dẫn từ metadata.")).catch(() => global.prompt("Sao chép trích dẫn:", text));
    else global.prompt("Sao chép trích dẫn:", text);
  }

  function exportCitation(id) {
    const item = SCRIPTURES.find((entry) => entry.id === id); if (!item) return;
    downloadBlob(citationText(item, "bibtex"), `trich-dan-${item.id}.bib`, "application/x-bibtex;charset=utf-8");
    toast("Đã xuất BibTeX từ metadata hiện có.");
  }

  function stopAudioStudy() {
    audioStudyPlaying = false;
    global.speechSynthesis?.cancel?.();
    root?.querySelector("[data-dharma-hub]")?.classList.remove("is-audio-playing");
  }

  function speakAudioStudyEntry() {
    if (!audioStudyPlaying) return;
    const catalog = audioStudyCatalog();
    const queue = state.audio.queue.map((key) => catalog.find((item) => item.key === key)).filter(Boolean);
    if (!queue.length || audioStudyIndex >= queue.length) { stopAudioStudy(); audioStudyIndex = 0; if (activeView === "audio") renderView({ preserveScroll: true }); return; }
    const item = queue[audioStudyIndex];
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = "vi-VN"; utterance.rate = Math.max(.65, Math.min(1.1, Number(state.audio.rate) || .88));
    utterance.onend = () => { if (!audioStudyPlaying) return; audioStudyIndex += 1; speakAudioStudyEntry(); if (activeView === "audio") renderView({ preserveScroll: true }); };
    utterance.onerror = () => { stopAudioStudy(); if (activeView === "audio") renderView({ preserveScroll: true }); toast("Giọng tổng hợp đã dừng. Bạn có thể thử lại.", "warning"); };
    global.speechSynthesis.speak(utterance);
    if (activeView === "audio") renderView({ preserveScroll: true });
  }

  function toggleAudioStudy() {
    if (!("speechSynthesis" in global)) return toast("Trình duyệt chưa hỗ trợ giọng đọc tổng hợp.", "warning");
    if (audioStudyPlaying) { stopAudioStudy(); renderView({ preserveScroll: true }); return; }
    if (!state.audio.queue.length) return toast("Hãy thêm ít nhất một nội dung vào hàng nghe.", "warning");
    audioStudyIndex = Math.max(0, Math.min(audioStudyIndex, state.audio.queue.length - 1));
    audioStudyPlaying = true; root?.querySelector("[data-dharma-hub]")?.classList.add("is-audio-playing"); speakAudioStudyEntry();
  }

  function downloadBlob(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function sha256Text(value) {
    if (!global.crypto?.subtle) throw new Error("Trình duyệt chưa hỗ trợ SHA-256.");
    const digest = new Uint8Array(await global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function exportStudyBackup() {
    const payload = structuredClone(state);
    const backup = { kind: "hh-dharma-study", version: 1, exportedAt: new Date().toISOString(), scope: "account-local", payload, checksum: await sha256Text(JSON.stringify(payload)) };
    downloadBlob(JSON.stringify(backup, null, 2), `phat-phap-${todayKey()}.hhphap`, "application/json;charset=utf-8");
    state.exportHistory = [...state.exportHistory, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, type: "study", label: "Gói tu học có checksum", at: new Date().toISOString() }].slice(-30); saveState(); renderView({ preserveScroll: true }); toast("Đã xuất gói tu học có checksum SHA-256.");
  }

  async function exportEncryptedJournalBackup() {
    const payload = readJournalMeta(); if (!payload) return toast("Chưa có nhật ký mã hóa để xuất.", "warning");
    const backup = { kind: "hh-dharma-journal-encrypted", version: 1, exportedAt: new Date().toISOString(), scope: "account-local", payload, checksum: await sha256Text(JSON.stringify(payload)) };
    downloadBlob(JSON.stringify(backup, null, 2), `nhat-ky-ma-hoa-${todayKey()}.hhjournal`, "application/json;charset=utf-8");
    state.exportHistory = [...state.exportHistory, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, type: "journal", label: "Bản mã nhật ký AES-GCM", at: new Date().toISOString() }].slice(-30); saveState(); renderView({ preserveScroll: true }); toast("Đã xuất bản mã; PIN không nằm trong tệp.");
  }

  function sanitizeBackupValue(value, depth = 0) {
    if (depth > 10) throw new Error("Gói sao lưu lồng dữ liệu quá sâu.");
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return value.slice(0, 200000);
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => sanitizeBackupValue(item, depth + 1));
    if (typeof value === "object") {
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) continue;
        next[key.slice(0, 120)] = sanitizeBackupValue(child, depth + 1);
      }
      return next;
    }
    return null;
  }

  function allowlistedStudyState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Dữ liệu tu học không hợp lệ.");
    const cleaned = {};
    for (const key of Object.keys(DEFAULT_STATE)) if (Object.prototype.hasOwnProperty.call(raw, key)) cleaned[key] = sanitizeBackupValue(raw[key]);
    if (JSON.stringify(cleaned).length > 2_000_000) throw new Error("Gói tu học vượt giới hạn 2 MB.");
    return cleaned;
  }

  function validJournalCipher(raw) {
    return Boolean(raw && raw.version === 1 && raw.algorithm === "AES-GCM" && raw.kdf === "PBKDF2-SHA256" && Number(raw.iterations) >= JOURNAL_ITERATIONS && /^[A-Za-z0-9+/=]{16,}$/.test(raw.salt || "") && /^[A-Za-z0-9+/=]{12,}$/.test(raw.iv || "") && /^[A-Za-z0-9+/=]{16,}$/.test(raw.cipher || ""));
  }

  async function prepareImport(file, expectedType) {
    if (!file || file.size > 2_500_000) throw new Error("Tệp không hợp lệ hoặc vượt giới hạn 2,5 MB.");
    const parsed = JSON.parse(await file.text());
    const type = parsed.kind === "hh-dharma-study" ? "study" : parsed.kind === "hh-dharma-journal-encrypted" ? "journal" : "";
    if (!type || type !== expectedType || parsed.version !== 1) throw new Error("Loại gói sao lưu không đúng.");
    const checksum = await sha256Text(JSON.stringify(parsed.payload));
    if (checksum !== parsed.checksum) throw new Error("Checksum không khớp; tệp có thể đã bị thay đổi.");
    const data = type === "study" ? allowlistedStudyState(parsed.payload) : { version: 1, algorithm: String(parsed.payload?.algorithm || ""), kdf: String(parsed.payload?.kdf || ""), iterations: Number(parsed.payload?.iterations), salt: String(parsed.payload?.salt || ""), iv: String(parsed.payload?.iv || ""), cipher: String(parsed.payload?.cipher || "") };
    if (type === "journal" && !validJournalCipher(data)) throw new Error("Cấu trúc bản mã nhật ký không hợp lệ.");
    pendingImport = { type, data, exportedAt: String(parsed.exportedAt || new Date().toISOString()), label: file.name, summary: type === "study" ? `${Object.keys(data).length} nhóm dữ liệu được phép` : "AES-GCM · PBKDF2-SHA256 · không có PIN" };
  }

  function confirmPendingImport() {
    if (!pendingImport) return;
    if (pendingImport.type === "journal") {
      localStorage.setItem(journalStorageKey(), JSON.stringify(pendingImport.data)); lockJournal();
    } else {
      localStorage.setItem(storageKey(), JSON.stringify(pendingImport.data)); state = readState();
    }
    pendingImport = null; renderView(); toast("Đã khôi phục gói đã kiểm tra. Dữ liệu không được tải lên mạng.");
  }

  function handleClick(event) {
    const groupToggle = event.target.closest("[data-toggle-nav-group]");
    if (groupToggle) {
      openNavGroup = groupToggle.dataset.toggleNavGroup;
      root.querySelectorAll("[data-dharma-nav-group]").forEach((section) => {
        const open = section.dataset.dharmaNavGroup === openNavGroup;
        section.classList.toggle("is-open", open);
        section.querySelector("[data-toggle-nav-group]")?.setAttribute("aria-expanded", String(open));
        const items = section.querySelector(".dharma-nav-items");
        if (items) items.hidden = !open;
        const arrow = section.querySelector(".dharma-nav-group > b");
        if (arrow) arrow.textContent = open ? "⌄" : "›";
      });
      return;
    }
    const nav = event.target.closest("[data-dharma-nav]");
    if (nav) return navigate(nav.dataset.dharmaNav);
    if (event.target.closest("[data-dharma-aura]")) return cycleAuraMode();
    if (event.target.closest("[data-dharma-toggle-progress]")) {
      const hub = root.querySelector("[data-dharma-hub]");
      const opening = hub.classList.contains("is-progress-closed");
      if (opening) { inspectorMode = "progress"; inspectorItem = ""; }
      hub.classList.toggle("is-progress-closed", !opening);
      root.querySelector("[data-dharma-progress-panel]")?.setAttribute("aria-hidden", String(!opening));
      root.querySelectorAll("[data-dharma-toggle-progress]").forEach((button) => button.setAttribute("aria-expanded", String(opening)));
      if (opening) updateProgressPanel();
      return;
    }
    if (event.target.closest("[data-dharma-mobile-menu]")) {
      const sheet = root.querySelector("[data-dharma-mobile-sheet]");
      sheet.hidden = !sheet.hidden;
      root.querySelector("[data-dharma-hub]").classList.toggle("is-menu-open", !sheet.hidden);
      return;
    }
    if (event.target.closest("[data-dharma-schedule]")) return scheduleDialog();
    if (event.target.closest("[data-dialog-close]")) return event.target.closest("[data-dharma-dialog]")?.remove();
    if (event.target.closest("[data-action-note]")) return selectedScripture ? openInspector("notes", selectedScripture) : navigate("journal");
    if (event.target.closest("[data-action-mark]")) {
      if (!selectedScripture) return toast("Hãy mở một tài liệu trong Study Lab để đánh dấu.", "warning");
      const existed = state.bookmarks.includes(selectedScripture);
      state.bookmarks = existed ? state.bookmarks.filter((item) => item !== selectedScripture) : unique([...state.bookmarks, selectedScripture]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ đánh dấu tài liệu." : "Đã đánh dấu tài liệu."); return;
    }
    if (event.target.closest("[data-action-static]")) {
      state.visual = { ...state.visual, aura: "gentle" }; saveState();
      const hub = root.querySelector("[data-dharma-hub]"); if (hub) hub.dataset.aura = "gentle";
      const control = root.querySelector("[data-dharma-aura]"); if (control) { control.querySelector("i").textContent = "◐"; control.querySelector("[data-dharma-aura-label]").textContent = "Tĩnh"; }
      toast("Đã chuyển sang chế độ Tĩnh."); return;
    }
    const lessonButton = event.target.closest("[data-open-lesson], [data-dharma-next-lesson]");
    if (lessonButton) {
      selectedLesson = lessonButton.dataset.openLesson || lessonButton.dataset.dharmaNextLesson;
      if (!selectedLesson) return navigate("practice");
      activeView = "beginner";
      renderView();
      return;
    }
    const lifePath = event.target.closest("[data-life-path]");
    if (lifePath) { selectedLifePath = lifePath.dataset.lifePath; activeView = "situations"; renderView(); return; }
    if (event.target.closest("[data-back-life]")) { selectedLifePath = ""; renderView(); return; }
    const lifePractice = event.target.closest("[data-life-practice]");
    if (lifePractice) {
      const journey = LIFE_JOURNEYS.find((item) => item.id === lifePractice.dataset.lifePractice);
      const minutes = Math.max(5, Math.min(15, Number(journey?.practice.match(/\d+/)?.[0]) || 10));
      stopTimer(); timerInitial = minutes * 60; timerRemaining = timerInitial;
      state.meditation = { ...state.meditation, type: journey?.id === "gratitude" || journey?.id === "grief" ? "kindness" : "breath" }; saveState(); navigate("practice"); return;
    }
    const lifeComplete = event.target.closest("[data-life-complete]");
    if (lifeComplete) {
      const id = lifeComplete.dataset.lifeComplete; const old = state.lifePathProgress[id] || {};
      state.lifePathProgress = { ...state.lifePathProgress, [id]: { ...old, completed: !old.completed, updatedAt: new Date().toISOString() } }; saveState(); renderView({ preserveScroll: true }); return;
    }
    const teachingButton = event.target.closest("[data-open-teaching]");
    if (teachingButton) { selectedTeaching = teachingButton.dataset.openTeaching; activeView = "teachings"; renderView(); return; }
    const scriptureButton = event.target.closest("[data-open-scripture]");
    if (scriptureButton) { selectedScripture = scriptureButton.dataset.openScripture; state.recentScripture = selectedScripture; saveState(); activeView = "scriptures"; renderView(); return; }
    const back = event.target.closest("[data-back-list]");
    if (back) { selectedLesson = ""; selectedTeaching = ""; selectedScripture = ""; activeView = back.dataset.backList; renderView(); return; }
    const complete = event.target.closest("[data-complete-lesson]");
    if (complete) {
      const id = complete.dataset.completeLesson;
      const existed = state.completedLessons.includes(id);
      state.completedLessons = existed ? state.completedLessons.filter((item) => item !== id) : unique([...state.completedLessons, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ trạng thái hoàn thành." : "Đã hoàn thành bài học.", "success"); return;
    }
    const program = event.target.closest("[data-program]");
    if (program) { state.studySchedule = { ...state.studySchedule, program: Number(program.dataset.program) }; saveState(); renderView({ preserveScroll: true }); return; }
    const tier = event.target.closest("[data-learning-tier]");
    if (tier) { state.learningTier = tier.dataset.learningTier; saveState(); renderView({ preserveScroll: true }); return; }
    const routine = event.target.closest("[data-routine]");
    if (routine) {
      const day = todayKey(); const previous = Boolean(state.routineProgress[day]?.[routine.dataset.routine]);
      state.routineProgress = { ...state.routineProgress, [day]: { ...(state.routineProgress[day] || {}), [routine.dataset.routine]: !previous } };
      saveState(); renderView({ preserveScroll: true }); toast(previous ? "Đã bỏ ghi nhận." : "Đã ghi nhận vào thời khóa hôm nay."); return;
    }
    const bookmark = event.target.closest("[data-bookmark-scripture]");
    if (bookmark) {
      const id = bookmark.dataset.bookmarkScripture; const existed = state.bookmarks.includes(id);
      state.bookmarks = existed ? state.bookmarks.filter((item) => item !== id) : unique([...state.bookmarks, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ khỏi thư viện." : "Đã lưu vào thư viện."); return;
    }
    const scriptureTab = event.target.closest("[data-scripture-tab]");
    if (scriptureTab) { activeScriptureTab = scriptureTab.dataset.scriptureTab; renderView({ preserveScroll: true }); return; }
    const segment = event.target.closest("[data-scripture-segment]");
    if (segment) {
      selectedScriptureSegment = segment.dataset.scriptureSegment;
      state.readingPosition = { ...state.readingPosition, [selectedScripture]: selectedScriptureSegment }; saveState(); renderView({ preserveScroll: true });
      root.querySelector(`#segment-${CSS.escape(selectedScriptureSegment)}`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); return;
    }
    const highlightColor = event.target.closest("[data-highlight-color]");
    if (highlightColor) { scriptureHighlightColor = highlightColor.dataset.highlightColor; renderView({ preserveScroll: true }); return; }
    const segmentHighlight = event.target.closest("[data-segment-highlight]");
    if (segmentHighlight) {
      const id = segmentHighlight.dataset.segmentHighlight; const current = state.scriptureHighlightColors[id];
      state.scriptureHighlightColors = { ...state.scriptureHighlightColors, [id]: current === scriptureHighlightColor ? "" : scriptureHighlightColor };
      saveState(); renderView({ preserveScroll: true }); toast(current === scriptureHighlightColor ? "Đã bỏ tô sáng đoạn." : "Đã tô sáng đoạn."); return;
    }
    const segmentNote = event.target.closest("[data-segment-note]");
    if (segmentNote) { activeScriptureTab = "notes"; selectedScriptureSegment = segmentNote.dataset.segmentNote; renderView({ preserveScroll: true }); root.querySelector(`[data-scripture-segment-note="${CSS.escape(selectedScriptureSegment)}"]`)?.focus({ preventScroll: false }); return; }
    const openGlossary = event.target.closest("[data-open-glossary]");
    if (openGlossary) { selectedGlossary = openGlossary.dataset.openGlossary; navigate("glossary"); return; }
    const exportNotes = event.target.closest("[data-export-scripture-notes]");
    if (exportNotes) return exportScriptureNotes(exportNotes.dataset.exportScriptureNotes);
    const printNotes = event.target.closest("[data-print-scripture-notes]");
    if (printNotes) return printScriptureNotes(printNotes.dataset.printScriptureNotes);
    const copyCitationButton = event.target.closest("[data-copy-citation]");
    if (copyCitationButton) return copyCitation(copyCitationButton.dataset.copyCitation, copyCitationButton.dataset.citationStyle);
    const exportCitationButton = event.target.closest("[data-export-citation]");
    if (exportCitationButton) return exportCitation(exportCitationButton.dataset.exportCitation);
    const provenance = event.target.closest("[data-open-provenance]");
    if (provenance?.dataset.openProvenance) return openInspector("source", provenance.dataset.openProvenance);
    const inspectorNote = event.target.closest("[data-open-inspector-note]");
    if (inspectorNote) return openInspector("notes", inspectorNote.dataset.openInspectorNote);
    const highlight = event.target.closest("[data-highlight-scripture]");
    if (highlight) {
      const id = highlight.dataset.highlightScripture; const existed = state.scriptureHighlights.includes(id);
      state.scriptureHighlights = existed ? state.scriptureHighlights.filter((item) => item !== id) : unique([...state.scriptureHighlights, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ đánh dấu." : "Đã đánh dấu đoạn tóm lược."); return;
    }
    const readingPath = event.target.closest("[data-reading-path]");
    if (readingPath) {
      const id = readingPath.dataset.readingPath; const existed = state.readingPath.includes(id);
      state.readingPath = existed ? state.readingPath.filter((item) => item !== id) : unique([...state.readingPath, id]);
      saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ khỏi đường đọc." : "Đã thêm vào đường đọc cá nhân."); return;
    }
    const offlinePack = event.target.closest("[data-offline-scripture]");
    if (offlinePack) {
      const id = offlinePack.dataset.offlineScripture; const existed = state.offlinePacks.includes(id);
      state.offlinePacks = existed ? state.offlinePacks.filter((item) => item !== id) : unique([...state.offlinePacks, id]);
      saveState();
      if (!existed) global.navigator?.storage?.persist?.().catch?.(() => {});
      renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ khỏi gói offline." : "Đã lưu tóm lược và metadata để đọc offline."); return;
    }
    if (event.target.closest("[data-reading-path-view]")) { scriptureShelf = "path"; renderView(); return; }
    if (event.target.closest("[data-offline-view]")) { scriptureShelf = "offline"; renderView(); return; }
    if (event.target.closest("[data-scripture-clear-shelf]")) { scriptureShelf = "all"; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-scripture-saved-only]")) { scriptureSavedOnly = !scriptureSavedOnly; renderView({ preserveScroll: true }); return; }
    const reportSource = event.target.closest("[data-report-source]");
    if (reportSource) return sourceReportDialog(reportSource.dataset.reportSource);
    const teachingTab = event.target.closest("[data-teaching-tab]");
    if (teachingTab) {
      const card = teachingTab.closest(".dharma-teaching-detail");
      card.querySelectorAll("[data-teaching-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === teachingTab)));
      card.querySelectorAll("[data-teaching-panel]").forEach((panel) => { panel.hidden = panel.dataset.teachingPanel !== teachingTab.dataset.teachingTab; });
      return;
    }
    const requestTab = event.target.closest("[data-request-tab]");
    if (requestTab) {
      root.querySelectorAll("[data-request-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === requestTab)));
      root.querySelectorAll("[data-request-panel]").forEach((panel) => { panel.hidden = panel.dataset.requestPanel !== requestTab.dataset.requestTab; });
      return;
    }
    const speak = event.target.closest("[data-speak-scripture]");
    if (speak) return speakScripture(speak.dataset.speakScripture);
    if (event.target.closest("[data-reader-mode]")) return readerMode(SCRIPTURES.find((item) => item.id === selectedScripture));
    if (event.target.closest("[data-reader-close]")) { global.speechSynthesis?.cancel?.(); event.target.closest("[data-dharma-reader]")?.remove(); return; }
    const timerPreset = event.target.closest("[data-timer-preset]");
    if (timerPreset) { stopTimer(); timerInitial = Number(timerPreset.dataset.timerPreset) * 60; timerRemaining = timerInitial; renderView({ preserveScroll: true }); return; }
    const courseDay = event.target.closest("[data-course-day]");
    if (courseDay) {
      const course = MEDITATION_COURSE.find((item) => item.day === Number(courseDay.dataset.courseDay)); if (!course) return;
      stopTimer(); timerInitial = course.minutes * 60; timerRemaining = timerInitial; state.meditation = { ...state.meditation, type: course.type, activeCourseDay: course.day }; saveState(); renderView({ preserveScroll: true }); toast(`Đã chuẩn bị ngày ${course.day}: ${course.title}.`); return;
    }
    if (event.target.closest("[data-save-meditation-preset]")) {
      const preset = { id: global.crypto?.randomUUID?.() || `${Date.now()}`, label: `${({ breath: "Hơi thở", body: "Quán thân", feeling: "Cảm thọ", kindness: "Tâm từ", walking: "Thiền đi bộ" })[state.meditation.type] || "Thiền"} ${Math.round(timerInitial / 60)}′`, type: state.meditation.type, minutes: Math.round(timerInitial / 60), bellInterval: state.meditation.bellInterval, silent: state.meditation.silent };
      state.meditation = { ...state.meditation, presets: [...state.meditation.presets, preset].slice(-8) }; saveState(); renderView({ preserveScroll: true }); toast("Đã lưu preset thiền."); return;
    }
    const usePreset = event.target.closest("[data-use-meditation-preset]");
    if (usePreset) {
      const preset = state.meditation.presets.find((item) => item.id === usePreset.dataset.useMeditationPreset); if (!preset) return;
      stopTimer(); timerInitial = preset.minutes * 60; timerRemaining = timerInitial; state.meditation = { ...state.meditation, type: preset.type, bellInterval: preset.bellInterval, silent: preset.silent }; saveState(); renderView({ preserveScroll: true }); return;
    }
    if (event.target.closest("[data-timer-toggle]")) return toggleTimer();
    if (event.target.closest("[data-timer-reset]")) { stopTimer(); timerRemaining = timerInitial; updateTimerDisplay(); return; }
    if (event.target.closest("[data-meditation-lock]") && timerRunning) { state.meditation = { ...state.meditation, locked: true }; saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-meditation-unlock]")) { state.meditation = { ...state.meditation, locked: false }; saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-grounding]")) return groundingDialog();
    const meditationType = event.target.closest("[data-meditation-type]");
    if (meditationType) { state.meditation = { ...state.meditation, type: meditationType.dataset.meditationType }; saveState(); renderView({ preserveScroll: true }); return; }
    const meditationCheckIn = event.target.closest("[data-meditation-checkin]");
    if (meditationCheckIn) { if (timerRunning) stopTimer(); state.meditation = { ...state.meditation, checkIn: meditationCheckIn.dataset.meditationCheckin }; saveState(); renderView({ preserveScroll: true }); return; }
    const chantAdd = event.target.closest("[data-chant-add]");
    if (chantAdd) { state.chantCount += Number(chantAdd.dataset.chantAdd); saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-plus]")) { state.chantCount += 1; saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-minus]")) { state.chantCount = Math.max(0, state.chantCount - 1); saveState(); root.querySelector("[data-chant-count]").textContent = state.chantCount; return; }
    if (event.target.closest("[data-chant-reset]")) { const old = state.chantCount; state.chantCount = 0; saveState(); renderView({ preserveScroll: true }); toast("Đã đặt bộ đếm về 0.", "success", () => { state.chantCount = old; saveState(); renderView({ preserveScroll: true }); }); return; }
    const selectChant = event.target.closest("[data-select-chant]");
    if (selectChant) { stopChant(); chantSelectedLine = -1; state.chant = { ...state.chant, selected: selectChant.dataset.selectChant }; saveState(); renderView({ preserveScroll: true }); return; }
    const chantLine = event.target.closest("[data-chant-line]");
    if (chantLine) { chantSelectedLine = Number(chantLine.dataset.chantLine); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-chant-play]")) return toggleChant();
    if (event.target.closest("[data-chant-stop]")) { stopChant(); renderView({ preserveScroll: true }); return; }
    const selectStudyReview = event.target.closest("[data-select-study-review]");
    if (selectStudyReview) { selectedReviewKey = selectStudyReview.dataset.selectStudyReview; studyReviewReveal = false; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-reveal-study-review]")) { studyReviewReveal = true; renderView({ preserveScroll: true }); return; }
    const rateStudyReview = event.target.closest("[data-rate-study-review]");
    if (rateStudyReview && selectedReviewKey) {
      const outcome = rateStudyReview.dataset.rateStudyReview; const days = outcome === "again" ? 1 : outcome === "soon" ? 3 : 7; const due = new Date(); due.setDate(due.getDate() + days);
      state.reviewSchedule = { ...state.reviewSchedule, [selectedReviewKey]: { dueAt: due.toISOString(), intervalDays: days, outcome, reviewedAt: new Date().toISOString() } };
      state.reviewHistory = [...state.reviewHistory, { key: selectedReviewKey, outcome, at: new Date().toISOString(), nextDueAt: due.toISOString() }].slice(-300);
      const nextDue = reviewCatalog().find((item) => item.key !== selectedReviewKey && (!state.reviewSchedule[item.key]?.dueAt || new Date(state.reviewSchedule[item.key].dueAt) <= new Date())); selectedReviewKey = nextDue?.key || selectedReviewKey; studyReviewReveal = false; saveState(); renderView({ preserveScroll: true }); toast(`Đã hẹn xem lại sau ${days} ngày; không tạo điểm số.`); return;
    }
    const audioQueueButton = event.target.closest("[data-audio-queue]");
    if (audioQueueButton) { const key = audioQueueButton.dataset.audioQueue; const existed = state.audio.queue.includes(key); state.audio = { ...state.audio, queue: existed ? state.audio.queue.filter((item) => item !== key) : [...state.audio.queue, key].slice(-30) }; if (existed) { stopAudioStudy(); audioStudyIndex = 0; } saveState(); renderView({ preserveScroll: true }); return; }
    const removeAudio = event.target.closest("[data-remove-audio]");
    if (removeAudio) { stopAudioStudy(); state.audio = { ...state.audio, queue: state.audio.queue.filter((item) => item !== removeAudio.dataset.removeAudio) }; audioStudyIndex = 0; saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-audio-play]")) return toggleAudioStudy();
    if (event.target.closest("[data-audio-stop]")) { stopAudioStudy(); audioStudyIndex = 0; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-export-study-backup]")) return exportStudyBackup().catch((error) => toast(error?.message || "Không thể tạo gói sao lưu.", "warning"));
    if (event.target.closest("[data-export-journal-backup]")) return exportEncryptedJournalBackup().catch((error) => toast(error?.message || "Không thể xuất bản mã.", "warning"));
    if (event.target.closest("[data-cancel-import]")) { pendingImport = null; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-confirm-import]")) return confirmPendingImport();
    const calendarView = event.target.closest("[data-calendar-view]");
    if (calendarView) { state.calendar = { ...state.calendar, view: calendarView.dataset.calendarView }; saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-calendar-rest]")) { state.calendar = { ...state.calendar, paused: !state.calendar.paused }; saveState(); renderView({ preserveScroll: true }); toast(state.calendar.paused ? "Đã bật chế độ nghỉ; dữ liệu được giữ nguyên." : "Đã tiếp tục thời khóa."); return; }
    if (event.target.closest("[data-export-calendar]")) return exportCalendarIcs();
    const eventComplete = event.target.closest("[data-event-complete]");
    if (eventComplete) { const id = eventComplete.dataset.eventComplete; state.events = state.events.map((item) => item.id === id ? { ...item, completed: !item.completed } : item); saveState(); renderView({ preserveScroll: true }); return; }
    const scheduleSuggestion = event.target.closest("[data-apply-schedule-suggestion]");
    if (scheduleSuggestion) { state.studySchedule = { ...state.studySchedule, minutes: Number(scheduleSuggestion.dataset.applyScheduleSuggestion) }; saveState(); renderView({ preserveScroll: true }); toast("Đã điều chỉnh thời lượng; không xóa hoạt động cũ."); return; }
    const reportTemple = event.target.closest("[data-report-temple]");
    if (reportTemple) { const item = TEMPLE_DIRECTORY.find((entry) => entry.id === reportTemple.dataset.reportTemple); return safetyReportDialog("temple", reportTemple.dataset.reportTemple, item?.title || "Nguồn Chùa online"); }
    const openCircle = event.target.closest("[data-open-circle]");
    if (openCircle) { activeCircle = openCircle.dataset.openCircle; renderView(); return; }
    if (event.target.closest("[data-back-circles]")) { activeCircle = ""; renderView(); return; }
    const copyCircle = event.target.closest("[data-copy-circle-invite]");
    if (copyCircle) {
      const circle = state.circles.find((item) => item.id === copyCircle.dataset.copyCircleInvite); if (!circle) return;
      const code = circleInviteCode(circle);
      if (global.navigator?.clipboard?.writeText) global.navigator.clipboard.writeText(code).then(() => toast("Đã sao chép mã lời mời thủ công.")).catch(() => global.prompt("Sao chép mã lời mời:", code));
      else global.prompt("Sao chép mã lời mời:", code);
      return;
    }
    const reportCircle = event.target.closest("[data-report-circle]");
    if (reportCircle) { const circle = state.circles.find((item) => item.id === reportCircle.dataset.reportCircle); return safetyReportDialog("circle", reportCircle.dataset.reportCircle, circle?.title || "Nhóm đọc"); }
    const deleteCircle = event.target.closest("[data-delete-circle]");
    if (deleteCircle) {
      if (!global.confirm("Xóa nhóm khỏi thiết bị này? Ghi chú chia sẻ cục bộ của nhóm cũng sẽ bị xóa.")) return;
      const id = deleteCircle.dataset.deleteCircle; state.circles = state.circles.filter((item) => item.id !== id); const privateNotes = { ...state.circlePrivateNotes }; delete privateNotes[id]; state.circlePrivateNotes = privateNotes; activeCircle = ""; saveState(); renderView(); toast("Đã xóa nhóm cục bộ.", "warning"); return;
    }
    const glossaryDeck = event.target.closest("[data-glossary-deck]");
    if (glossaryDeck) { const id = glossaryDeck.dataset.glossaryDeck; const existed = state.glossaryDeck.includes(id); state.glossaryDeck = existed ? state.glossaryDeck.filter((item) => item !== id) : unique([...state.glossaryDeck, id]); glossaryReviewIndex = 0; glossaryReveal = false; saveState(); renderView({ preserveScroll: true }); toast(existed ? "Đã bỏ khỏi bộ ôn." : "Đã thêm vào bộ ôn thuật ngữ."); return; }
    if (event.target.closest("[data-glossary-reveal]")) { glossaryReveal = !glossaryReveal; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-glossary-next]")) { glossaryReviewIndex = state.glossaryDeck.length ? (glossaryReviewIndex + 1) % state.glossaryDeck.length : 0; glossaryReveal = false; renderView({ preserveScroll: true }); return; }
    const speakGlossaryButton = event.target.closest("[data-speak-glossary]");
    if (speakGlossaryButton) return speakGlossary(speakGlossaryButton.dataset.speakGlossary);
    if (event.target.closest("[data-access-contrast]")) { state.accessibility = { ...state.accessibility, contrast: state.accessibility.contrast === "high" ? "normal" : "high" }; saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-access-audio-description]")) return speakAccessibilityDescription();
    if (event.target.closest("[data-access-focus-workspace]")) { root.querySelector(".dharma-workspace")?.focus({ preventScroll: true }); toast("Đã đưa tiêu điểm tới nội dung chính."); return; }
    const glossary = event.target.closest("[data-glossary]");
    if (glossary) { selectedGlossary = glossary.dataset.glossary; renderView({ preserveScroll: true }); return; }
    const mapNode = event.target.closest("[data-map-node]");
    if (mapNode) { selectedMapNode = mapNode.dataset.mapNode; renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-clear-practice]")) { const old = state.practiceHistory; state.practiceHistory = []; saveState(); renderView({ preserveScroll: true }); toast("Đã xóa lịch sử thực hành.", "success", () => { state.practiceHistory = old; saveState(); renderView({ preserveScroll: true }); }); return; }
    if (event.target.closest("[data-export-journal]")) return exportJournalMarkdown();
    const saveTalk = event.target.closest("[data-save-talk]");
    if (saveTalk) { const id = saveTalk.dataset.saveTalk; state.savedTalks = state.savedTalks.includes(id) ? state.savedTalks.filter((item) => item !== id) : [...state.savedTalks, id]; saveState(); renderView({ preserveScroll: true }); return; }
    const saveSource = event.target.closest("[data-save-source]");
    if (saveSource) { const id = saveSource.dataset.saveSource; state.savedSources = state.savedSources.includes(id) ? state.savedSources.filter((item) => item !== id) : [...state.savedSources, id]; saveState(); renderView({ preserveScroll: true }); return; }
    const deleteEvent = event.target.closest("[data-delete-event]");
    if (deleteEvent) { state.events = state.events.filter((item) => item.id !== deleteEvent.dataset.deleteEvent); saveState(); renderView({ preserveScroll: true }); return; }
    const deletePrint = event.target.closest("[data-delete-print]");
    if (deletePrint) { state.printRequests = state.printRequests.filter((item) => item.id !== deletePrint.dataset.deletePrint); saveState(); renderView({ preserveScroll: true }); return; }
    const deleteEditorial = event.target.closest("[data-delete-editorial]");
    if (deleteEditorial && canEditSources) { state.metadataDrafts = state.metadataDrafts.filter((item) => item.id !== deleteEditorial.dataset.deleteEditorial); state.sourceReports = state.sourceReports.filter((item) => item.id !== deleteEditorial.dataset.deleteEditorial); saveState(); renderView({ preserveScroll: true }); return; }
    if (event.target.closest("[data-journal-lock]")) return lockJournal();
    if (event.target.closest("[data-journal-reset]")) {
      if (!global.confirm("Xóa vĩnh viễn nhật ký đã mã hóa? Không thể hoàn tác.")) return;
      localStorage.removeItem(journalStorageKey()); lockJournal(); renderView(); toast("Đã xóa nhật ký mã hóa.", "warning"); return;
    }
    const deleteJournal = event.target.closest("[data-delete-journal]");
    if (deleteJournal && journalEntries) {
      journalEntries = journalEntries.filter((item) => item.id !== deleteJournal.dataset.deleteJournal);
      persistJournal().then(() => { renderView({ preserveScroll: true }); toast("Đã xóa ghi chép."); }).catch(() => toast("Không thể lưu thay đổi.", "warning")); return;
    }
    const searchResult = event.target.closest("[data-search-action]");
    if (searchResult) {
      if (searchResult.dataset.searchAction === "lesson") { selectedLesson = searchResult.dataset.searchId; activeView = "beginner"; }
      if (searchResult.dataset.searchAction === "teaching") { selectedTeaching = searchResult.dataset.searchId; activeView = "teachings"; }
      if (searchResult.dataset.searchAction === "scripture") { selectedScripture = searchResult.dataset.searchId; activeView = "scriptures"; }
      if (searchResult.dataset.searchAction === "glossary") { selectedGlossary = searchResult.dataset.searchId; activeView = "glossary"; }
      if (searchResult.dataset.searchAction === "situation") { selectedLifePath = searchResult.dataset.searchId; activeView = "situations"; }
      root.querySelector("[data-dharma-search-results]")?.remove(); renderView(); return;
    }
    if (event.target.closest("[data-dharma-primary]")) {
      if (activeView === "practice") return toggleTimer();
      if (activeView === "chanting") return toggleChant();
      if (activeView === "audio") return toggleAudioStudy();
      if (activeView === "review") { studyReviewReveal = true; renderView({ preserveScroll: true }); return; }
      if (activeView === "data-control") return exportStudyBackup().catch((error) => toast(error?.message || "Không thể tạo gói sao lưu.", "warning"));
      if (activeView === "scriptures") return selectedScripture ? readerMode(SCRIPTURES.find((item) => item.id === selectedScripture)) : (state.recentScripture ? (selectedScripture = state.recentScripture, renderView()) : null);
      return navigate("beginner");
    }
  }

  function handleInput(event) {
    if (event.target.matches("[data-dharma-search]")) return showSearchResults(event.target);
    if (event.target.matches("[data-scripture-search]")) { scriptureQuery = event.target.value; renderView({ preserveScroll: true }); root.querySelector("[data-scripture-search]")?.focus({ preventScroll: true }); }
    if (event.target.matches("[data-glossary-search]")) {
      const term = normalize(event.target.value);
      root.querySelectorAll("[data-glossary]").forEach((button) => { button.hidden = !normalize(button.textContent).includes(term); });
    }
    if (event.target.matches("[data-access-reader-size]")) {
      const size = Math.max(18, Math.min(24, Number(event.target.value) || 20));
      state.accessibility = { ...state.accessibility, readerSize: size }; saveState();
      const hub = root.querySelector("[data-dharma-hub]"); if (hub) hub.style.setProperty("--dharma-reader-size", `${size}px`);
      const preview = event.target.closest("article")?.querySelector("h2"); if (preview) preview.textContent = `${size}px`;
      const sample = event.target.closest("article")?.querySelector("p"); if (sample) sample.style.fontSize = `${size}px`;
    }
  }

  async function handleChange(event) {
    if (event.target.matches("[data-scripture-tradition]")) { scriptureTradition = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-scripture-topic]")) { scriptureTopic = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-scripture-difficulty]")) { scriptureDifficulty = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-reading-program]")) { state.readingProgram = Number(event.target.value); saveState(); renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-bell-interval]")) { state.meditation = { ...state.meditation, bellInterval: Number(event.target.value) }; saveState(); }
    if (event.target.matches("[data-meditation-silent]")) { state.meditation = { ...state.meditation, silent: event.target.checked }; saveState(); }
    if (event.target.matches("[data-chant-pace]")) { const running = Boolean(chantTimerId); stopChant(); state.chant = { ...state.chant, pace: event.target.value }; saveState(); renderView({ preserveScroll: true }); if (running) toggleChant(); }
    if (event.target.matches("[data-chant-repeat]")) { state.chant = { ...state.chant, repeat: event.target.checked }; saveState(); }
    if (event.target.matches("[data-chant-transliteration]")) { state.chant = { ...state.chant, showTransliteration: event.target.checked }; saveState(); renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-chant-meaning]")) { state.chant = { ...state.chant, showMeaning: event.target.checked }; saveState(); renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-chant-font]")) { state.chant = { ...state.chant, fontSize: Number(event.target.value) }; saveState(); renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-chant-line-height]")) { state.chant = { ...state.chant, lineHeight: Number(event.target.value) }; saveState(); renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-chant-sleep]")) { state.chant = { ...state.chant, sleepMinutes: Number(event.target.value) }; saveState(); if (chantTimerId) chantStopAt = state.chant.sleepMinutes ? Date.now() + state.chant.sleepMinutes * 60000 : 0; }
    if (event.target.matches("[data-audio-rate]")) { const running = audioStudyPlaying; stopAudioStudy(); state.audio = { ...state.audio, rate: Number(event.target.value) }; saveState(); renderView({ preserveScroll: true }); if (running) toggleAudioStudy(); }
    if (event.target.matches("[data-calendar-template]")) { applyCalendarTemplate(event.target.value); renderView({ preserveScroll: true }); toast("Đã áp dụng mẫu cho 7 ngày tới; sự kiện cá nhân khác được giữ nguyên."); }
    if (event.target.matches("[data-temple-province]")) { templeProvince = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-temple-tradition]")) { templeTradition = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-temple-access]")) { templeAccess = event.target.value; renderView({ preserveScroll: true }); }
    if (event.target.matches("[data-access-senior]")) { state.accessibility = { ...state.accessibility, senior: event.target.checked }; saveState(); renderView({ preserveScroll: true }); }
    const shareAlias = event.target.closest("[data-circle-share-alias]");
    if (shareAlias) { const id = shareAlias.dataset.circleShareAlias; state.circles = state.circles.map((item) => item.id === id ? { ...item, privacy: { ...item.privacy, shareAlias: shareAlias.checked } } : item); saveState(); }
    const note = event.target.closest("[data-lesson-note]");
    if (note) { state.lessonNotes = { ...state.lessonNotes, [note.dataset.lessonNote]: note.value }; saveState(); toast("Đã lưu ghi chú trên thiết bị."); }
    const scriptureNote = event.target.closest("[data-scripture-note]");
    if (scriptureNote) { state.scriptureNotes = { ...state.scriptureNotes, [scriptureNote.dataset.scriptureNote]: scriptureNote.value }; saveState(); toast("Đã lưu ghi chú học tập."); }
    const segmentNote = event.target.closest("[data-scripture-segment-note]");
    if (segmentNote) { state.scriptureSegmentNotes = { ...state.scriptureSegmentNotes, [segmentNote.dataset.scriptureSegmentNote]: segmentNote.value }; saveState(); toast("Đã lưu ghi chú cạnh đoạn."); }
    const lifeNote = event.target.closest("[data-life-note]");
    if (lifeNote) { const previous = state.lifePathProgress[lifeNote.dataset.lifeNote] || {}; state.lifePathProgress = { ...state.lifePathProgress, [lifeNote.dataset.lifeNote]: { ...previous, note: lifeNote.value, updatedAt: new Date().toISOString() } }; saveState(); toast("Đã lưu suy ngẫm trên thiết bị."); }
    const circlePrivateNote = event.target.closest("[data-circle-private-note]");
    if (circlePrivateNote) { state.circlePrivateNotes = { ...state.circlePrivateNotes, [circlePrivateNote.dataset.circlePrivateNote]: circlePrivateNote.value }; saveState(); toast("Đã lưu ghi chú riêng; nội dung không đi vào lời mời."); }
    const importInput = event.target.closest("[data-import-backup]");
    if (importInput?.files?.[0]) {
      try { await prepareImport(importInput.files[0], importInput.dataset.importBackup); renderView({ preserveScroll: true }); toast("Tệp hợp lệ. Hãy xem trước rồi xác nhận khôi phục."); }
      catch (error) { pendingImport = null; importInput.value = ""; toast(error?.message || "Không thể kiểm tra tệp sao lưu.", "warning"); }
    }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form.closest("[data-dharma-hub]")) return;
    event.preventDefault();
    if (form.matches("[data-schedule-form]")) {
      const data = new FormData(form); state.studySchedule = { minutes: Number(data.get("minutes")), time: String(data.get("time") || "20:00"), program: Number(data.get("program")) };
      saveState(); form.closest("[data-dharma-dialog]")?.remove(); renderView({ preserveScroll: true }); toast("Đã lưu thời khóa."); return;
    }
    if (form.matches("[data-event-form]")) {
      const data = new FormData(form); state.events = [...state.events, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), at: String(data.get("at")), type: String(data.get("type") || "Tu học"), completed: false }];
      saveState(); renderView({ preserveScroll: true }); toast("Đã lưu vào lịch cá nhân."); return;
    }
    if (form.matches("[data-circle-create]")) {
      const data = new FormData(form); const id = global.crypto?.randomUUID?.() || `${Date.now()}`; const alias = String(data.get("alias") || "").trim();
      const circle = { id, title: String(data.get("title")).trim(), scriptureId: String(data.get("scripture")), discussionAt: String(data.get("discussionAt")), role: "Chủ nhóm", members: [{ id: accountKey, alias: alias || "Chủ nhóm ẩn danh", role: "Chủ nhóm" }], sharedNotes: [], privacy: { shareAlias: false }, createdAt: new Date().toISOString(), sync: "manual-local" };
      state.circles = [...state.circles, circle]; activeCircle = id; saveState(); renderView(); toast("Đã tạo nhóm cục bộ. Chỉ chia sẻ khi bạn sao chép mã lời mời."); return;
    }
    if (form.matches("[data-circle-join]")) {
      const data = new FormData(form);
      try {
        const invited = parseCircleInvite(data.get("code")); const id = global.crypto?.randomUUID?.() || `${Date.now()}`; const alias = String(data.get("alias") || "").trim();
        const members = [...(invited.coordinator?.alias ? [{ id: "invited-coordinator", alias: String(invited.coordinator.alias).slice(0, 40), role: "Chủ nhóm" }] : []), { id: accountKey, alias: alias || "Thành viên ẩn danh", role: "Thành viên" }];
        const circle = { id, title: String(invited.title).slice(0, 80), scriptureId: SCRIPTURES.some((item) => item.id === invited.scriptureId) ? invited.scriptureId : SCRIPTURES[0].id, discussionAt: String(invited.discussionAt || ""), role: "Thành viên", members, sharedNotes: Array.isArray(invited.sharedNotes) ? invited.sharedNotes.slice(-50).map((note) => ({ id: String(note.id || `${Date.now()}`), alias: String(note.alias || "Thành viên ẩn danh").slice(0, 40), body: String(note.body || "").slice(0, 2000), createdAt: String(note.createdAt || new Date().toISOString()) })) : [], privacy: { shareAlias: false }, createdAt: new Date().toISOString(), sync: "manual-local" };
        state.circles = [...state.circles, circle]; activeCircle = id; saveState(); renderView(); toast("Đã nhập bản sao cục bộ của nhóm. Không có đồng bộ tự động.");
      } catch (error) { toast(error?.message || "Không thể đọc mã lời mời.", "warning"); }
      return;
    }
    if (form.matches("[data-circle-shared-note]")) {
      const id = form.dataset.circleSharedNote; const body = String(new FormData(form).get("body") || "").trim();
      state.circles = state.circles.map((item) => item.id === id ? { ...item, sharedNotes: [...(item.sharedNotes || []), { id: global.crypto?.randomUUID?.() || `${Date.now()}`, alias: item.privacy?.shareAlias ? (item.members?.find((member) => member.id === accountKey)?.alias || "Thành viên") : "Thành viên ẩn danh", body, createdAt: new Date().toISOString() }].slice(-100) } : item);
      saveState(); renderView({ preserveScroll: true }); toast("Đã thêm vào phần chia sẻ của nhóm cục bộ."); return;
    }
    if (form.matches("[data-safety-report]")) {
      const data = new FormData(form);
      state.sourceReports = [...state.sourceReports, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, kind: String(data.get("kind")), target: String(data.get("target")), type: String(data.get("type")), detail: String(data.get("detail")).trim(), createdAt: new Date().toISOString(), status: "Chờ quản trị viên kiểm tra" }].slice(-100);
      saveState(); form.closest("[data-dharma-dialog]")?.remove(); toast("Đã lưu phản hồi an toàn vào hàng chờ cục bộ."); return;
    }
    if (form.matches("[data-source-report]")) {
      const data = new FormData(form);
      state.sourceReports = [...(Array.isArray(state.sourceReports) ? state.sourceReports : []), { id: global.crypto?.randomUUID?.() || `${Date.now()}`, scriptureId: String(data.get("scripture")), type: String(data.get("type")), detail: String(data.get("detail")).trim(), createdAt: new Date().toISOString(), status: "Chờ biên tập" }].slice(-100);
      saveState(); form.closest("[data-dharma-dialog]")?.remove(); toast("Đã lưu phản hồi vào hàng chờ biên tập."); return;
    }
    if (form.matches("[data-metadata-draft]")) {
      if (!canEditSources) return toast("Tài khoản không có quyền biên tập nguồn.", "warning");
      const data = new FormData(form);
      state.metadataDrafts = [...state.metadataDrafts, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, scriptureId: String(data.get("scripture")), field: String(data.get("field")), value: String(data.get("value")).trim(), evidence: String(data.get("evidence")).trim(), editor: accountKey, status: "Chờ duyệt", createdAt: new Date().toISOString() }].slice(-100);
      saveState(); renderView({ preserveScroll: true }); toast("Đã lưu bản nháp metadata; chưa thay đổi nội dung công bố."); return;
    }
    if (form.matches("[data-print-request]")) {
      const data = new FormData(form); state.printRequests = [...state.printRequests, { id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), purpose: String(data.get("purpose")), createdAt: new Date().toISOString() }];
      saveState(); renderView({ preserveScroll: true }); root.querySelector('[data-request-tab="print"]')?.click(); toast("Đã lưu nguyện vọng; đây chưa phải đơn hàng."); return;
    }
    if (form.matches("[data-qna-form]")) {
      const question = String(new FormData(form).get("question") || ""); const terms = normalize(question).split(/\s+/).filter((term) => term.length > 2);
      const candidates = [...TEACHINGS.map((item) => ({ ...item, kind: "Giáo lý", text: `${item.title} ${item.intro} ${item.deep} ${item.application}` })), ...SCRIPTURES.map((item) => ({ ...item, kind: "Kinh điển", intro: item.summary, application: "Mở nguồn gốc để đọc đầy đủ trong bối cảnh.", text: `${item.title} ${item.summary} ${item.keywords}` }))];
      const ranked = candidates.map((item) => ({ item, score: terms.reduce((sum, term) => sum + (normalize(item.text).includes(term) ? 1 : 0), 0) })).filter((entry) => entry.score).sort((a,b) => b.score - a.score).slice(0, 3);
      const answer = root.querySelector("[data-qna-answer]");
      answer.innerHTML = ranked.length ? `<small>KẾT QUẢ TỪ THƯ VIỆN NỘI BỘ</small>${ranked.map(({ item }) => `<article><header><span>${safe(item.kind)}</span>${sourceBadge(item.sourceId)}</header><h3>${safe(item.title)}</h3><p>${safe(item.intro || item.summary)}</p><p><strong>Gợi ý thực hành:</strong> ${safe(item.application || "Đọc nguồn trong bối cảnh và ghi lại điều bạn hiểu.")}</p></article>`).join("")}` : '<p class="dharma-empty-line">Chưa tìm thấy chủ đề đủ gần. Hãy thử “Tứ Diệu Đế”, “hơi thở”, “từ bi” hoặc mở nguồn chính thức.</p>';
      answer.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); return;
    }
    if (form.matches("[data-journal-setup]")) {
      const data = new FormData(form); const pin = String(data.get("pin"));
      if (pin !== String(data.get("confirm"))) return toast("Hai lần nhập PIN chưa khớp.", "warning");
      try { await setupJournal(pin); renderView(); toast("Đã tạo nhật ký mã hóa."); } catch { toast("Không thể tạo khóa trên trình duyệt này.", "warning"); } return;
    }
    if (form.matches("[data-journal-unlock]")) {
      try { await unlockJournal(String(new FormData(form).get("pin"))); renderView(); toast("Đã mở khóa trong phiên hiện tại."); } catch { toast("PIN không đúng hoặc dữ liệu đã hỏng.", "warning"); } return;
    }
    if (form.matches("[data-journal-entry]")) {
      const data = new FormData(form); journalEntries.push({ id: global.crypto?.randomUUID?.() || `${Date.now()}`, title: String(data.get("title")).trim(), body: String(data.get("body")).trim(), mood: String(data.get("mood")), createdAt: new Date().toISOString() });
      try { await persistJournal(); renderView(); toast("Đã mã hóa và lưu ghi chép."); } catch { journalEntries.pop(); toast("Không thể mã hóa ghi chép.", "warning"); } return;
    }
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); root?.querySelector("[data-dharma-search]")?.focus(); }
    if (event.key === "Escape") { root?.querySelector("[data-dharma-reader]")?.remove(); root?.querySelector("[data-dharma-dialog]")?.remove(); root?.querySelector("[data-dharma-search-results]")?.remove(); }
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount();
    root = host;
    currentUser = options.currentUser || {};
    accountKey = accountScope(currentUser);
    const roles = [currentUser.role, ...(Array.isArray(currentUser.roles) ? currentUser.roles : [])].map((value) => String(value || "").toLowerCase());
    canEditSources = Boolean(currentUser.isAdmin || roles.some((role) => ["admin", "owner", "editor", "dharma-editor"].includes(role)));
    state = readState();
    activeView = NAV.some((item) => item.id === options.view) ? options.view : "today";
    openNavGroup = NAV.find((item) => item.id === activeView)?.group || "Bắt đầu";
    root.innerHTML = shellMarkup();
    if (global.matchMedia("(max-width: 1260px)").matches) root.querySelector("[data-dharma-hub]")?.classList.add("is-progress-closed");
    renderView();
    listen(root, "click", handleClick);
    listen(root, "input", handleInput);
    listen(root, "change", handleChange);
    listen(root, "submit", handleSubmit);
    listen(root, "focusin", (event) => {
      if (event.target.matches("input, textarea, [contenteditable='true']")) root.querySelector("[data-dharma-hub]")?.classList.add("is-reading");
    });
    listen(root, "focusout", () => global.setTimeout(() => {
      if (!root?.contains(document.activeElement) || !document.activeElement?.matches?.("input, textarea, [contenteditable='true']")) root?.querySelector("[data-dharma-hub]")?.classList.remove("is-reading");
    }, 0));
    listen(document, "keydown", handleKeydown);
    listen(document, "visibilitychange", () => { if (!document.hidden) return; if (timerRunning) stopTimer(); if (chantTimerId) { stopChant(); renderView({ preserveScroll: true }); } if (audioStudyPlaying) { stopAudioStudy(); if (activeView === "audio") renderView({ preserveScroll: true }); } });
    return true;
  }

  function unmount() {
    stopTimer();
    stopChant();
    stopAudioStudy();
    global.speechSynthesis?.cancel?.();
    listeners.splice(0).forEach((remove) => remove());
    lockJournal();
    if (root) root.replaceChildren();
    root = null;
  }

  global.HHPhatPhap = Object.freeze({ VERSION, mount, unmount, lessons: LESSONS, teachings: TEACHINGS, scriptures: SCRIPTURES, sources: SOURCES });
})(window);
