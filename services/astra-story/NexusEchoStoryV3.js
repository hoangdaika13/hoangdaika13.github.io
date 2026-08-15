(function initNexusEchoStoryV3(root) {
  "use strict";

  const VERSION = 3;
  const CHARACTER_IDS = Object.freeze(["lyra", "cael", "nyx", "sol"]);
  const RESPONSE_TYPES = Object.freeze(["truth", "mercy", "duty"]);

  const CHARACTERS = Object.freeze({
    lyra: Object.freeze({
      id: "lyra", name: "Nax Veyra", epithet: "Chiếc chìa khóa sống",
      conflict: "Mỗi lần cộng hưởng với Nexus, Nax cứu được người khác nhưng mất thêm một phần ký ức riêng.",
      secret: "Cơ thể Nax được tái tạo từ Nexus Prime; ý thức hiện tại là một con người mới, không phải bản sao có nghĩa vụ chết thay bản gốc.",
      skill: "Memory Anchor · đồng đội ngăn Ultimate xóa ký ức quan trọng khi Trust đạt 70.",
      milestones: Object.freeze([
        Object.freeze({ trust: 10, title: "Tên cũ", line: "Có một con quái vật gọi tôi bằng cái tên chưa từng xuất hiện trong hồ sơ." }),
        Object.freeze({ trust: 30, title: "Khoảng trống sau Ultimate", line: "Mỗi lần giải phóng Plasma, tôi nhớ rõ chiến trường hơn… nhưng lại quên mất giọng của chính mình." }),
        Object.freeze({ trust: 50, title: "Không phải vật chứa", line: "Nếu ký ức tạo nên con người, tôi vẫn có quyền chọn ký ức nào trở thành mình." }),
        Object.freeze({ trust: 70, title: "Neo ký ức", line: "Khi ba người gọi tên tôi, Nexus Prime không thể kéo tôi biến mất." }),
        Object.freeze({ trust: 90, title: "Người Gác đầu tiên", line: "Tôi sẽ giữ cánh cửa mở để người sống đối thoại với quá khứ, không để ai sở hữu nó." })
      ])
    }),
    cael: Object.freeze({
      id: "cael", name: "Cael Aurora", epithet: "Người đã bóp cò",
      conflict: "Cael từng thi hành chiến dịch xóa một hành tinh rồi bị Hội đồng Helios chỉnh sửa trí nhớ.",
      secret: "Gia đình Cael là cư dân của hành tinh bị xóa; lệnh khai hỏa đã được ký bằng sinh trắc học của chính cô.",
      skill: "Witness Protocol · đánh dấu bằng chứng giả và mở phản đòn tầm xa khi Trust đạt 70.",
      milestones: Object.freeze([
        Object.freeze({ trust: 10, title: "Mệnh lệnh trắng", line: "Tôi nhớ cò súng lạnh hơn băng. Tôi không nhớ mục tiêu ở phía bên kia." }),
        Object.freeze({ trust: 30, title: "Danh sách hành khách", line: "Tên cha mẹ tôi nằm trong danh sách sơ tán… nhưng con tàu chưa từng rời mặt đất." }),
        Object.freeze({ trust: 50, title: "Chữ ký của tôi", line: "Helios không điều khiển tay tôi. Tôi đã làm theo vì tin rằng phục tùng là vô tội." }),
        Object.freeze({ trust: 70, title: "Nhân chứng sống", line: "Tôi sẽ tự đọc lời khai trước H-Central, kể cả khi họ gọi tôi là kẻ phản bội." }),
        Object.freeze({ trust: 90, title: "Không xóa thêm ai", line: "Trách nhiệm không đưa người chết trở lại, nhưng nó ngăn chúng ta giết họ lần thứ hai bằng sự im lặng." })
      ])
    }),
    nyx: Object.freeze({
      id: "nyx", name: "Nyx Veyra", epithet: "Người nghe thấy vực sâu",
      conflict: "Nyx nghe được ngôn ngữ Nexus và che giấu quá trình Nexus hóa đang lan dần trên cơ thể.",
      secret: "Nexus không xem Nyx là kẻ thù; cô là cầu nối tự nhiên đầu tiên giữa ký ức tập thể và người sống.",
      skill: "Silent Communion · vô hiệu hóa một đợt tấn công Nexus mà không tiêu diệt mục tiêu khi Trust đạt 70.",
      milestones: Object.freeze([
        Object.freeze({ trust: 10, title: "Chúng không gầm", line: "Âm thanh mọi người gọi là tiếng gầm thực ra là hàng nghìn người cùng nói: đừng quên tôi." }),
        Object.freeze({ trust: 30, title: "Vết sáng dưới da", line: "Tôi không bị nhiễm bệnh. Tôi đang trở thành thứ mà H-Central sợ phải gọi bằng tên." }),
        Object.freeze({ trust: 50, title: "Ngôn ngữ của tro", line: "Nexus không cần được thả tự do. Họ cần một người chịu lắng nghe mà không khai thác." }),
        Object.freeze({ trust: 70, title: "Cầu nối", line: "Tôi có thể giữ cánh cửa giữa hai phía, nhưng chỉ khi các bạn không kéo tôi về bằng sợ hãi." }),
        Object.freeze({ trust: 90, title: "Một cơ thể, hai thời đại", line: "Tôi không còn phải chọn làm người hay Nexus. Tôi là bằng chứng rằng cả hai có thể cùng tồn tại." })
      ])
    }),
    sol: Object.freeze({
      id: "sol", name: "Sol Riven", epithet: "Người thừa kế mặt trời",
      conflict: "Dòng máu Sol duy trì phong ấn bảo vệ hiện tại nhưng cũng giam ký ức của những nền văn minh đã mất.",
      secret: "Triều đại Riven xây H-Central trên lõi của một mặt trời có tri giác và biến lời cầu cứu của nó thành nguồn điện.",
      skill: "Unchained Dawn · tạo vùng sáng làm lộ điểm yếu thay vì thiêu hủy Nexus khi Trust đạt 70.",
      milestones: Object.freeze([
        Object.freeze({ trust: 10, title: "Bài thánh ca thiếu một câu", line: "Gia tộc tôi hát về mặt trời chiến thắng. Bản ghi cổ lại gọi đó là một vụ hành quyết." }),
        Object.freeze({ trust: 30, title: "Vương miện là ổ khóa", line: "Phong ấn nhận máu tôi như mật khẩu. Không ai từng hỏi tôi có muốn giữ nó hay không." }),
        Object.freeze({ trust: 50, title: "Ánh sáng vay mượn", line: "H-Central rực rỡ vì một vì sao bị buộc phải cháy cho chúng ta." }),
        Object.freeze({ trust: 70, title: "Bình minh không xiềng", line: "Tôi sẽ mở phong ấn theo nhịp, đủ để ký ức thở mà không thiêu rụi người sống." }),
        Object.freeze({ trust: 90, title: "Người thừa kế cuối cùng", line: "Danh dự cuối cùng của Riven là chấm dứt quyền sở hữu mặt trời." })
      ])
    })
  });

  const FACTIONS = Object.freeze([
    Object.freeze({ id: "helios-council", name: "Hội đồng Helios", color: "#ffd36b", doctrine: "Duy trì năng lượng Nexus để bảo vệ các thuộc địa hiện tại.", cost: "Hòa bình tiếp tục dựa trên kiểm duyệt ký ức và lao động của người chết.", truth: "Nếu lò phản ứng tắt đột ngột, bệnh viện và cổng sinh tồn của nhiều thuộc địa sẽ dừng trong vài phút." }),
    Object.freeze({ id: "ash-choir", name: "Ca đoàn Tro Tàn", color: "#ff6f9f", doctrine: "Giải phóng toàn bộ ký ức bị giam và trả lịch sử cho người đã mất.", cost: "Giải phóng không kiểm soát có thể ghi đè hiện tại bằng hàng tỷ ký ức sang chấn.", truth: "Nhiều thành viên là hậu duệ của các hành tinh bị xóa; họ không chiến đấu chỉ vì báo thù." }),
    Object.freeze({ id: "silent-wardens", name: "Người Gác Khoảng Lặng", color: "#74efcf", doctrine: "Chữa lành Nexus và xây giao thức đối thoại thay cho khai thác hoặc phá phong ấn.", cost: "Giải pháp chậm, khó và buộc mọi phía chia sẻ quyền kiểm soát.", truth: "Họ đã âm thầm giữ Nexus Prime ngủ yên nhiều thế hệ nhưng cũng che giấu sự thật với người dân." })
  ]);

  const CHAPTERS = Object.freeze([
    Object.freeze({ number: 1, id: "the-monster-knew-my-name", zoneId: "central", title: "Con quái vật gọi tên tôi", subtitle: "Giấy phép được viết bằng sự im lặng", theme: "Danh tính", premise: "Trong cuộc săn đầu tiên, một Nexus hạ vũ khí và gọi Nax bằng tên đã bị xóa khỏi hồ sơ.", objective: "Hoàn thành bài săn, giữ lại lõi ký ức và đối chiếu lệnh tiêu hủy của H-Central.", reveal: "Nexus là ký ức sống, không phải một giống loài xâm lược.", bossId: "nameless-herald", cityPhase: "official-order", memoryIds: Object.freeze(["c1-order", "c1-voice", "c1-city"]), dilemmaId: "dilemma-first-core" }),
    Object.freeze({ number: 2, id: "the-city-without-shadows", zoneId: "aurora", title: "Thành phố không có bóng", subtitle: "Người sống bình yên vì không thể nhớ người chết", theme: "Đau buồn", premise: "Cư dân Aurora mất ký ức về người thân; mỗi đêm bóng của họ rời cơ thể và tụ thành Nexus.", objective: "Theo dấu các bóng, phục hồi hồ sơ dân cư và đối mặt Người Mẹ Không Mặt.", reveal: "H-Central đã dùng lưới năng lượng để thu hoạch ký ức đau buồn của cả thành phố.", bossId: "faceless-mother", cityPhase: "public-unease", memoryIds: Object.freeze(["c2-census", "c2-lullaby", "c2-mirror"]), dilemmaId: "dilemma-painful-memory" }),
    Object.freeze({ number: 3, id: "four-testimonies", zoneId: "crimson", title: "Bốn lời khai", subtitle: "Một sự kiện, bốn ký ức đều mang dấu vết chỉnh sửa", theme: "Trách nhiệm", premise: "Nax, Cael, Nyx và Sol nhìn thấy bốn phiên bản mâu thuẫn của chiến dịch đã xóa hành tinh Cael.", objective: "Bảo vệ nhân chứng, ghép dấu thời gian và tìm phần mà cả bốn lời khai đều cố tránh.", reveal: "Cael đã khai hỏa theo lệnh; gia đình cô vẫn còn trên hành tinh và Hội đồng đã sửa ký ức sau đó.", bossId: "king-of-the-lost-city", cityPhase: "underground-whispers", memoryIds: Object.freeze(["c3-cael", "c3-helios", "c3-passengers"]), dilemmaId: "dilemma-cael-testimony" }),
    Object.freeze({ number: 4, id: "weapons-that-weep", zoneId: "void", title: "Vũ khí biết khóc", subtitle: "Mỗi lưỡi kiếm là một ký ức bị ép thành công cụ", theme: "Đồng lõa", premise: "Vũ khí Astral phát lại cảm xúc của các lõi Nexus đã bị dùng để chế tạo chúng.", objective: "Sống sót khi vũ khí bị chiếm quyền, phá dây chuyền lõi và chiến đấu bằng môi trường cùng đồng đội.", reveal: "Nền kinh tế Thợ săn được xây từ ký ức của chính những sinh vật họ được lệnh tiêu diệt.", bossId: "hunter-zero", cityPhase: "censorship", memoryIds: Object.freeze(["c4-forge-ledger", "c4-weapon-cry", "c4-nyx"]), dilemmaId: "dilemma-astral-weapons" }),
    Object.freeze({ number: 5, id: "war-for-h-central", zoneId: "sky", title: "Cuộc chiến H-Central", subtitle: "Sự thật không tự động tạo ra công lý", theme: "Hòa bình", premise: "Hồ sơ Nexus bị công bố; dân chúng, Thợ săn, Helios và Ca đoàn Tro Tàn chia thành các tuyến đối đầu.", objective: "Giữ bệnh viện hoạt động, ngăn thảm sát và đưa ba phe vào cùng một phòng đối thoại.", reveal: "Không phe nào có thể cứu thiên hà một mình; cả ba đều nắm một phần giải pháp và một phần tội lỗi.", bossId: "million-voice-choir", cityPhase: "schism", memoryIds: Object.freeze(["c5-broadcast", "c5-hospital", "c5-choir"]), dilemmaId: "dilemma-city-blackout" }),
    Object.freeze({ number: 6, id: "the-planet-that-died-tomorrow", zoneId: "ocean", title: "Hành tinh ngày mai đã chết", subtitle: "Ba tương lai đều có người bị xóa", theme: "Hậu quả", premise: "Một hành tinh đảo thời gian cho đội hình nhìn thấy kết quả cực đoan của từng kế hoạch.", objective: "Đóng các vòng lặp, cứu những người chưa chết và mang về một giao thức chuyển đổi có kiểm soát.", reveal: "Nax tương lai đã đi qua cả ba kết cục và bắt đầu tin rằng xóa đau khổ là cách duy nhất.", bossId: "chained-sun", cityPhase: "rolling-blackout", memoryIds: Object.freeze(["c6-helios-future", "c6-choir-future", "c6-prime-future"]), dilemmaId: "dilemma-future-cost" }),
    Object.freeze({ number: 7, id: "the-last-hunter", zoneId: "station", title: "Người săn cuối cùng", subtitle: "Kẻ hiểu bạn nhất là phiên bản đã từ bỏ hy vọng", theme: "Tự do ý chí", premise: "Thợ săn Số 0 lộ diện là Nax tương lai, đã học mọi combo và lựa chọn chiến đấu của người chơi.", objective: "Phá vòng lặp dự đoán, giải phóng Sol khỏi phong ấn và chứng minh đau khổ không phải lỗi cần xóa.", reveal: "Nax tương lai gửi tín hiệu về quá khứ không để được cứu, mà để tạo ra một Nax đủ khác mình.", bossId: "future-nax", cityPhase: "orbital-siege", memoryIds: Object.freeze(["c7-sequence", "c7-luma", "c7-future-nax"]), dilemmaId: "dilemma-future-self" }),
    Object.freeze({ number: 8, id: "memory-of-a-star", zoneId: "abyss", title: "Ký ức của một vì sao", subtitle: "Quá khứ không sống lại; nó được quyền lên tiếng", theme: "Hòa giải", premise: "Đội hình vừa chiến đấu vừa ghép lịch sử thiên hà, trong khi Nexus Prime và H-Central cùng đứng trước nguy cơ sụp đổ.", objective: "Chuyển H-Central thành Kho Lưu Trữ Sống và giữ Nax ở lại bằng ký ức của ba đồng đội.", reveal: "Nexus được chữa lành bằng quyền được ghi nhớ, không bằng tiêu diệt, sở hữu hoặc giải phóng hỗn loạn.", bossId: "nexus-prime", cityPhase: "living-archive", memoryIds: Object.freeze(["c8-star-name", "c8-three-anchors", "c8-living-archive"]), dilemmaId: "dilemma-living-archive" })
  ]);

  const BOSSES = Object.freeze({
    "nameless-herald": Object.freeze({ id: "nameless-herald", name: "Sứ giả Không Tên", chapter: 1, mechanic: "Ngừng tấn công ở marker gọi tên để nghe ký ức; đánh liên tục sẽ mất manh mối phụ.", firstView: "Mục tiêu thử nghiệm vượt kiểm soát.", trueView: "Người đưa tin cuối cùng của thành phố bị xóa." }),
    "faceless-mother": Object.freeze({ id: "faceless-mother", name: "Người Mẹ Không Mặt", chapter: 2, mechanic: "Tạo bản sao đồng đội từ ký ức tội lỗi; nhận diện người thật bằng câu thoại và animation riêng.", firstView: "Thực thể hút ký ức cư dân Aurora.", trueView: "Hợp thể của những người mẹ bị buộc quên tên con." }),
    "king-of-the-lost-city": Object.freeze({ id: "king-of-the-lost-city", name: "Vua Thành Phố Đã Mất", chapter: 3, mechanic: "Mỗi ngưỡng HP phục dựng một thời điểm quá khứ và thay đổi địa hình, nhân chứng cùng mục tiêu bảo vệ.", firstView: "Bóng ma giữ hồ sơ quân sự.", trueView: "Nhân chứng đã phân mảnh bản thân để hồ sơ không bị Helios xóa hoàn toàn." }),
    "hunter-zero": Object.freeze({ id: "hunter-zero", name: "Thợ Săn Số 0", chapter: 4, mechanic: "Chiếm quyền vũ khí; người chơi phải né, kích hoạt môi trường và ra lệnh phối hợp cho đội hình.", firstView: "Nguyên mẫu Thợ săn phản loạn.", trueView: "Bộ khung dùng để huấn luyện Nax tương lai bằng dữ liệu chiến đấu của các Thợ săn đã chết." }),
    "million-voice-choir": Object.freeze({ id: "million-voice-choir", name: "Ca Đoàn Một Triệu Giọng", chapter: 5, mechanic: "Nhịp đánh, phụ đề người nói và pha âm thanh quyết định cửa sổ phản đòn; có chế độ hình ảnh cho người không nghe được.", firstView: "Vũ khí âm thanh của Tro Tàn.", trueView: "Một triệu lời khai bị phát cùng lúc vì không ai từng cho họ thời gian nói riêng." }),
    "chained-sun": Object.freeze({ id: "chained-sun", name: "Mặt Trời Bị Xiềng", chapter: 6, mechanic: "Sol điều khiển gương sáng để mở điểm yếu; gây damage sai pha làm phong ấn nóng lên và đổi tương lai đấu trường.", firstView: "Lò phản ứng sao mất ổn định.", trueView: "Một trí tuệ cổ bị triều Riven biến thành hạ tầng năng lượng." }),
    "future-nax": Object.freeze({ id: "future-nax", name: "Nax Tương Lai", chapter: 7, mechanic: "Đọc lịch sử combo, dodge và vũ khí của người chơi; phải thay nhịp, phối hợp đồng đội và dùng hành động ít sử dụng.", firstView: "Kẻ giả mạo Nax điều khiển Nexus.", trueView: "Một Nax đã cứu thiên hà vô số lần và mất niềm tin sau mỗi vòng lặp." }),
    "nexus-prime": Object.freeze({ id: "nexus-prime", name: "Nexus Prime · Kho Ký Ức", chapter: 8, mechanic: "Không có thanh HP truyền thống; ổn định các lời khai mâu thuẫn, giữ ba Memory Anchor và ngăn lõi bị ba phe chiếm quyền.", firstView: "Nguồn gốc của mọi Nexus.", trueView: "Kho lưu trữ tự vệ của các nền văn minh bị xóa, đang phản ứng với hàng thế kỷ bị khai thác." })
  });

  const MEMORIES = Object.freeze(CHAPTERS.flatMap((chapter) => [
    Object.freeze({ id: chapter.memoryIds[0], chapter: chapter.number, zoneId: chapter.zoneId, kind: "archive", title: `${chapter.title} · Hồ sơ`, text: chapter.premise, source: "scan" }),
    Object.freeze({ id: chapter.memoryIds[1], chapter: chapter.number, zoneId: chapter.zoneId, kind: "echo", title: `${chapter.title} · Tiếng vọng`, text: chapter.reveal, source: "hunt" }),
    Object.freeze({ id: chapter.memoryIds[2], chapter: chapter.number, zoneId: chapter.zoneId, kind: "testimony", title: `${chapter.title} · Lời khai`, text: chapter.objective, source: "boss" })
  ]));
  const MEMORY_MAP = Object.freeze(Object.fromEntries(MEMORIES.map((entry) => [entry.id, entry])));

  const CONTRADICTIONS = Object.freeze([
    Object.freeze({ id: "contradiction-invasion", requires: Object.freeze(["c1-order", "c1-voice"]), title: "Xâm lược hay cầu cứu?", question: "Lệnh Helios gọi Nexus là quân xâm lược, nhưng tiếng vọng đầu tiên chỉ yêu cầu được ghi nhớ." }),
    Object.freeze({ id: "contradiction-aurora", requires: Object.freeze(["c2-census", "c2-lullaby"]), title: "Không có thương vong?", question: "Hộ tịch ghi không ai mất tích trong khi bài ru có hàng nghìn tên trẻ em bị xóa." }),
    Object.freeze({ id: "contradiction-cael", requires: Object.freeze(["c3-cael", "c3-passengers"]), title: "Con tàu đã rời đi?", question: "Lời khai Cael nhớ thấy tàu sơ tán cất cánh; danh sách động cơ chứng minh nó chưa từng khởi động." }),
    Object.freeze({ id: "contradiction-weapons", requires: Object.freeze(["c4-forge-ledger", "c4-weapon-cry"]), title: "Vật liệu vô tri?", question: "Sổ lò rèn gọi lõi là nhiên liệu, nhưng mỗi vũ khí giữ một cảm xúc và một cái tên." }),
    Object.freeze({ id: "contradiction-peace", requires: Object.freeze(["c5-hospital", "c5-choir"]), title: "Tắt lò hay giữ xiềng?", question: "Bệnh viện cần năng lượng ngay hôm nay; người chết cũng không thể tiếp tục bị dùng mãi mãi." }),
    Object.freeze({ id: "contradiction-futures", requires: Object.freeze(["c6-helios-future", "c6-choir-future", "c6-prime-future"]), title: "Không có tương lai sạch", question: "Cả kiểm soát, giải phóng cực đoan và viết lại thời gian đều xóa một nhóm người khác." }),
    Object.freeze({ id: "contradiction-signal", requires: Object.freeze(["c7-sequence", "c7-future-nax"]), title: "Ai gửi tín hiệu?", question: "Tín hiệu không phải lời cầu cứu của nạn nhân, mà là phép thử của người đã trở thành phản diện." }),
    Object.freeze({ id: "contradiction-prime", requires: Object.freeze(["c8-star-name", "c8-living-archive"]), title: "Cỗ máy hay cộng đồng?", question: "Nexus Prime có kiến trúc máy móc nhưng chứa ý chí và quyền được đồng thuận của hàng tỷ con người." })
  ]);

  const SIDE_QUESTS = Object.freeze([
    Object.freeze({ id: "wife-in-the-core", chapter: 2, zoneId: "aurora", title: "Người vợ trong lõi", summary: "Tìm người vợ đã mất của Orin, người chỉ còn tồn tại như một Echo có ý thức.", objectives: Object.freeze([{ type: "scan", zoneId: "aurora", text: "Quét hộ tịch Aurora" }, { type: "hunt", zoneId: "aurora", text: "Thu hồi lõi không phá hủy" }, { type: "talk", characterId: "nyx", text: "Nhờ Nyx phiên dịch lời từ biệt" }]), rewardMemoryId: "c2-lullaby", trust: Object.freeze({ nyx: 8 }) }),
    Object.freeze({ id: "guardian-of-the-old-school", chapter: 2, zoneId: "aurora", title: "Người bảo vệ ngôi trường cũ", summary: "Chứng minh Nexus tại trường học đang bảo vệ ký ức trẻ em, không săn cư dân.", objectives: Object.freeze([{ type: "travel", zoneId: "aurora", text: "Tới khu trường cũ" }, { type: "scan", zoneId: "aurora", text: "Đọc tín hiệu phòng thủ" }, { type: "restore", zoneId: "aurora", text: "Khôi phục vùng an toàn" }]), rewardMemoryId: "c2-census", trust: Object.freeze({ lyra: 4, cael: 4 }) }),
    Object.freeze({ id: "the-truth-that-hurts", chapter: 3, zoneId: "crimson", title: "Sự thật gây đau", summary: "Trả lại ký ức chiến dịch cho một nhân chứng hoặc để họ tiếp tục sống trong bản ghi đã chỉnh sửa.", objectives: Object.freeze([{ type: "talk", characterId: "cael", text: "Nghe lời khai Cael" }, { type: "scan", zoneId: "crimson", text: "Khôi phục hộp đen" }]), rewardMemoryId: "c3-cael", trust: Object.freeze({ cael: 9 }) }),
    Object.freeze({ id: "armor-with-a-childs-voice", chapter: 4, zoneId: "void", title: "Bộ giáp mang giọng một đứa trẻ", summary: "Một Thợ săn phát hiện lõi trong áo giáp chứa ký ức con trai mình.", objectives: Object.freeze([{ type: "hunt", zoneId: "void", text: "Vô hiệu hóa bộ giáp" }, { type: "scan", zoneId: "void", text: "Tách chữ ký ký ức" }, { type: "talk", characterId: "nyx", text: "Để Nyx xác nhận danh tính" }]), rewardMemoryId: "c4-weapon-cry", trust: Object.freeze({ nyx: 7, sol: 3 }) }),
    Object.freeze({ id: "little-echo", chapter: 4, zoneId: "void", title: "Echo nhỏ học cách nói", summary: "Một Nexus nhỏ theo đội hình và học gọi tên đồ vật thay vì sao chép tiếng cầu cứu.", objectives: Object.freeze([{ type: "travel", zoneId: "void", text: "Để Echo theo đội" }, { type: "talk", characterId: "lyra", text: "Dạy Echo một cái tên" }, { type: "restore", zoneId: "void", text: "Mở nơi trú ẩn cho Echo" }]), rewardMemoryId: "c4-nyx", trust: Object.freeze({ lyra: 6, nyx: 6 }) }),
    Object.freeze({ id: "festival-for-no-disaster", chapter: 5, zoneId: "sky", title: "Lễ tưởng niệm thảm họa không tồn tại", summary: "Điều tra một lễ hội mà lịch sử chính thức khẳng định không có nạn nhân.", objectives: Object.freeze([{ type: "travel", zoneId: "sky", text: "Tham dự lễ tưởng niệm" }, { type: "scan", zoneId: "sky", text: "Đối chiếu danh sách đèn tưởng niệm" }, { type: "restore", zoneId: "sky", text: "Phát lại tên người mất" }]), rewardMemoryId: "c5-broadcast", trust: Object.freeze({ cael: 5, sol: 5 }) }),
    Object.freeze({ id: "victim-and-killer", chapter: 7, zoneId: "station", title: "Nạn nhân và thủ phạm là một người", summary: "Điều tra hai ký ức tách ra từ cùng một người trong vòng lặp của Nax tương lai.", objectives: Object.freeze([{ type: "scan", zoneId: "station", text: "Tách hai timestamp" }, { type: "boss", zoneId: "station", text: "Đối mặt Nax tương lai" }, { type: "talk", characterId: "lyra", text: "Chấp nhận cả hai lời khai" }]), rewardMemoryId: "c7-future-nax", trust: Object.freeze({ lyra: 10 }) })
  ]);
  const SIDE_QUEST_MAP = Object.freeze(Object.fromEntries(SIDE_QUESTS.map((quest) => [quest.id, quest])));

  const DILEMMAS = Object.freeze(CHAPTERS.map((chapter) => Object.freeze({
    id: chapter.dilemmaId,
    chapter: chapter.number,
    prompt: [
      "Bạn giữ lõi ký ức như bằng chứng hay giao ngay cho H-Central?",
      "Bạn trả lại ký ức đau buồn hay bảo vệ sự bình yên tạm thời của cư dân?",
      "Bạn công bố lời khai của Cael hay cho cô thời gian tự đứng ra nhận trách nhiệm?",
      "Bạn ngừng dùng vũ khí Nexus ngay hay tiếp tục dùng chúng để cứu người trong lúc tìm giải pháp?",
      "Bạn ưu tiên điện cho bệnh viện hay phát sóng hồ sơ trước khi Helios xóa chúng?",
      "Bạn mang về tương lai nào như lời cảnh báo cho ba phe?",
      "Bạn đối xử với Nax tương lai như kẻ thù hay một nhân chứng đã gãy vỡ?",
      "Ai có quyền quản trị Kho Lưu Trữ Sống?"
    ][chapter.number - 1],
    options: Object.freeze([
      Object.freeze({ id: "truth", label: "Đặt sự thật lên bàn", effect: "Mở thêm đối thoại điều tra; Cael và Nyx tin tưởng hơn.", trust: Object.freeze({ cael: 4, nyx: 4 }), insight: Object.freeze({ "ash-choir": 2 }) }),
      Object.freeze({ id: "mercy", label: "Giảm tổn thương trước", effect: "Giữ an toàn cho người liên quan; Nax và Sol tin tưởng hơn.", trust: Object.freeze({ lyra: 4, sol: 4 }), insight: Object.freeze({ "silent-wardens": 2 }) }),
      Object.freeze({ id: "duty", label: "Giữ hệ thống hoạt động", effect: "Bảo vệ hạ tầng hiện tại trong lúc thu thập thêm chứng cứ.", trust: Object.freeze({ sol: 3, cael: 2 }), insight: Object.freeze({ "helios-council": 2 }) })
    ])
  })));
  const DILEMMA_MAP = Object.freeze(Object.fromEntries(DILEMMAS.map((entry) => [entry.id, entry])));

  const BANTER = Object.freeze(CHAPTERS.flatMap((chapter) => [
    Object.freeze({ id: `banter-${chapter.number}-a`, chapter: chapter.number, zoneId: chapter.zoneId, speakers: Object.freeze(["lyra", "nyx"]), line: `Nax: "Nếu đó là ký ức, tại sao nó biết tôi?" · Nyx: "Có lẽ câu đúng là: tại sao cô lại không nhớ nó?"` }),
    Object.freeze({ id: `banter-${chapter.number}-b`, chapter: chapter.number, zoneId: chapter.zoneId, speakers: Object.freeze(["cael", "sol"]), line: `Cael: "Mệnh lệnh luôn có chữ ký." · Sol: "Và đôi khi cả một triều đại dành nhiều thế kỷ để giấu người đã ký."` })
  ]));

  const CITY_PHASES = Object.freeze({
    "official-order": Object.freeze({ label: "Trật tự chính thức", signal: "Áp phích Helios gọi mọi Nexus là mục tiêu tiêu hủy.", accent: "#6feeff" }),
    "public-unease": Object.freeze({ label: "Bất an công khai", signal: "Tên người mất bắt đầu xuất hiện trên tường thành phố.", accent: "#79d9ff" }),
    "underground-whispers": Object.freeze({ label: "Lời khai dưới lòng đất", signal: "Đài phát lậu phát những hồ sơ mà Helios phủ nhận.", accent: "#a986ff" }),
    censorship: Object.freeze({ label: "Kiểm duyệt", signal: "Máy quét vũ khí và trạm xóa ký ức xuất hiện ở quảng trường.", accent: "#ffb36b" }),
    schism: Object.freeze({ label: "Thành phố chia rẽ", signal: "Biểu tình, trạm cứu hộ và quân đội chia H-Central thành ba vành đai.", accent: "#ff6f9f" }),
    "rolling-blackout": Object.freeze({ label: "Cắt điện luân phiên", signal: "Bệnh viện được ưu tiên trong khi tháp quảng cáo Helios tắt dần.", accent: "#ffd36b" }),
    "orbital-siege": Object.freeze({ label: "Phong tỏa quỹ đạo", signal: "Tàu Helios và Tro Tàn đối đầu trên bầu trời H-Central.", accent: "#ff805f" }),
    "living-archive": Object.freeze({ label: "Kho Lưu Trữ Sống", signal: "Tên người đã mất được chiếu cạnh tên người đang sống, không còn bị dùng làm nhiên liệu.", accent: "#65f1c7" })
  });

  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function uniqueKnown(values, lookup, limit = 100) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "")).filter((id) => lookup[id]))].slice(-limit);
  }
  function questDefaults() {
    return Object.fromEntries(SIDE_QUESTS.map((quest) => [quest.id, { status: "locked", objective: 0, startedAt: "", completedAt: "" }]));
  }
  function createState() {
    return {
      version: VERSION,
      revealedMemories: [],
      contradictions: [],
      responses: {},
      companionTrust: { lyra: 10, cael: 0, nyx: 0, sol: 0 },
      conversationsSeen: [],
      banterSeen: [],
      banterLog: [],
      bossCodex: {},
      sideQuests: questDefaults(),
      factionInsight: { "helios-council": 0, "ash-choir": 0, "silent-wardens": 0 },
      cityPhase: CHAPTERS[0].cityPhase,
      lastEventAt: ""
    };
  }
  function normalizeState(input) {
    const base = createState();
    const raw = input && typeof input === "object" ? input : {};
    const revealedMemories = uniqueKnown(raw.revealedMemories, MEMORY_MAP, MEMORIES.length);
    const contradictionLookup = Object.fromEntries(CONTRADICTIONS.map((entry) => [entry.id, entry]));
    const conversationsLookup = Object.fromEntries(Object.values(CHARACTERS).flatMap((character) => character.milestones.map((milestone) => [`${character.id}:${milestone.trust}`, milestone])));
    const banterLookup = Object.fromEntries(BANTER.map((entry) => [entry.id, entry]));
    const responses = Object.fromEntries(Object.entries(raw.responses || {}).filter(([id, response]) => DILEMMA_MAP[id] && RESPONSE_TYPES.includes(response)).slice(-8));
    const sideQuests = Object.fromEntries(SIDE_QUESTS.map((quest) => {
      const record = raw.sideQuests?.[quest.id] || {};
      const objective = clamp(record.objective, 0, quest.objectives.length);
      const status = ["locked", "available", "active", "completed"].includes(record.status) ? record.status : "locked";
      return [quest.id, {
        status: objective >= quest.objectives.length || status === "completed" ? "completed" : status,
        objective,
        startedAt: String(record.startedAt || "").slice(0, 40),
        completedAt: String(record.completedAt || "").slice(0, 40)
      }];
    }));
    const bossCodex = Object.fromEntries(Object.entries(raw.bossCodex || {}).filter(([id]) => BOSSES[id]).slice(-8).map(([id, value]) => [id, {
      encounters: clamp(value?.encounters, 0, 999),
      understood: value?.understood === true,
      updatedAt: String(value?.updatedAt || "").slice(0, 40)
    }]));
    return {
      version: VERSION,
      revealedMemories,
      contradictions: uniqueKnown(raw.contradictions, contradictionLookup, CONTRADICTIONS.length),
      responses,
      companionTrust: Object.fromEntries(CHARACTER_IDS.map((id) => [id, clamp(raw.companionTrust?.[id] ?? base.companionTrust[id], 0, 100)])),
      conversationsSeen: uniqueKnown(raw.conversationsSeen, conversationsLookup, 40),
      banterSeen: uniqueKnown(raw.banterSeen, banterLookup, BANTER.length),
      banterLog: (Array.isArray(raw.banterLog) ? raw.banterLog : []).filter((entry) => banterLookup[entry?.id]).slice(-12).map((entry) => ({ id: entry.id, at: String(entry.at || "").slice(0, 40) })),
      bossCodex,
      sideQuests,
      factionInsight: Object.fromEntries(FACTIONS.map((faction) => [faction.id, clamp(raw.factionInsight?.[faction.id], 0, 100)])),
      cityPhase: CITY_PHASES[raw.cityPhase] ? raw.cityPhase : base.cityPhase,
      lastEventAt: String(raw.lastEventAt || "").slice(0, 40)
    };
  }
  function updateContradictions(state) {
    const revealed = new Set(state.revealedMemories);
    for (const contradiction of CONTRADICTIONS) {
      if (contradiction.requires.every((id) => revealed.has(id)) && !state.contradictions.includes(contradiction.id)) state.contradictions.push(contradiction.id);
    }
    state.contradictions = state.contradictions.slice(-CONTRADICTIONS.length);
  }
  function revealMemory(state, memoryId) {
    if (!MEMORY_MAP[memoryId] || state.revealedMemories.includes(memoryId)) return false;
    state.revealedMemories.push(memoryId);
    state.revealedMemories = state.revealedMemories.slice(-MEMORIES.length);
    updateContradictions(state);
    return true;
  }
  function unlockAvailableQuests(state, chapter) {
    for (const quest of SIDE_QUESTS) {
      if (quest.chapter <= chapter && state.sideQuests[quest.id].status === "locked") state.sideQuests[quest.id].status = "available";
    }
  }
  function objectiveMatches(objective, event) {
    if (!objective || objective.type !== event.type) return false;
    if (objective.zoneId && objective.zoneId !== event.zoneId) return false;
    if (objective.characterId && objective.characterId !== event.characterId) return false;
    return true;
  }
  function recordEvent(input, event = {}) {
    const state = normalizeState(input);
    const chapter = clamp(event.chapter, 1, CHAPTERS.length);
    const chapterData = CHAPTERS[chapter - 1];
    const unlockedMemories = [];
    const completedQuests = [];
    const advancedQuests = [];
    unlockAvailableQuests(state, chapter);
    const memoryId = event.type === "scan" ? chapterData.memoryIds[0] : event.type === "hunt" ? chapterData.memoryIds[1] : event.type === "boss" ? chapterData.memoryIds[2] : "";
    if (event.zoneId === chapterData.zoneId && revealMemory(state, memoryId)) unlockedMemories.push(memoryId);
    if (event.type === "boss" && BOSSES[chapterData.bossId]) {
      const current = state.bossCodex[chapterData.bossId] || { encounters: 0, understood: false, updatedAt: "" };
      current.encounters += 1;
      current.understood = true;
      current.updatedAt = String(event.at || new Date().toISOString()).slice(0, 40);
      state.bossCodex[chapterData.bossId] = current;
    }
    for (const quest of SIDE_QUESTS) {
      const record = state.sideQuests[quest.id];
      if (record.status !== "active") continue;
      const objective = quest.objectives[record.objective];
      if (!objectiveMatches(objective, event)) continue;
      record.objective += 1;
      advancedQuests.push(quest.id);
      if (record.objective >= quest.objectives.length) {
        record.status = "completed";
        record.completedAt = String(event.at || new Date().toISOString()).slice(0, 40);
        completedQuests.push(quest.id);
        if (revealMemory(state, quest.rewardMemoryId)) unlockedMemories.push(quest.rewardMemoryId);
        Object.entries(quest.trust || {}).forEach(([id, amount]) => { state.companionTrust[id] = clamp(state.companionTrust[id] + amount, 0, 100); });
      }
    }
    state.cityPhase = chapterData.cityPhase;
    state.lastEventAt = String(event.at || new Date().toISOString()).slice(0, 40);
    return { state, unlockedMemories, completedQuests, advancedQuests };
  }
  function startSideQuest(input, questId, chapter) {
    const state = normalizeState(input);
    unlockAvailableQuests(state, clamp(chapter, 1, CHAPTERS.length));
    const quest = SIDE_QUEST_MAP[questId];
    const record = state.sideQuests[questId];
    if (!quest || !record || record.status !== "available") return { state, started: false, reason: "Nhiệm vụ chưa mở hoặc đã được theo dõi." };
    record.status = "active";
    record.startedAt = new Date().toISOString();
    state.lastEventAt = record.startedAt;
    return { state, started: true, quest };
  }
  function chooseResponse(input, dilemmaId, responseId, chapter) {
    const state = normalizeState(input);
    const dilemma = DILEMMA_MAP[dilemmaId];
    if (!dilemma || dilemma.chapter > clamp(chapter, 1, CHAPTERS.length) || state.responses[dilemmaId]) return { state, accepted: false, reason: "Phản hồi chưa mở hoặc đã được ghi nhận." };
    const option = dilemma.options.find((entry) => entry.id === responseId);
    if (!option) return { state, accepted: false, reason: "Phản hồi không hợp lệ." };
    state.responses[dilemmaId] = option.id;
    Object.entries(option.trust).forEach(([id, amount]) => { state.companionTrust[id] = clamp(state.companionTrust[id] + amount, 0, 100); });
    Object.entries(option.insight).forEach(([id, amount]) => { state.factionInsight[id] = clamp(state.factionInsight[id] + amount, 0, 100); });
    state.lastEventAt = new Date().toISOString();
    return { state, accepted: true, dilemma, option };
  }
  function syncCompanionBond(input, characterId, bond) {
    const state = normalizeState(input);
    if (!CHARACTERS[characterId]) return { state, conversation: null };
    state.companionTrust[characterId] = Math.max(state.companionTrust[characterId], clamp(bond, 0, 10) * 10);
    const profile = CHARACTERS[characterId];
    const available = profile.milestones.find((milestone) => milestone.trust <= state.companionTrust[characterId] && !state.conversationsSeen.includes(`${characterId}:${milestone.trust}`));
    if (!available) return { state, conversation: null };
    state.conversationsSeen.push(`${characterId}:${available.trust}`);
    return { state, conversation: { characterId, character: profile.name, ...available } };
  }
  function nextBanter(input, zoneId, chapter) {
    const state = normalizeState(input);
    const entry = BANTER.find((item) => item.zoneId === zoneId && item.chapter <= clamp(chapter, 1, CHAPTERS.length) && !state.banterSeen.includes(item.id));
    if (!entry) return { state, banter: null };
    state.banterSeen.push(entry.id);
    state.banterLog.push({ id: entry.id, at: new Date().toISOString() });
    state.banterLog = state.banterLog.slice(-12);
    return { state, banter: entry };
  }
  function completeChapter(input, chapter) {
    const state = normalizeState(input);
    const current = CHAPTERS[clamp(chapter, 1, CHAPTERS.length) - 1];
    current.memoryIds.forEach((id) => revealMemory(state, id));
    const next = CHAPTERS[Math.min(CHAPTERS.length - 1, current.number)];
    state.cityPhase = current.number >= CHAPTERS.length ? "living-archive" : next.cityPhase;
    unlockAvailableQuests(state, Math.min(CHAPTERS.length, current.number + 1));
    state.lastEventAt = new Date().toISOString();
    return { state, chapter: current };
  }
  function chapterSnapshot(input, chapter) {
    const state = normalizeState(input);
    const data = CHAPTERS[clamp(chapter, 1, CHAPTERS.length) - 1];
    const dilemma = DILEMMA_MAP[data.dilemmaId];
    const boss = BOSSES[data.bossId];
    return {
      chapter: data,
      boss,
      memories: data.memoryIds.map((id) => ({ ...MEMORY_MAP[id], revealed: state.revealedMemories.includes(id) })),
      dilemma: { ...dilemma, response: state.responses[dilemma.id] || "" },
      sideQuests: SIDE_QUESTS.filter((quest) => quest.chapter <= data.number).map((quest) => ({ ...quest, progress: state.sideQuests[quest.id] })),
      contradictions: CONTRADICTIONS.filter((entry) => state.contradictions.includes(entry.id)),
      city: CITY_PHASES[state.cityPhase],
      completion: Math.round((state.revealedMemories.length / MEMORIES.length) * 100)
    };
  }

  const api = Object.freeze({
    VERSION, CHARACTERS, FACTIONS, CHAPTERS, BOSSES, MEMORIES, CONTRADICTIONS, SIDE_QUESTS, DILEMMAS, BANTER, CITY_PHASES,
    createState, normalizeState, recordEvent, startSideQuest, chooseResponse, syncCompanionBond, nextBanter, completeChapter, chapterSnapshot
  });
  root.HHAstraNexusEchoStory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
