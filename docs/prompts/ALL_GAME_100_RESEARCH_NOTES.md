# Cơ sở cho prompt mở rộng All Game thêm 100 game

Ngày nghiên cứu: 23/10/2026. Phạm vi phiên này: soạn prompt và danh sách thiết kế. Những game trong danh sách 100 là đề xuất nguyên bản theo cơ chế; không phải tuyên bố đã chơi thử 100 game tham khảo hoặc đã triển khai thêm 100 game.

## Baseline đã xác minh

Đọc `AGENTS.md`, trạng thái Git và catalog qua `require('./all-game.js').CATALOG` tại checkout project. Catalog hiện có **109 ID khác nhau**, release 1061, commit `6f457b0`.

| Nhóm hiện tại | Số game |
|---|---:|
| Trí tuệ | 26 |
| Chiến thuật | 26 |
| Hành động | 19 |
| Phản xạ | 16 |
| Mô phỏng | 6 |
| Thể thao | 4 |
| Phiêu lưu | 4 |
| Thư giãn | 3 |
| Đua xe | 3 |
| Giáo dục | 2 |

Các nhóm đề xuất mở rộng vào thể thao cả trận, bài/bàn, âm nhạc, logic ràng buộc, dịch vụ, sản xuất, cốt truyện, nhập vai, co-op, kỹ thuật, ngôn ngữ và sáng tạo. 20 nhóm trong prompt là phân bổ thiết kế, không yêu cầu làm menu mobile gồm 20 nút.

## Nguồn game đã đọc

Nghiên cứu nội dung trang/mô tả/điều khiển và danh mục; chưa chạy gameplay runtime của các game nguồn. Trang nguồn ghi hỗ trợ mobile không thay thế việc kiểm tra bản triển khai riêng của hoang8.com.

| Nguồn trực tiếp | Cơ chế hoặc bài học dùng cho thiết kế |
|---|---|
| [Y8 Sports](https://www.y8.com/categories/sports) | Danh mục trải rộng từ thể thao bóng đến bowling, bơi, bi-a; đề xuất mới ưu tiên luật và diễn biến trận thay vì một cú sút/ném. |
| [8 Ball Pool](https://www.y8.com/games/8_ball_pool_html5) | Ngắm/đánh bi và tương tác vật lý; bản hoang8 cần tự bổ sung bộ luật lượt/foul/kết ván được công bố. |
| [Swimming Pro](https://www.y8.com/games/swimming_pro) | Các cự ly thi bơi và quay đầu. Phân phối sức/nhịp thở là yêu cầu sáng tạo bổ sung trong prompt, không khẳng định là chi tiết đã kiểm tra của nguồn. |
| [Shop Empire](https://www.y8.com/games/shop_empire) | Xây/nâng cửa hàng, tiện ích, thang máy và thuê nhân sự; gợi ý quản lý không gian và dịch vụ. |
| [Goodgame Big Farm](https://www.y8.com/games/goodgame_big_farm) | Trồng, thu hoạch, chế biến, vật nuôi và công nhân; prompt mở rộng thành bài toán mùa vụ/luân canh riêng. |
| [Papa’s Freezeria](https://www.y8.com/games/papa_s_freezeria) | Sản phẩm theo yêu cầu và mức hài lòng khách; batch scheduling và co-op vai trò là phần thiết kế thêm. Trang nguồn còn gắn Flash/desktop. |
| [Fireboy and Watergirl Forest Temple](https://www.y8.com/games/fireboy_and_watergirl_forest_temple) | Phối hợp nhân vật, công tắc, hộp, bục và cửa; cơ sở cho ràng buộc co-op bất đối xứng. |
| [Friday Night Funkin](https://www.y8.com/games/friday_night_funkin) | Nhấn mũi tên đúng thời điểm. Từ review, nâng Rhythm Tap thêm lane/hold được xem là nâng cấp game cũ, không tính vào 100 game mới; danh sách mới dùng các cơ chế âm nhạc khác. |
| [DJ Mixer](https://www.y8.com/games/dj_mixer), [Mixxx Features](https://mixxx.org/features/) | Y8 mô tả trộn track/beat nhưng không xác nhận bộ luật hai deck. Tài liệu chính thức Mixxx mô tả tempo, cue, pitch, EQ và crossfader; từ đó đề xuất game chuyển đoạn riêng. Chỉ tham khảo chức năng, không lấy mã/UI/media Mixxx. |
| [Solitaire Classic Klondike](https://www.y8.com/games/solitaire_classic_klondike) và [Solitaire Collection](https://www.y8.com/games/solitaire_collection_klondike_spider_freecell) | Tham khảo trình bày bài, chọn/di chuyển, undo/hint và luật patience. Không tính mỗi giao diện hoặc số chất là game mới. |
| [Uno Online](https://www.y8.com/games/uno_online) | Màu/số/ký hiệu và hiệu ứng đổi lượt. Đề xuất shedding riêng, không lấy tên thương hiệu, bộ bài hoặc artwork nguồn. |
| [Cut the Rope](https://www.y8.com/games/cut_the_rope) | Thứ tự cắt dây, chuyển động và mục tiêu phụ. Mô hình/nội dung mới phải viết riêng và được kiểm chứng giải được. |
| [Wheely 8: Aliens](https://www.y8.com/games/wheely_8_aliens) | Khám phá/tương tác trong hành trình tìm phụ tùng; gợi ý mục tiêu truyện dẫn tới từng phòng. |
| [Game24h: game bài](https://game24h.vn/game-bai-c168.html), [phiêu lưu](https://game24h.vn/phieu-luu-c110.html) | Đọc được danh mục, giúp mở rộng cách phân nhóm ngoài arcade/chiến thuật. |
| [Game24h: Thần tượng âm nhạc](https://game24h.vn/tinh-diem/than-tuong-am-nhac-c145g2623b16.html) | Trang mô tả quiz ca sĩ nhưng trộn nhìn hình/nghe bài. Chỉ xác nhận ý tưởng quiz chủ đề âm nhạc; không lấy nhạc/ảnh hoặc suy ra audio gameplay đã hoạt động. |

Đã thử mở [Bước nhảy xì tin](https://game24h.vn/choi-nhieu-trong-tuan/buoc-nhay-xi-tin-c132g2848b61.html) và [Chú khỉ buồn 190](https://game24h.vn/choi-nhieu-trong-tuan/chu-khi-buon-190-c132g4466b61.html) nhưng timeout; chỉ đọc được mô tả được lập chỉ mục của trang. Không coi đó là kiểm chứng gameplay. Không lấy `game24h.com` làm địa chỉ thay thế cho nội dung `game24h.vn`.

## Nguồn GitHub đã kiểm tra

Đã đọc README, license và file liên quan. Chưa tái sử dụng mã hoặc tải media. Các ghi chú sau không thay thế việc kiểm tra lại file/commit thực dùng khi triển khai.

| Repository và mã liên quan | Ý tưởng áp dụng | Giấy phép/phạm vi |
|---|---|---|
| [boardgame.io](https://github.com/boardgameio/boardgame.io), [flow.ts](https://github.com/boardgameio/boardgame.io/blob/main/src/core/flow.ts), [player-view.ts](https://github.com/boardgameio/boardgame.io/blob/main/src/core/player-view.ts) | Tách state/move, phase, turn order và thông tin riêng từng người. | [MIT](https://github.com/boardgameio/boardgame.io/blob/main/LICENSE) cho software/docs; giữ notice nếu dùng mã. Không mặc định cấp quyền tranh bài/thương hiệu bên ngoài. Không cần đổi host hiện tại sang engine này. |
| [cwilso/metronome](https://github.com/cwilso/metronome), [metronome.js](https://github.com/cwilso/metronome/blob/main/js/metronome.js) | Clock Web Audio và lập lịch trước; tách phát âm thanh khỏi vẽ frame. | [MIT](https://github.com/cwilso/metronome/blob/main/LICENSE.txt). Beep oscillator không cấp quyền cho bài nhạc khác. Tự tạo nhạc/chart; scheduler thuộc lifecycle của host. |
| [Matter.js](https://github.com/liabru/matter-js), [slingshot.js](https://github.com/liabru/matter-js/blob/master/examples/slingshot.js) | Constraint, đàn hồi, ma sát và va chạm. | [MIT](https://github.com/liabru/matter-js/blob/master/LICENSE); notice cần giữ khi dùng mã. Gallery trỏ tới website khác không cấp quyền tài sản của các website đó. |
| [OpenTTD](https://github.com/OpenTTD/OpenTTD), [economy.cpp](https://github.com/OpenTTD/OpenTTD/blob/master/src/economy.cpp) | Kinh tế vận chuyển, độ trễ doanh thu và tái đầu tư. | [GPL v2](https://github.com/OpenTTD/OpenTTD/blob/master/COPYING.md). Prompt giới hạn tham khảo nguyên lý, không chép/port source; dữ liệu gốc và các bộ OpenGFX/OpenSFX/OpenMSX có quyền riêng cần kiểm tra. |
| [ncase/trust](https://github.com/ncase/trust), [PD.js](https://github.com/ncase/trust/blob/gh-pages/js/sims/PD.js) | Tutorial tương tác, payoff, bot có trí nhớ và ảnh hưởng của nhiễu. | [LICENSE CC0](https://github.com/ncase/trust/blob/gh-pages/LICENSE), nhưng README liệt kê media riêng như SFX CC BY-NC và CC Sampling+. Không gọi mọi media là CC0. |
| [javascript-pong](https://github.com/jakesgordon/javascript-pong), [pong.js](https://github.com/jakesgordon/javascript-pong/blob/master/pong.js) | Spin và AI có dự đoán/sai số/phản ứng; ưu tiên luật hợp lệ. | [MIT](https://github.com/jakesgordon/javascript-pong/blob/master/LICENSE); nguồn/quyền từng media chưa được xác minh. Chỉ nghiên cứu nguyên lý; Paddle Duel đã có nên không đề xuất Pong đổi skin. |

## Ranh giới của kết quả

Qua review chống trùng, đã thay ý tưởng game bốn lane bằng DJ beatmatching (tránh biến thể Rhythm Tap), thay tycoon công viên bằng thiết kế tàu lượn (tránh mall đổi skin), và siết khác biệt điện/nước, JRPG/thuần dưỡng, lens/camera. Danh sách cuối vẫn đủ 100 ID trong 20 nhóm.

- Đã xác minh số lượng/ID ở catalog và đọc các nguồn liệt kê, không tuyên bố đã audit lại mọi engine của 109 game trong phiên soạn prompt này.
- 100 đề xuất không phải 100 bản sao game nguồn. Một số ý tưởng như STEM, batch scheduling, thông tin riêng, mô hình camera/thermal hoặc co-op là thiết kế mới; cần đặc tả, nguồn kiến thức và kiểm chứng riêng khi triển khai.
- Prompt bắt buộc đọc engine để chống trùng, cho phép thay ứng viên trùng, yêu cầu luật/renderer/input/đầu ra và kiểm thử từ state hợp lệ trước khi tính game là hoàn thành.
- Với baseline 109, mục tiêu là 209. Không hard-code tổng này nếu baseline thay đổi sau ngày nghiên cứu.

Prompt có thể sao chép trọn vẹn từ `ALL_GAME_100_EXPANSION_PROMPT.md` cùng thư mục.
