/* Original HH learning summaries. External videos remain with their publishers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HHPatinLearningData=api;})(globalThis,function(){
  'use strict';
  const rows=[
  [
    "duck-walk",
    "Bước chữ V / Duck walk",
    "foundation",
    null,
    "basic",
    [
      "static-steps",
      "ready-stance"
    ],
    "Phân biệt bước đặt chân nhỏ với sải đẩy đang lăn.",
    "Quan sát hướng hai mũi giày và vị trí thân ở mỗi lần đặt chân; hỏi HLV khi đầu gối bị ép vào trong.",
    "Cố mở chân theo một góc cố định hoặc bước quá dài.",
    "Mô tả được bước nào còn thiếu ổn định và phương án dừng trước khi lăn."
  ],
  [
    "forward-swizzles",
    "Swizzles tiến · mở và thu hai chân",
    "foundation",
    null,
    "control",
    [
      "two-foot-glide",
      "weight-transfer"
    ],
    "Hiểu nhịp mở–thu trên hai chân, không xem đây là phanh.",
    "Quan sát độ rộng tự nhiên của chân và đường bánh; HLV chọn bài chậm, không ép hai giày chạm nhau.",
    "Ép gối hoặc thu chân quá mạnh để tạo tốc độ.",
    "Có thể trao đổi về nhịp chân và đường lăn chứ không chỉ hình dáng chữ V."
  ],
  [
    "alternating-swizzles",
    "Swizzles luân phiên",
    "foundation",
    null,
    "control",
    [
      "forward-swizzles",
      "weight-transfer"
    ],
    "Nhận biết hai bên có thể làm việc khác nhau trong cùng một nhịp.",
    "Xem từng bên chịu tải, chọn đoạn ngắn do HLV giao và ghi bên còn khó kiểm soát.",
    "Đổi nhịp quá nhanh khi chân nhận tải chưa ổn định.",
    "Ghi riêng bên trái/phải và điều kiện kết thúc lượt."
  ],
  [
    "lemon-drops",
    "Lemon drops · nhịp hai chân",
    "foundation",
    null,
    "control",
    [
      "forward-swizzles",
      "two-foot-glide"
    ],
    "So sánh một biến thể nhịp hai chân với swizzles cơ bản.",
    "Quan sát hướng chân và phần chuyển nhịp; hỏi HLV tên gọi và cách biến thể được dùng trong bài của mình.",
    "Coi các tên động tác là những kỹ năng hoàn toàn độc lập hoặc tự tăng đà để làm được.",
    "Nêu được điểm giống/khác với bài nền tảng đang học."
  ],
  [
    "stance-reset",
    "Trở lại tư thế ổn định sau động tác",
    "foundation",
    null,
    "basic",
    [
      "ready-stance",
      "two-foot-glide"
    ],
    "Dành chỗ cho phần kết thúc chứ không chỉ phần bắt đầu.",
    "Trong bài chậm có HLV, kết thúc mỗi đoạn bằng tư thế đã kiểm soát và phương án dừng đã học.",
    "Nối tiếp kỹ thuật khi thân chưa ổn định.",
    "Nhận biết lúc cần bỏ lượt thay vì cố hoàn thành chuỗi."
  ],
  [
    "learning-video",
    "Đọc video kỹ thuật đúng bối cảnh",
    "foundation",
    null,
    "intro",
    [],
    "Phân biệt quan sát, suy đoán và hướng dẫn phù hợp với bản thân.",
    "Xem toàn cảnh trước; ghi loại giày, nền, hướng lăn, tốc độ biểu diễn và phần chưa nhìn rõ. Mang một câu hỏi cụ thể đến HLV.",
    "Chỉ xem đoạn đẹp nhất rồi bỏ qua điều kiện tập và thoát động tác.",
    "Ghi được một điều nhìn thấy và một điều cần xác minh."
  ],
  [
    "practice-feedback",
    "Nhận phản hồi & chọn một mục tiêu nhỏ",
    "foundation",
    null,
    "basic",
    [
      "learning-video",
      "gear-check"
    ],
    "Dùng phản hồi thật để chọn nội dung buổi tới.",
    "Ghi nguyên ý HLV nhận xét bằng lời của mình; chọn một vấn đề phù hợp rồi xác nhận lại trước khi tập.",
    "Gộp mọi lỗi vào một buổi hoặc suy ra năng lực từ số phút.",
    "Tách được mục tiêu dự kiến và điều đã xảy ra."
  ],
  [
    "equipment-surface-match",
    "Giày, bánh & mặt sân",
    "foundation",
    null,
    "intro",
    [
      "gear-check"
    ],
    "Nhận biết setup ảnh hưởng cảm giác lăn nhưng không thay thế kỹ thuật.",
    "Đối chiếu hướng dẫn model và sân được phép; hỏi kỹ thuật viên/HLV trước khi đổi bánh, frame hoặc tháo phanh.",
    "Đoán lực bám từ độ cứng bánh duy nhất hoặc sao chép setup thi đấu.",
    "Nêu được thay đổi muốn hỏi và giới hạn chưa kiểm tra."
  ],
  [
    "speed-stride-observation",
    "Quan sát một chu kỳ sải Speed",
    "speed",
    "speed",
    "control",
    [
      "efficient-stride",
      "learning-video"
    ],
    "Tách đẩy, hồi chân và nhận tải để hỏi đúng phần kỹ thuật.",
    "Quan sát một bên trước, ghi phần chân trở về và điểm đổi tải thấy trong video. Không suy ra lực đẩy chỉ từ hình ảnh.",
    "Coi bước dài nhất là bước hiệu quả nhất.",
    "Có câu hỏi cụ thể về một phần chu kỳ, không tự chấm kỹ thuật."
  ],
  [
    "speed-centerline",
    "Chân hồi & đường giữa cơ thể",
    "speed",
    "speed",
    "control",
    [
      "speed-recovery",
      "speed-posture"
    ],
    "Hiểu hồi chân là phần phối hợp với thân và chân trụ.",
    "So sánh đường hồi chân với vị trí thân trong đoạn chậm; để HLV chọn biên độ cho setup hiện tại.",
    "Kéo chân về quá sát hoặc cố bắt chước VĐV đến mức mất ổn định.",
    "Ghi phần quan sát được và điều còn bị góc quay che."
  ],
  [
    "speed-look-through-curve",
    "Quan sát lối ra cua",
    "speed",
    "speed",
    "control",
    [
      "speed-curve-line",
      "look-ahead"
    ],
    "Liên hệ tầm nhìn, đường cua và vùng dừng trong sân quản lý.",
    "Xem cả đoạn trước và sau cua; hỏi HLV về quy tắc làn của sân. Không áp dụng đường cua thi đấu trên lối công cộng.",
    "Chỉ nhìn VĐV trước mặt hoặc dùng cua để tránh người đột ngột.",
    "Nêu được lối ra/vùng trống cần xác nhận tại sân."
  ],
  [
    "speed-video-angles",
    "So sánh góc quay Speed",
    "speed",
    "speed",
    "control",
    [
      "speed-stride-observation"
    ],
    "Không kết luận kỹ thuật từ một góc máy duy nhất.",
    "Ghi góc trước/bên/sau, bên chân thấy rõ và hiện tượng máy quay tạo ra. Chỉ dùng video của mình khi có quyền và HLV đồng ý nhận.",
    "So góc quay khác nhau như thể cùng tốc độ và điều kiện.",
    "Phân biệt góc nhìn với lỗi kỹ thuật chưa xác minh."
  ],
  [
    "speed-team-signals",
    "Tín hiệu & trao đổi trong buổi Speed",
    "speed",
    "speed",
    "advanced",
    [
      "group-ethics",
      "speed-paceline"
    ],
    "Làm rõ tín hiệu đội/sân trước bài có nhiều người.",
    "Hỏi HLV quy trình báo dừng, vượt và rời hàng cụ thể của sân; không tự đặt luật chung cho mọi đội.",
    "Cho rằng người khác sẽ hiểu một ký hiệu lấy từ video.",
    "Có phương án giao tiếp được đội xác nhận."
  ],
  [
    "speed-recovery-review",
    "Nhật ký phản hồi & hồi phục buổi Speed",
    "speed",
    "speed",
    "basic",
    [
      "speed-session-review"
    ],
    "Ghi cảm nhận mà không tự chẩn đoán hay đặt tải luyện.",
    "Ghi thời lượng thực tế, điều kiện, phản hồi của HLV và lý do dừng nếu có. Nếu đau hoặc không khỏe, ngừng tập và tìm hỗ trợ phù hợp.",
    "Dùng app như máy đo thể lực hoặc ép bù buổi bị bỏ.",
    "Phân biệt cảm nhận cá nhân với chỉ định chuyên môn."
  ],
  [
    "slide-movement-language",
    "Đọc tên họ Slide & biến thể",
    "slide",
    "slide",
    "advanced",
    [
      "slide-preparation",
      "learning-video"
    ],
    "Hiểu tên gọi có thể khác theo người dạy và thể thức.",
    "Đối chiếu hướng lăn, số chân chịu tải và setup nhìn thấy với HLV; không suy ra độ an toàn từ tên hay độ khó thi đấu.",
    "Thấy chữ beginner rồi tự thử ở tốc độ biểu diễn.",
    "Biết tên chỉ là nhãn; điều kiện học cần được xác nhận riêng."
  ],
  [
    "slide-viewing-checklist",
    "Quan sát vào–giữ–ra một lượt Slide",
    "slide",
    "slide",
    "advanced",
    [
      "slide-entry",
      "slide-exit"
    ],
    "Không bỏ qua phần trước/sau đoạn trượt ngang đẹp mắt.",
    "Xem toàn lượt và ghi mặt nền, khoảng trống, người hướng dẫn và phần kết thúc; nếu video không cho thấy, đánh dấu chưa rõ.",
    "Chỉ lưu khoảnh khắc ngang bánh mà xem đó là giáo án.",
    "Có câu hỏi cho HLV về điều kiện học, không có công thức tự tăng tốc."
  ],
  [
    "slide-setup-differences",
    "Khác biệt setup khi xem Slide",
    "slide",
    "slide",
    "advanced",
    [
      "slide-surface",
      "equipment-surface-match"
    ],
    "Nhận biết video không chứng minh bộ giày của bạn có cùng hành vi.",
    "Ghi setup nếu nhà xuất bản nêu rõ; nếu không, ghi chưa rõ thay vì đoán độ cứng hay kích thước bánh.",
    "Đổi bánh/tháo phanh để bắt chước khi chưa có cách dừng thay thế.",
    "Có danh sách điều cần hỏi nhà sản xuất và HLV."
  ],
  [
    "slide-coach-review",
    "Phiếu trao đổi sau buổi Slide",
    "slide",
    "slide",
    "basic",
    [
      "slide-preparation"
    ],
    "Ghi nhận bài thật do HLV giao, không gộp xem video vào buổi thực hành.",
    "Tách phần đã xem, phần được HLV giao và phần đã thử; ghi điều kiện sân và phản hồi thực tế.",
    "Đánh dấu đã thử sau khi chỉ xem một clip.",
    "Nhật ký ghi đúng hoạt động xảy ra, không tự cấp mức kỹ thuật."
  ],
  [
    "slalom-back-swizzles",
    "Swizzles lùi · nền tảng có giám sát",
    "slalom",
    "slalom",
    "control",
    [
      "backward-roll",
      "forward-swizzles"
    ],
    "Nhận biết nhịp lùi hai chân cần quan sát và cách dừng riêng.",
    "Xem đường chân và tầm nhìn sau; HLV chọn sân trống, bài chậm và phương án dừng phù hợp. Không tập lùi trên lối dùng chung.",
    "Chỉ đảo video tiến rồi cho rằng đó là hướng dẫn lùi.",
    "Có câu hỏi về tầm nhìn và kết thúc lượt."
  ],
  [
    "slalom-toe-roll",
    "Toe roll · định hướng trên ít bánh",
    "slalom",
    "slalom",
    "advanced",
    [
      "toe-heel",
      "edge-control"
    ],
    "Phân biệt hình thức ít bánh với năng lực kiểm soát thật.",
    "Chỉ quan sát và hỏi HLV về setup, tải trọng và giới hạn học; cấp Grade trong video không phải đánh giá an toàn của HH.",
    "Thấy tên level thấp rồi bỏ qua nền tảng/giám sát.",
    "Nêu được setup cần xác nhận, không tự thử theo hình ảnh."
  ],
  [
    "slalom-daffy",
    "Daffy · định hướng phối hợp toe/heel",
    "slalom",
    "slalom",
    "advanced",
    [
      "toe-heel",
      "slalom-toe-roll"
    ],
    "Tìm hiểu một mẫu phối hợp khác của họ ít bánh.",
    "Quan sát số bánh tiếp xúc nếu thấy rõ và hỏi HLV cách thuật ngữ được dùng. Không tự nâng bánh ở tốc độ biểu diễn.",
    "Coi hai chân trước–sau là đã hoàn thành Daffy.",
    "Tách được hình dáng quan sát và kỹ thuật cần học trực tiếp."
  ],
  [
    "slalom-symmetry-notes",
    "Ghi chú bên dẫn khi xem Slalom",
    "slalom",
    "slalom",
    "basic",
    [
      "slalom-leading-foot",
      "learning-video"
    ],
    "Không để video gương làm nhầm chân dẫn.",
    "Ghi chân dẫn theo nội dung nhà xuất bản; nếu video bị đảo hoặc không rõ, ghi chưa xác định.",
    "Suy trái/phải chỉ từ vị trí trên màn hình.",
    "Có ghi chú đủ bối cảnh để hỏi lại HLV."
  ],
  [
    "slalom-transition-review",
    "Quan sát điểm nối trong tổ hợp Slalom",
    "slalom",
    "slalom",
    "control",
    [
      "slalom-fish-to-snake",
      "slalom-rhythm"
    ],
    "Chú ý phần chuyển nhịp giữa các mẫu đã học.",
    "Xem chuỗi hoàn chỉnh, ghi điểm chuyển nhìn rõ và phần đã được HLV giao. Không ghép động tác chưa được đánh giá.",
    "Chỉ xem danh sách tên mà bỏ qua đường vào/ra.",
    "Có một câu hỏi về điểm nối phù hợp trình độ."
  ],
  [
    "slalom-spacing-context",
    "Khoảng cọc & bối cảnh video Slalom",
    "slalom",
    "slalom",
    "basic",
    [
      "slalom-setup",
      "cone-lines"
    ],
    "Phân biệt cọc thưa để học với setup theo luật một sự kiện.",
    "Ghi nhà xuất bản có nêu khoảng cọc hay không; chọn sân và khoảng cách với HLV, dùng vật mềm và vùng dừng trống.",
    "Ước lượng từ ảnh rồi áp dụng cho mọi giày/sân.",
    "Nêu được mục đích bài và yếu tố chưa biết."
  ]
];
  const entries=Object.freeze(rows.map(([id,title,category,discipline,level,prerequisites,goal,drill,mistake,check])=>Object.freeze({id,title,category,discipline,level,prerequisites:Object.freeze(prerequisites),goal,drill,mistake,check,coachQuestions:Object.freeze(['Điều kiện và bài nền tảng nào phù hợp với tôi trước khi học nội dung này?']),supervised:true,scope:level==='advanced'?'orientation':'guided-learning',sources:Object.freeze([discipline==='slide'||discipline==='slalom'?'inmove-videos':'skateia-videos',...(discipline==='speed'?['rollerblade-videos']:[])]),authorship:'HH original educational summary · needs coach review',reviewedAt:null})));
  const videos=Object.freeze([
  {
    "id": "ia-ITTEKzSvW-I",
    "youtubeId": "ITTEKzSvW-I",
    "title": "Duck walk · bước nhỏ",
    "originalTitle": "Duck Walk - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "basic",
    "skillIds": [
      "duck-walk",
      "static-steps"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=ITTEKzSvW-I",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Hướng đặt chân và khoảng bước; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-zMiLgmrr68I",
    "youtubeId": "zMiLgmrr68I",
    "title": "Sải tiến cơ bản",
    "originalTitle": "Basic Stride - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "basic",
    "skillIds": [
      "forward-stride"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=zMiLgmrr68I",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Đẩy và thu chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-TzwEKRl7kwI",
    "youtubeId": "TzwEKRl7kwI",
    "title": "Phanh gót · phần 1",
    "originalTitle": "Heel Stop 1 - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "basic",
    "skillIds": [
      "heel-brake"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=TzwEKRl7kwI",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Vị trí chân có phanh; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-8zzd1l0n95Y",
    "youtubeId": "8zzd1l0n95Y",
    "title": "Rẽ chữ A",
    "originalTitle": "A-Frame Turn - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "basic",
    "skillIds": [
      "a-turn"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=8zzd1l0n95Y",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Hướng rẽ và vùng trống; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-XGrDXOd8svE",
    "youtubeId": "XGrDXOd8svE",
    "title": "Lướt một chân",
    "originalTitle": "One Foot Glide - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "one-foot"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=XGrDXOd8svE",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Chân trụ và kết thúc đoạn lướt; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-smQbu_8NHMQ",
    "youtubeId": "smQbu_8NHMQ",
    "title": "Swizzles tiến",
    "originalTitle": "Swizzles - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "forward-swizzles"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=smQbu_8NHMQ",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Nhịp mở–thu hai chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-_HVVy78XhrY",
    "youtubeId": "_HVVy78XhrY",
    "title": "Toe roll · quan sát",
    "originalTitle": "Toe Roll Center Edge - Skating Skills Grade 1",
    "topic": "slalom",
    "level": "advanced",
    "skillIds": [
      "slalom-toe-roll"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=_HVVy78XhrY",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Setup và số bánh tiếp xúc; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-4W7FabsonbQ",
    "youtubeId": "4W7FabsonbQ",
    "title": "Lemon drops",
    "originalTitle": "Lemon Drops - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "lemon-drops"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=4W7FabsonbQ",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Nhịp của hai chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-Yd0M-0DVB9c",
    "youtubeId": "Yd0M-0DVB9c",
    "title": "Swizzles lùi",
    "originalTitle": "Backward Swizzles - Skating Skills Grade 1",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "slalom-back-swizzles"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=Yd0M-0DVB9c",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Tầm nhìn và đường lăn lùi; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-3ccRdpPWzgU",
    "youtubeId": "3ccRdpPWzgU",
    "title": "Swizzles luân phiên",
    "originalTitle": "Alternating Swizzles - Skating Skills Grade 1",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "alternating-swizzles"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=3ccRdpPWzgU",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Chân nhận tải từng nhịp; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-T_52CChqg2g",
    "youtubeId": "T_52CChqg2g",
    "title": "Phanh gót · phần 2",
    "originalTitle": "Heel Stop 2 - Skating Skills Grade 2 + Tricks Level 1",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "heel-brake",
      "stop-zone"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=T_52CChqg2g",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Khác biệt với bài phanh cơ bản; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-y0XmUsZmfOs",
    "youtubeId": "y0XmUsZmfOs",
    "title": "Toe roll các cạnh · quan sát",
    "originalTitle": "Toe Rolls Out and Inside - Skating Skills Grade 2",
    "topic": "slalom",
    "level": "advanced",
    "skillIds": [
      "slalom-toe-roll",
      "edge-control"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=y0XmUsZmfOs",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Mối liên hệ cạnh bánh và tải trọng; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-2WhN5azDDCs",
    "youtubeId": "2WhN5azDDCs",
    "title": "Sải tiến · quan sát mở rộng",
    "originalTitle": "Intermediate Stride A - Skating Skills Grade 2",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "efficient-stride"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=2WhN5azDDCs",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Đường hồi chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "ia-gaqn5vWp9f4",
    "youtubeId": "gaqn5vWp9f4",
    "title": "Daffy · định hướng",
    "originalTitle": "Daffy - Skating Skills Grade 2",
    "topic": "slalom",
    "level": "advanced",
    "skillIds": [
      "slalom-daffy"
    ],
    "publisher": "SkateIA",
    "sourceUrl": "https://www.skateia.org/videos",
    "watchUrl": "https://www.youtube.com/watch?v=gaqn5vWp9f4",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Tải trọng trên ít bánh; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-RAlR16ZguZ8",
    "youtubeId": "RAlR16ZguZ8",
    "title": "Làm quen inline",
    "originalTitle": "HOW TO ROLLERBLADE ON INLINE SKATES",
    "topic": "foundation",
    "level": "basic",
    "skillIds": [
      "ready-stance",
      "forward-stride"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=RAlR16ZguZ8",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Giày, tư thế và hướng di chuyển; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-faSqBPvGrqk",
    "youtubeId": "faSqBPvGrqk",
    "title": "Slalom · bài 1",
    "originalTitle": "Beginner slalom on inline skates - lesson 1",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "cone-lines",
      "slalom-setup"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=faSqBPvGrqk",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Hàng cọc và nhịp; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-AgAhEeayTTQ",
    "youtubeId": "AgAhEeayTTQ",
    "title": "Slalom · bài 2",
    "originalTitle": "Slalom for beginners - Lesson 2",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "fish",
      "snake"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=AgAhEeayTTQ",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Phối hợp hai chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-CGMfmxka6Bg",
    "youtubeId": "CGMfmxka6Bg",
    "title": "Slalom · Cross & Snake",
    "originalTitle": "Slalom for beginners on skates - CRISS-CROSS, SNAKE - Lesson 3",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "slalom-cross",
      "snake"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=CGMfmxka6Bg",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Điểm chuyển và bên dẫn; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-UklyqqoPfCw",
    "youtubeId": "UklyqqoPfCw",
    "title": "Slalom · bài 4",
    "originalTitle": "Freestyle Slalom tutorials - Lesson 4",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "slalom-rhythm",
      "slalom-transition-review"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=UklyqqoPfCw",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Phần chuyển nhịp nhìn thấy; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-ePoaR8GcGu8",
    "youtubeId": "ePoaR8GcGu8",
    "title": "Slalom · bài 5",
    "originalTitle": "Freestyle slalom skating on rollerblades - Lesson 5",
    "topic": "slalom",
    "level": "control",
    "skillIds": [
      "routine-flow",
      "slalom-transition-review"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=ePoaR8GcGu8",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Phần vào/ra chuỗi; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-utACSGeGWYU",
    "youtubeId": "utACSGeGWYU",
    "title": "Dừng inline · bài 0",
    "originalTitle": "How to stop on rollerblades - 0 Lesson",
    "topic": "foundation",
    "level": "control",
    "skillIds": [
      "heel-brake",
      "t-stop"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=utACSGeGWYU",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Loại phanh và điều kiện áp dụng; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "im-bys2c3oJfRI",
    "youtubeId": "bys2c3oJfRI",
    "title": "Slide · Soul / Acid và biến thể",
    "originalTitle": "How to start slides on skates - 1 - Soul, Acid, Soul Wheeling & Acid Wheeling",
    "topic": "slide",
    "level": "advanced",
    "skillIds": [
      "slide-soul",
      "slide-acid",
      "slide-viewing-checklist"
    ],
    "publisher": "InMoveSkates",
    "sourceUrl": "https://www.inmoveskates.com/inline-skates-lessons-in-us",
    "watchUrl": "https://www.youtube.com/watch?v=bys2c3oJfRI",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Toàn lượt và điều kiện sân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "rb-hfOOwxLUsB4",
    "youtubeId": "hfOOwxLUsB4",
    "title": "Speed · định hướng bắt đầu",
    "originalTitle": "Speed Skating: Tips for Beginners",
    "topic": "speed",
    "level": "advanced",
    "skillIds": [
      "speed-basics",
      "speed-posture"
    ],
    "publisher": "Rollerblade",
    "sourceUrl": "https://www.rollerblade.com/usa/en/rollerblade-tv/Advice/speed-skating-tips-for-beginners-2",
    "watchUrl": "https://www.youtube.com/watch?v=hfOOwxLUsB4",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Giày, sân và bối cảnh huấn luyện; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "rb-TO74h-ik1XM",
    "youtubeId": "TO74h-ik1XM",
    "title": "Speed · Jorge Botero 1",
    "originalTitle": "Speed Skating Technique Tips with Jorge Botero #1",
    "topic": "speed",
    "level": "advanced",
    "skillIds": [
      "speed-stride-observation",
      "speed-push"
    ],
    "publisher": "Rollerblade",
    "sourceUrl": "https://www.rollerblade.com/usa/en/rollerblade-tv/Advice/speed-skating-technique-tips-with-jorge-botero-1",
    "watchUrl": "https://www.youtube.com/watch?v=TO74h-ik1XM",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Một chu kỳ sải và phần hồi chân; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  },
  {
    "id": "rb-eNOE3LTM3vU",
    "youtubeId": "eNOE3LTM3vU",
    "title": "Speed · Jorge Botero 2",
    "originalTitle": "Speed Skating Technique Tips with Jorge Botero #2",
    "topic": "speed",
    "level": "advanced",
    "skillIds": [
      "speed-centerline",
      "speed-video-angles"
    ],
    "publisher": "Rollerblade",
    "sourceUrl": "https://www.rollerblade.com/usa/en/rollerblade-tv/Advice/speed-skating-technique-tips-with-jorge-botero-2",
    "watchUrl": "https://www.youtube.com/watch?v=eNOE3LTM3vU",
    "language": "Nguyên bản của nhà xuất bản; chưa xác minh phụ đề tiếng Việt",
    "observations": [
      "Góc quay và chân nhận tải; ghi điều thực sự nhìn thấy, không suy đoán lực/tốc độ.",
      "Quan sát cả phần trước và sau động tác; nếu góc quay che mất, đánh dấu chưa rõ.",
      "Chọn một câu hỏi cho HLV; xem video không đồng nghĩa đã thực hành."
    ],
    "rights": "External publisher video · link / standard embed only · no redistribution license asserted",
    "checkedAt": "2026-10-10"
  }
].map(v=>Object.freeze({...v,skillIds:Object.freeze(v.skillIds),observations:Object.freeze(v.observations)})));
  const sources=Object.freeze([
    {id:'skateia-videos',title:'SkateIA · Inline skills videos',publisher:'SkateIA',url:'https://www.skateia.org/videos',scope:'Video kỹ năng công khai; cấp Grade của nguồn không là đánh giá an toàn HH.',checkedAt:'2026-10-10'},
    {id:'inmove-videos',title:'InMoveSkates · Free lesson examples',publisher:'InMoveSkates',url:'https://www.inmoveskates.com/inline-skates-lessons-in-us',scope:'Các video công khai của nhà xuất bản; không tải hoặc sao chép khóa học.',checkedAt:'2026-10-10'},
    {id:'rollerblade-videos',title:'Rollerblade · Advice & Speed videos',publisher:'Rollerblade',url:'https://www.rollerblade.com/usa/en/rollerblade-tv/Advice',scope:'Video Speed và nền tảng; phải xác nhận điều kiện sân/giày với HLV.',checkedAt:'2026-10-10'}
  ]);
  return Object.freeze({version:1,entries,videos,sources});
});
