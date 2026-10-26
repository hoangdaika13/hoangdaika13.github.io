# Prompt triển khai: All Game 209 — giao diện dễ đọc, campaign dài hơn và đồ họa theo từng game

Hãy trực tiếp nâng cấp **toàn bộ 209 game hiện có của hoang8.com** thành một thư viện có giao diện rõ ràng, hình ảnh đẹp, gameplay sâu hơn, nhiều màn thực chất và tiến trình đáng quay lại. Bổ sung cốt truyện phù hợp và lựa chọn 2D, 2.5D hoặc 3D theo lợi ích của từng game.

Đây là yêu cầu triển khai, kiểm thử, xem ảnh và hoàn thiện sản phẩm. Phạm vi là nâng chất lượng các game đang có; không dùng việc thêm game mới để thay cho nâng cấp những game cũ.

Baseline khi soạn prompt: **release 1062, commit e1c6a57, 209 game, 36 bundle luật và 22 nhãn thể loại**. Xác minh lại repository trước khi làm; bảo toàn các thay đổi mới hơn và toàn bộ ID/route đã phát hành.

## 1. Đọc project và lập bảng nâng cấp đủ 209 game

Đọc `AGENTS.md`, Git status, `index.html`, routing trong `script.js`, `performance-loader.js`, `sw.js`, `all-game.js`, các catalog, `all-game-studio-core.js`, `all-game-audio.js`, renderer, CSS và bộ QA hiện có.

Đọc thêm:

- `docs/ALL_GAME_ATLAS_1062.md`.
- `docs/ALL_GAME_ATLAS_CHECKLIST_1062.json`.
- `docs/ALL_GAME_QA_1062.json`.
- `docs/prompts/ALL_GAME_209_LONGFORM_RESEARCH.md`.

Xuất bảng theo dõi **mỗi ID một dòng**, gồm: nội dung hiện có; điểm yếu cụ thể; mô hình nội dung mới; số màn/nhiệm vụ/trận; cơ chế mới; thời lượng mục tiêu; kiểu truyện; loại renderer; asset; tiến trình/lưu; luật tương thích; bằng chứng kiểm thử và trạng thái hoàn thành.

Mỗi game được chọn một mô hình nội dung chính để nghiệm thu. Tag phụ như co-op, giáo dục hoặc thư giãn không làm phát sinh yêu cầu đếm hai campaign cho cùng một game. Những game có campaign chỉ ba màn hoặc một ván ngắn hiện tại phải được mở rộng thực sự.

Không ghi hoàn thành chỉ vì đã có tên trong catalog, một nút Campaign, một file level JSON hoặc một screenshot đẹp.

## 2. Ưu tiên sửa lỗi đọc chữ trong ảnh và nâng toàn bộ thư viện

Ảnh tham chiếu cho thấy **tên game gần như trắng trên nền thẻ sáng**, khó nhận ra tên dù mô tả vẫn đọc được. Đây là lỗi bắt buộc sửa trước khi mở rộng nội dung.

- Tái hiện trong **khung website đầy đủ**, gồm shell, theme toàn cục và sidebar. Kiểm tra computed styles của tiêu đề, liên kết, mô tả, metadata và nút trên từng loại bề mặt.
- Kiểm tra cascade giữa `.ag-card-body`, `.ag-card-title h2`, liên kết trong tiêu đề và các rule heading của shell, chẳng hạn `.app-workspace__platform :where(h2,h3,h4)`. Đây là điểm cần điều tra từ code, không được coi là kết luận thay cho kiểm tra trình duyệt.
- Quy định màu chữ trực tiếp theo vai trò bề mặt. Thẻ sáng có tiêu đề tối, mô tả tối vừa; thẻ tối dùng chữ sáng. Không dùng một màu heading chung cho cả hai.
- Sửa ở phạm vi All Game, tổ chức lại token/layer CSS liên quan. Không chồng thêm nhiều bản vá `!important`, không đổi màu heading toàn website để chữa riêng một thẻ.
- Kiểm tra trạng thái thường, hover, focus, visited, chọn, yêu thích, loading và disabled. Chữ quan trọng không dùng opacity thấp hoặc gradient chữ khó nhìn.
- Contrast chữ thường ít nhất **4,5:1**, chữ lớn đủ điều kiện ít nhất **3:1**; thông tin tương tác cần đủ tương phản và có dấu hiệu ngoài màu sắc. Đo trên màu thực đã composite của nền, lớp phủ và gradient, không chỉ kiểm tra token trong một file JS.
- Bổ sung regression test **đúng tiêu đề game trong full shell**. Bộ test màu hiện có không được xem là bằng chứng mọi chữ đều đọc được chỉ vì một test CTA hoặc palette đã đạt.

Định hướng hình ảnh: **Premium Colorful Arcade**, hiện đại, tươi, có chiều sâu nhưng tiết chế. Giữ xanh điện, cyan, tím, hồng, coral và vàng làm điểm nhấn; tách rõ nền, bề mặt, chữ, nút chính, điểm số, cảnh báo, đồng minh và đối thủ.

Thẻ game phải có tên nổi bật, ảnh đúng gameplay, mô tả ngắn, thể loại, kiểu chơi, thời lượng ước tính và nút chơi rõ. Tên dài vẫn đọc được; không để metadata quá nhỏ hoặc tên bị nền ảnh nuốt mất. Ảnh thể thao cần thể hiện đúng môn, không chỉ vài vòng tròn đổi màu trên các sân gần giống nhau.

Thiết kế thư viện theo các nhu cầu: Chơi nhanh, Tiếp tục, Cốt truyện, Giải đấu, Giải đố, Sáng tạo và Cùng chơi. Thông tin số màn/tiến độ phải lấy từ nội dung đã phát hành và state thật.

Giữ tìm kiếm tiếng Việt, tag/filter kết hợp, yêu thích, gần đây, sort, sidebar và command search. Mobile có hero ngắn, bộ lọc nâng cao gọn và nút tới danh mục thực sự đưa người chơi tới game. Không để nhiều màn hình giới thiệu/ngăn bộ lọc đứng trước lựa chọn chơi đầu tiên.

## 3. Nhiều nội dung hơn, với chỉ tiêu riêng theo thể loại

Các số dưới đây là **mục tiêu thiết kế cho hoang8.com**, không phải số màn được trích từ game tham khảo. Ghi rõ phần chưa đo. Thời lượng phải được hiệu chỉnh bằng chơi thử; không quy đổi thời gian solver hay số frame thành thời gian trải nghiệm của người thật.

| Mô hình nội dung chính | Mức mở rộng cần triển khai cho mỗi game | Mục tiêu trải nghiệm ban đầu |
|---|---|---|
| Logic, giải đố, ghép số, vật lý | 24–40 màn, 4–6 chương; tương tác mới rồi phối hợp, có gợi ý từng bước | Khoảng 45–120 phút nội dung; giữ từng màn ngắn |
| Hành động, arcade, platformer, phiêu lưu | 16–24 nhiệm vụ/chặng, ít nhất 4 vùng có đặc điểm gameplay khác; thử thách cuối chương phù hợp luật | Khoảng 60–120 phút campaign; vẫn có Quick Play |
| RPG, điều tra, truyện tương tác | 4–6 chương, mỗi chương 3–5 mục tiêu chơi được; ít nhất 3 lựa chọn có hậu quả và 2 kết cục nếu có phân nhánh | Khoảng 90–180 phút gồm gameplay |
| Chiến thuật, quản lý, sản xuất, hạ tầng | 10–16 scenario với điều kiện khác; nhiều chiến lược khả thi, tuyến nâng cấp và sandbox khi phù hợp | Campaign khoảng 90–180 phút, chơi qua nhiều phiên |
| Thể thao, đua xe, điều khiển phương tiện | Quick Match/Practice và mùa giải 12–16 trận/chặng; đối thủ, sân/đường, thời tiết hoặc chiến thuật tạo khác biệt thực | Chọn trận ngắn/vừa theo luật; lưu cả mùa giải |
| Cờ, bài, trò bàn/cổ điển | Giữ ván đầy đủ đúng luật; thêm 24–40 tình huống luyện tập hợp lệ và giải đấu/chuỗi đối thủ phù hợp | Tăng chiều sâu và khả năng chơi lại; giữ thời lượng tự nhiên của ván |
| Âm nhạc | 12–20 bài/challenge nguyên bản theo đúng cơ chế riêng của từng game, luyện đoạn và phối khí/cao độ/hòa âm tăng dần | Khoảng 30–60 phút nội dung biên soạn, có replay để tiến bộ |
| STEM, ngôn ngữ | 24–40 tình huống có nguồn/biên tập, nhiều cấp suy luận và giải thích kết quả | Khoảng 45–120 phút; không chỉ thay số hoặc từ |
| Sáng tạo, thư giãn | 16–24 commission/mục tiêu có brief khác nhau; lưu tác phẩm, bộ sưu tập và sandbox riêng | Nhiều phiên sáng tạo 3–10 phút hoặc lâu hơn theo người chơi |
| Co-op lấy phối hợp làm cơ chế chính | 16–24 màn thay cách phụ thuộc vai trò, thông tin hoặc tài nguyên; solo đổi vai giải được | Khoảng 60–120 phút; lưu giữa các phiên |

Một mức trong khoảng chỉ được chốt sau khi đối chiếu gameplay cụ thể; ghi con số cam kết vào bảng 209 game. Chọn mức thấp hơn chỉ để báo xong không được xem là quyết định thiết kế có căn cứ.

Không kéo dài trải nghiệm bằng cách giảm tốc kinh tế, tăng máu đối thủ vô lý, thêm màn chờ, buộc cày vật phẩm, lặp bản đồ hoặc kéo dài đồng hồ. Không tính xoay/lật màn, đổi nền, đổi seed đơn thuần hay tăng tốc độ là một chương mới.

Mỗi màn/scenario cần ID ổn định và dữ liệu như `objective`, `layout`, `mechanicIntroduced`, `availableTools`, `resources`, `hazards`, `prerequisites`, `winConditions`, `loseConditions`, `rewards`, `hintSteps` và `contentVersion`. Chỉ lưu các trường phù hợp với game đó, không ép mọi engine có cùng một mô hình luật.

Nội dung sinh thủ tục phải có ràng buộc, kiểm tra trùng theo cấu trúc/tương tác và bộ seed được kiểm chứng. Nếu generator chưa đủ tốt, dùng màn biên soạn. Không đăng ký hàng nghìn màn ngẫu nhiên rồi suy ra có hàng nghìn màn thú vị.

Có thể thêm thử thách ngày/tuần, seed ổn định và thử nghiệm loadout để tăng replay. Đây là phần bổ sung; không thay campaign, không đặt khóa thời gian buộc quay lại và không tạo leaderboard/người chơi online giả. Ghi rules/content version của seed để cập nhật nội dung không làm sai kỷ lục cũ.

## 4. Cốt truyện và tiến trình phải tạo ra gameplay

Với game phù hợp, viết truyện nguyên bản có nhân vật có động cơ, xung đột, khám phá, cao trào và kết cục. Đối thoại gọn, đọc theo nhịp người chơi, có bỏ qua, xem lại và tóm tắt khi quay về sau nhiều ngày.

Có thể phát triển các tuyến truyện sau thành những thế giới riêng, rồi điều chỉnh cho từng game:

- **Trạm Bình Minh:** điều tra một sự cố, ghép chứng cứ, nhân chứng nhớ các lần gặp; vòng thời gian làm thay đổi điều có thể cứu hoặc khám phá.
- **Quần Đảo Lõi Sáng:** khám phá các đảo, học kỹ năng mở tuyến đường mới, lựa chọn đồng minh tác động lên nhiệm vụ cuối.
- **Hội Thợ Máy:** khôi phục một thành phố sau khủng hoảng; quyết định sản xuất, điện/nước và giao thông có hệ quả quan sát được.
- **Đại Hội Bảy Sắc:** mùa giải với đối thủ có phong cách riêng, luyện kỹ năng và xử lý biến cố chiến thuật; giữ luật thi đấu minh bạch.
- **Lời Hẹn Của Rừng:** kết bạn sinh vật, đọc dấu vết, chăm môi trường và tạo tác phẩm; lối chơi nhẹ nhàng nhưng có quyết định.

Đây là gợi ý sáng tác, không phải yêu cầu đặt cùng một cốt truyện lên 209 game. Game cờ/bài có thể dùng hồ sơ đối thủ hoặc bối cảnh giải đấu; game âm nhạc có hành trình biểu diễn; puzzle có nhật ký khám phá. Không ép một tiểu thuyết hoặc boss lên trò vốn cần sự tập trung, thư giãn hay luật chuẩn.

Lựa chọn phải thay đổi nhiệm vụ, quan hệ, tài nguyên, kỹ năng, đường đi hoặc kết cục. Phân nhánh cần có state và điều kiện thực; hai nút dẫn đến cùng nội dung mà không có hệ quả không được tính là lựa chọn có ý nghĩa.

Truyện và mission data phải tách khỏi renderer. Dùng đồ thị hội thoại/quest rõ, hoặc đánh giá ink/inkjs nếu cần; không thêm thư viện truyện chỉ để thay một danh sách JSON đơn giản. Kiểm tra nhánh không tới được, dead-end, softlock và các thứ tự làm nhiệm vụ khác nhau.

Giữ Quick Play ngay từ đầu. Campaign/Season/Practice bổ sung chiều sâu, không khóa khả năng chơi cơ bản sau cày cuốc. Thua phải có restart/checkpoint hợp lý; không bắt đọc lại toàn bộ đoạn truyện đã xem.

## 5. Nâng gameplay và cảm giác điều khiển bên trong đủ 209 game

Mỗi dòng checklist phải ghi thay đổi gameplay cụ thể bên cạnh nâng đồ họa.

- Action/arcade: phản hồi trúng đòn, chuyển động rõ, va chạm nhất quán; điều chỉnh gia tốc, nhảy/đáp và camera theo game. Nếu có jump buffer/coyote time/aim assist, ghi tham số và kiểm tra tính công bằng của mode đó.
- Puzzle: luật được giới thiệu qua thao tác; hint theo cấp, undo/retry khi phù hợp, phân biệt lỗi thao tác và quyết định sai. Màn khó phải cần suy luận hơn, không chỉ nhiều ô hơn.
- Chiến thuật: telegraph ý đồ/tầm nguy hiểm khi luật cho phép, nhiều chiến lược và đối thủ có hành vi thực. AI không đọc bài kín hoặc lựa chọn người chơi đã được yêu cầu khóa trước.
- Thể thao/phương tiện: tăng chiều sâu sở hữu bóng, chuyền, vị trí, thời điểm, quỹ đạo, địa hình, chiến thuật hoặc quản lý mùa giải; không biến cả trận thành một nút sút lặp lại.
- Quản lý: hiển thị nguyên nhân thiếu tài nguyên/tắc nghẽn, biểu đồ vừa đủ, nhiều cách giải bài toán; tránh một hàng đợi được đổi tên thành nhiều game.
- Sáng tạo: nhiều lời giải đẹp hợp lệ, preview trước khi xác nhận, undo, lưu bộ sưu tập và rubric chấm minh bạch. Không buộc mọi tác phẩm khớp một tập tọa độ tuyệt đối.
- STEM/ngôn ngữ: mở rộng dữ liệu được biên tập, phản hồi giải thích, thuật ngữ/đơn vị chính xác. Ghi rõ mô hình khoa học đơn giản hóa. Từ điển và nội dung tiếng Việt phải có nguồn/quyền sử dụng và kiểm tra dấu/chính tả.
- Âm nhạc: chart/track thật, clock âm thanh và lịch phát đúng, luyện từng đoạn, volume/mute/calibration, cue hình và pause/resume không phát bù.
- Co-op: nhiệm vụ phụ thuộc hai vai thực; solo đổi vai không bế tắc; công bố cùng thiết bị và cách giấu thông tin. Không hiển thị online/ghép phòng khi chưa có hệ thống mạng.

Chỉ cung cấp độ khó khi có khác biệt tham số/AI/ràng buộc thực. Baseline có nhiều game một mức luật cố định; không tự biến chúng thành ba nhãn giống hệt. Khi có nhiều mức, áp dụng nhất quán qua các màn/chương và ghi rõ tác động.

## 6. Đồ họa 2D, 2.5D và 3D theo lợi ích từng game

Lập mapping renderer cho đủ 209 ID, giải thích vì sao lựa chọn giúp nhìn rõ và chơi tốt hơn. Bắt đầu bằng ba bản triển khai hoàn chỉnh đại diện 2D/2.5D/3D để kiểm tra kiến trúc, rồi áp dụng tiếp tới đủ phạm vi. Ba bản mẫu không được coi là hoàn tất thư viện.

**2D chất lượng cao:** ưu tiên cho cờ/bài, logic, ngôn ngữ, nhạc và sơ đồ cần đọc. Nâng quân bài/quân cờ, biểu tượng, typography, texture, animation chọn/đặt/ghép và phản hồi thành công. Giao diện rõ và đẹp là mục tiêu; 3D không phải điều kiện để một game được nâng cấp.

**2.5D:** dùng khi phù hợp cho chiến thuật, quản lý, sân thể thao, platformer, đảo và công trình. Có độ cao/lớp cảnh, thứ tự che khuất hợp lý, bóng tiếp xúc, camera trực giao hoặc phối cảnh nhẹ, parallax có kiểm soát và vật thể có silhouette riêng. Chỉ thêm `perspective` CSS lên thẻ game không được tính là nâng gameplay lên 2.5D.

**3D chọn lọc:** đánh giá bowling, bi-a/carrom, xe/phi thuyền, pottery, perspective camera và một số game phiêu lưu. Có mô hình/vật liệu/ánh sáng/camera/animation phù hợp; tránh dựng mọi vật bằng khối trơn rồi đổi tên. Camera không che mục tiêu, bảng điều khiển hoặc làm khó ngắm.

Ghi rõ trường hợp nào là **renderer 3D trên luật/va chạm 2D**, trường hợp nào là **mô phỏng không gian 3D thực**. Không đổi một giả lập 2D thành lời quảng cáo vật lý 3D. Chỉ đổi luật vật lý khi có lợi và có kiểm thử tương ứng.

Giữ API luật/state độc lập renderer. Có thể chọn Three.js hoặc Babylon.js cho lớp 3D sau đánh giá; tránh tải cả hai chỉ để thử. Nếu chọn PixiJS/Phaser cho một nhóm, chứng minh lợi ích và tích hợp vòng lặp đúng. Pin phiên bản, đọc tài liệu hiện hành, nạp theo nhu cầu; không dựng lại toàn project bằng framework mới.

HUD quan trọng vẫn có DOM rõ ràng. Raycast/picking và pointer mapping đúng sau camera, resize, DPR, zoom, fullscreen và đổi chất lượng. Giữ điều khiển bàn phím/cảm ứng, marker chọn và cách chơi thay thế cho thao tác kéo/gesture khó.

Có cấp chất lượng phù hợp máy, DPR/độ phân giải thích ứng, texture/mesh được tối ưu, giới hạn particle/entity/draw call và một game active. Thumbnail là ảnh tĩnh hoặc preview được quản lý riêng; không chạy 209 scene 3D trong thư viện.

Chỉ công bố fallback sau khi đã làm và thử. Giữ renderer Canvas/DOM cũ làm phương án riêng khi khả thi, dùng cùng tiến trình. Không tự hứa PixiJS/WebGPU tự chuyển sang Canvas trên mọi trình duyệt. Nếu renderer 3D không hoạt động và chưa có fallback tương đương, hiển thị trạng thái đúng, giữ save và cho quay thư viện.

## 7. Kiến trúc, dữ liệu, lưu dài hạn và tài nguyên

- Host và renderer adapter phải có **một chủ sở hữu vòng lặp**. Không để host RAF, Pixi ticker, Phaser TimeStep hoặc Babylon render loop cùng cập nhật một ván. Turn-based/idle không chạy loop vô ích.
- Giữ state game serializable; camera có thể lưu tham số cần thiết, nhưng không serialize scene graph, AudioNode, GPU object, texture, DOM node hoặc cả campaign vào save.
- Khi đổi game, dừng timer/voice, hủy fetch còn dang dở khi phù hợp, gỡ listener và giải phóng geometry/material/texture/render target. Xóa mesh khỏi scene chưa chứng minh tài nguyên GPU đã được trả.
- Xử lý WebGL context loss/restoration: dừng an toàn, giữ tiến trình và phục hồi hoặc chuyển renderer có kiểm thử. Thử cả tab hidden, blur, Back/Forward và đổi game liên tục.
- Level/story/model/audio pack tải theo nhu cầu, có manifest/version, trạng thái loading/retry và hỗ trợ mạng chậm. Tiến độ tải là dữ liệu thật; lỗi tải không được xóa campaign đã lưu.
- Giữ ID/route, yêu thích, kỷ lục và account partition hiện có. Tách rules version, content version và save schema để không tự reset dữ liệu khi thêm chương.
- Đánh giá IndexedDB cho tiến trình campaign, collection và cache có kích thước lớn. Giữ aggregate localStorage nhỏ và có giới hạn. Migrate dữ liệu `hh.*` cũ bằng mapping ID, kiểm tra đọc/ghi và giữ khả năng khôi phục khi migration hỏng.
- Đặc biệt kiểm tra worst case: 209 campaign, nhiều mode/difficulty, các nhánh truyện, vật phẩm, tác phẩm và checkpoints. Giới hạn đọc phải tương thích dữ liệu ghi hợp lệ. Không mang vấn đề 50KB trước đây sang một ngưỡng mới rồi tiếp tục reset save lớn.
- Save gồm ID nội dung, seed và state động cần thiết; không nhét ảnh, model, audio hoặc bản đồ tĩnh lặp lại. Giới hạn history, log, waypoint, vật thể và snapshot; prune/cache theo chính sách có mô tả.
- Cho lưu/tải chiến dịch, chọn chương đã mở, tóm tắt nhiệm vụ hiện tại, tiếp tục đúng checkpoint và account. Ghi rõ lưu trên thiết bị; không tự nhận cloud sync/đa thiết bị.

## 8. Nghiên cứu bổ sung và quyền sử dụng

Đọc nguồn trực tiếp được liệt kê trong file nghiên cứu đi kèm; ghi điều đã áp dụng cho game nào. Các hướng cần đối chiếu gồm:

- Y8 Kingdom Rush và Fireboy/Watergirl: mục tiêu trực quan, phối hợp, thử thách tăng dần.
- Hades: nhân vật/quan hệ nhớ lịch sử chơi; thất bại vẫn có tiến triển truyện.
- Baba Is You: mở rộng tương tác luật qua màn và kiểm tra lại lời giải.
- Factorio/Mini Metro/OpenTTD: scenario có điều kiện và lựa chọn hệ thống khác nhau; sandbox có vai trò riêng.
- Dead Cells: tuyến đường, kiểu trang bị và pattern thử thách tạo replay.
- ink: tổ chức truyện/biến/nhánh tách khỏi phần dựng hình.

Đó là nguồn cảm hứng; không sao chép nhân vật, thoại, bản đồ, UI, sprite, model hay nhạc thương mại. Với GitHub, kiểm tra đúng license của mã và từng phần media; quyền dùng thư viện không tự áp dụng cho asset demo.

Ưu tiên asset tự tạo hoặc gói có quyền phù hợp. Với Kenney, kiểm tra đúng asset page và license trong archive. Với Quaternius, không mặc định toàn bộ là CC0: xác minh license của đúng pack, phiên bản và ngày nhận. Lưu URL, tác giả, license/notice, checksum, phần chỉnh sửa và file thực dùng. Không lấy mã GPL vào ứng dụng chỉ vì repository đọc được công khai nếu chưa xác định cách đáp ứng license.

Nguồn không truy cập được phải được ghi rõ. Không nói đã chơi hoặc đọc source đầy đủ chỉ vì thấy search snippet hay ảnh quảng cáo.

## 9. Quy trình và kiểm thử để nghiệm thu đủ 209 game

Làm theo từng đợt khoảng 8–12 game có liên quan. Mỗi đợt phải xong luật/nội dung, renderer, input, lưu tiến trình, test và ảnh trước khi đánh dấu. Cập nhật bảng tiến độ và tiếp tục các đợt còn lại; không dừng ở UI chung hoặc vài game nổi bật rồi báo toàn bộ đã được nâng cấp.

Baseline đã có 674 test All Game và 241 test liên quan tại thời điểm soạn; chạy lại để xác nhận số thực. Giữ kiểm thử có ý nghĩa, cập nhật test đúng hành vi mới và bổ sung:

1. **Readability:** đo contrast từ computed styles trong full shell với theme và state liên quan, gồm tên từng thẻ, link visited, nút, HUD, thoại và overlay. Chụp/đọc lại ảnh; không dùng palette unit test thay kiểm chứng giao diện thật.
2. **Content:** schema, ID ổn định, tính khác biệt màn, mục tiêu có thể hoàn thành và phần thưởng lấy từ state. Solver/walkthrough dùng hành động hợp lệ từ đầu cho mọi màn bắt buộc và quá trình chuyển chương. Không gán `status='won'` hoặc nới luật chỉ để tạo bằng chứng hoàn thành.
3. **Campaign/truyện:** test liên tục từ mở đầu tới kết cục, các nhánh chính, điều kiện quest, softlock, mở khóa, save/reload giữa chương và tương thích save cũ. Phân biệt fixture gần cuối với walkthrough từ fresh state.
4. **Đối kháng:** legality, scoring, đầy đủ một ván/mùa giải đại diện, bot không nhìn thông tin kín/đọc input bị khóa. Thua/hòa hợp lệ được báo đúng, không đổi thành thắng giả.
5. **Đồ họa:** picking, camera, occlusion, va chạm, resize, quality switch, context loss và fallback. Kiểm tra tài nguyên/heap/GPU sau nhiều lần mở–đổi–rời game, không chỉ đếm một RAF khi đang chơi.
6. **Âm nhạc/input:** timing qua nhiều frame rate, volume/mute/offset, pause/resume, IME, touch cancel và kéo/thả kết thúc đúng; input chữ không bị hotkey gameplay chiếm.
7. **Browser thật:** mở đủ 209 route từ shell, start, thao tác chính, pause/resume/restart, tới map campaign, bắt đầu màn mới, reload checkpoint và quay thư viện. Đo ở 1440×900, 768×1024, 375×812, zoom 200%, DPR cao, reduced motion và forced colors phù hợp.
8. **Lỗi và migration:** asset pack lỗi/chậm, storage quota/corrupt data, hết cache, khác account/difficulty/rules/content version, migration gián đoạn. Không mất tiến trình hợp lệ hoặc báo lưu thành công khi thực tế thất bại.

Đo dung lượng tải, thời gian tới chơi được, frame time p50/p95, tài nguyên hoạt động và chi phí chuyển game trên môi trường công bố. Mục tiêu là chơi mượt với chất lượng thích ứng; không tự hứa 60fps trên mọi máy.

Chụp thư viện và game theo nhóm ở các kích thước; có ít nhất một ảnh đang chơi mới cho mỗi game, ảnh campaign/map và các trạng thái kết thúc/đối thoại đại diện. Tạo contact sheet, mở xem, sửa những phần khó đọc/khó điều khiển rồi chụp lại. Mockup không thay bằng chứng runtime.

Thời lượng ước tính phải được đo bằng lượt chơi thử đại diện với cách tính công bố, loại thời gian idle/chờ/đọc lặp. Nếu chưa có người chơi thử độc lập, ghi rõ đó là ước tính nội bộ; không dùng thời gian chạy solver làm số phút quảng cáo.

## 10. Điều kiện bàn giao và phát hành

Chỉ báo hoàn thành toàn bộ khi bảng đủ 209 game có: thay đổi UI/đồ họa cụ thể; nội dung đạt cam kết; tiến trình chơi dài hơn; truyện khi phù hợp; renderer hoạt động; test luật/campaign; screenshot runtime và kiểm tra lưu/khôi phục.

Không có nút/mode giả, màn chỉ đổi màu, chương chỉ bấm Next, badge thành tích bịa, AI gian lận hoặc thông báo có 3D/fallback/cloud khi chưa triển khai. Những gì chưa kiểm chứng phải được báo đúng, không đưa vào số đã hoàn thành.

Sau khi hoàn tất và các kiểm tra liên quan đạt: rà diff, stage đúng phạm vi, cập nhật manifest/loader/Service Worker theo release thực tế, commit và push lên nhánh/remote hiện tại, không force-push. Kiểm tra CI, deployment và tài nguyên thực trên hoang8.com nếu có quyền; tách lỗi dependency có sẵn khỏi hồi quy của đợt nâng cấp.

Báo commit/link, release, bảng 209 game đã nâng cấp, số màn/scenario thực theo từng game, phần truyện và 2D/2.5D/3D, kết quả test, số đo tải/hiệu năng, ảnh minh chứng, kiểu lưu và giới hạn thực tế.

**Bắt đầu bằng baseline và lỗi tên game không đọc được trong ảnh; sau đó triển khai xuyên suốt các đợt tới đủ 209 game.**
