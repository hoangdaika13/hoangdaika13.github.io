# All Game Arcade Studio — release 1061

Ngày hoàn thiện: 23/10/2026. Danh mục được đối chiếu trực tiếp với code: **59 ID cũ + 50 ID mới = 109 game**, 16 engine bundle, không trùng ID/route. Giữ nguyên đường dẫn, yêu thích và kỷ lục cũ. Đây là thư viện mini game 2D chơi đơn; các mô phỏng và AI có phạm vi gọn, không phải bản sao toàn bộ độ sâu của game thương mại được tham khảo.

## Thư viện và vùng chơi

- Premium Colorful Arcade: nền indigo, bề mặt sáng cho thẻ, sáu màu chính xanh điện/cyan/tím/hồng/coral/vàng. Nút chơi dùng gradient xanh–tím và chữ trắng; metadata dùng chữ tối trên thẻ sáng. Rà ảnh đã phát hiện và sửa màu CTA vàng nhạt thiếu tương phản.
- Hero với ba minh họa gameplay; mobile thu gọn, bỏ cụm tranh trang trí để danh mục xuất hiện sớm hơn. Thẻ có poster, mô tả, thể loại, yêu thích và link chơi; 50 SVG mới phản ánh vật thể/luật từng game, không chỉ đổi màu cùng một poster.
- Tìm kiếm tiếng Việt; lọc kết hợp thể loại, yêu thích, game mới, gần đây và kiểu input; sắp xếp nổi bật, tên tiếng Việt, lượt chơi hoặc kỷ lục. Số lượng lấy từ catalog, trạng thái rỗng có nút xóa bộ lọc.
- Màn bắt đầu, pause/resume, ván mới, thắng/thua/hòa, lỗi tải/thử lại dùng host chung. Game mới cung cấp bảng lệnh riêng, HUD tài nguyên thật, nhãn phím và trạng thái chọn/disabled. Luật biến thể cờ và tác động của độ khó được công bố trong phần hướng dẫn.
- Các renderer cũ tiếp tục được tinh chỉnh: vật liệu cạnh sáng/bóng cho cả 17 puzzle; palette quân/ô và Hanoi; bevel Mines/Memory/Merge; phân biệt thẻ úp/đang mở/đã ghép; màu gạch/nhân vật/platform; thêm viền, ánh phản chiếu cho vật thể arcade; tăng độ rõ HUD/vật liệu của 16 casual. Không thay luật cũ để tạo thêm game.
- Canvas 720×480, DPR tối đa 2; tọa độ input đổi theo kích thước hiển thị. Bàn nhiều ô có chế độ phóng to và cuộn bên trong để ô đạt tối thiểu 44px; nút lệnh/cảm ứng từ 44px. Với Canvas phóng to, vuốt chỉ cuộn và chạm mới chọn ô; đã kiểm tra touch gesture bằng Chromium CDP để tránh xây tháp nhầm khi vuốt. Có marker chọn ô bằng bàn phím và chế độ ngắm bằng phím ở game cần con trỏ.
- Giữ reduced motion, màu hệ thống/forced colors và focus. Bộ kiểm tra không phát hiện tràn ngang trang ở 375/768/1440px hoặc zoom 200%.

## Kiến trúc và lưu trữ

`all-game-studio-catalog.js` đăng ký 50 metadata. `all-game-studio-core.js` chứa primitive vẽ, PRNG có seed, hình học, adapter action/state và descriptor. Mười bundle chiến thuật/hành động/quản lý, mỗi bundle năm game, chứa luật riêng. `all-game-studio-art.js` cung cấp 50 SVG riêng; `all-game-scenes.js` giữ 12 thế giới dùng chung.

Host `all-game.js` tiếp tục là nơi duy nhất sở hữu RAF, sự kiện và persistence. Engine không tạo RAF/timer, không chạm DOM/storage/network. Màn chuẩn bị, theo lượt hoặc giai đoạn bố trí không chạy animation loop thừa; blur/hidden/pagehide và unmount dừng game và dọn input. Chỉ bundle của game được mở mới tải về; thư viện không tải cả 16 engine.

- `hh.all-game.library.v1:<owner>` giữ schema/namespace cũ, thêm record theo `game|difficulty|rules` để không trộn kỷ lục các mức. Kỷ lục tổng cũ vẫn đọc được; hòa không tăng số thắng.
- `hh.all-game.checkpoints.v1:<owner>` giữ tối đa **8** ván đang chơi trên thiết bị, theo game/độ khó/rules version. Snapshot có giới hạn độ sâu, số phần tử và kích thước; dữ liệu lỗi hoặc storage đầy báo đúng trạng thái. Tạm dừng/rời game lưu checkpoint; reload cùng tài khoản phục hồi dưới dạng tạm dừng, không tự tăng lượt chơi.
- Phiên RAM có giới hạn 48 ván; checkpoint bền vững giới hạn 8 để tránh đầy localStorage. Không có đồng bộ cloud hoặc chia sẻ điểm giữa thiết bị trong release này.
- Release 1061; loader 722; router script 295; platform-home 20; All Game host/CSS/scenes và sáu bundle cũ v3, catalog v2; Studio assets mới v1. Service Worker và manifest cập nhật đồng bộ, giữ marker release trước để kiểm tra tương thích.

## Kiểm thử và bằng chứng

Lệnh tái lập:

```text
npm run test:all-game
npm run test:all-tools
node scripts/qa-all-game.js
node scripts/qa-all-game-color.js
node scripts/qa-all-game-studio.js
```

Đặt `HH_QA_PLAYWRIGHT` tới module Playwright/Playwright Core và `HH_QA_CHROMIUM` tới Chromium khi máy không có bản cài mặc định. Có thể đặt `HH_QA_OUTPUT` để đổi thư mục kết quả. QA không thêm dependency runtime.

- **413/413** kiểm tra All Game đạt, không bỏ qua test; bao gồm bài kiểm tra trình duyệt hiện có. **241/241** kiểm tra All Tools/shell/routing/release đạt.
- `qa-all-game.js`: shell website thật, CSP thật, đủ **109** route/game, sidebar, command registry, bộ lọc, favorite theo owner, Back/Forward, input, pause/resume/restart, checkpoint sau reload, lỗi tải/retry, storage lỗi và cleanup RAF. API auth/vote/backend không có ở static test server được chặn/thay bằng dữ liệu thử minh bạch; không kiểm tra backend tài khoản live.
- `qa-all-game-color.js`: mỗi **109** game ở **1440/768/375px**, bắt đầu, input, pause/resume, ván mới, resize/Canvas/DOM alignment, DPR2, zoom 200%, forced colors, kết quả thắng/thua thật ở puzzle đại diện. Không có uncaught JS/CSP error.
- `qa-all-game-studio.js`: thao tác bằng chuột/phím/nút giao diện thật và đọc state để kiểm chứng **50** cơ chế riêng. Không chèn state trong trình duyệt. Mỗi game chụp desktop và mobile sau hành động; kiểm tra nút lệnh 44px, pause đóng băng state, cleanup, checkpoint và phân tách tài khoản.
- `tests/all-game-studio-outcomes.test.js`: đủ **50 thắng + 50 thua** được kích hoạt bởi hành động/va chạm/timer hợp lệ từ fixture gần cuối ván; không gán cờ kết quả để làm test qua. Đây là kiểm thử nhánh kết thúc, **không** phải bằng chứng chơi trọn cả 50 game từ đầu trong trình duyệt.
- Kiểm tra từ ván mới: sáu đợt tower defense (66 địch), chiến dịch RTS, mục tiêu 4X, dây chuyền tám sản phẩm, giàn cầu trong ngân sách đi qua tải xe thật, đủ ba bài drone bằng chương trình, thuộc địa mười ngày, sinh thái tám mùa và thắng/thua quy hoạch ghép mảnh. Seed cố định giúp tái hiện; chưa chứng minh cân bằng mọi seed và mọi mức khó.
- Luật chuyên biệt: cờ vua chiếu/nhập thành/en passant/phong cấp/hòa; bắt chuỗi đam; khí/ko/tự sát/điểm vây; bảo toàn hạt Mancala; Hex nối cạnh; tường giữ đường đi; AI tàu/cấp bậc không đọc thông tin bí mật; bom dây chuyền; momentum dây/cổng/sumo; bóng pinball; cắt vùng; raycast tầm nhìn; giàn FEM và compiler drone.

Ảnh/log QA cục bộ ở `.study-local/all-game-deep-1061/`, `.study-local/all-game-studio-1061/`, `.study-local/all-game-shell-1061/` và `.study-local/all-game-1061/`. Không commit profile trình duyệt hoặc hàng trăm ảnh PNG. Ảnh tổng hợp và bản xem thư viện được tạo từ ảnh Chromium thật để tự đánh giá, không thay bằng mockup.

Giới hạn thực tế: Chromium headless với mobile emulation, chưa thử máy iOS/Android vật lý hoặc mọi trình duyệt. AI cục bộ gọn, đặc biệt cờ vua/cờ vây không phải engine thi đấu; các mức Tiêu chuẩn/Khó của một số game cờ dùng cùng heuristic. Bridge là giàn đàn hồi tuyến tính đơn giản; động học/va chạm dùng mô hình 2D phục vụ game. Không có multiplayer, backend điểm số mới, âm nhạc hoặc asset bên ngoài. Không tuyên bố đã chơi tay đến kết thúc mọi campaign, hoặc đã cân bằng đầy đủ 109 game như một studio QA chuyên nghiệp.

Nguồn và giấy phép: [ALL_GAME_STUDIO_REFERENCES.md](ALL_GAME_STUDIO_REFERENCES.md).

## 50 game mới — đối chiếu cơ chế và điều kiện kết thúc

Mỗi dòng dưới có engine riêng cho hệ luật, không dùng thay tên/màu để đếm thêm game. Cột cuối đối chiếu cả game cũ gần nhất và game mới gần nhất. Tất cả ID có route `/all-game/<id>`; các bundle mới đều tải theo nhu cầu.

| ID / tên | Nhóm | Thao tác / mục tiêu | Tài nguyên | Kết thúc | Khác game cũ gần nhất | Khác game mới gần nhất |
|---|---|---|---|---|---|---|
| fortress-weave<br>**Pháo Đài Lăng Kính** | Chiến thuật | Chọn ô đất để xây/nâng tháp; chọn loại tháp và bắt đầu đợt bằng các nút.<br>Giữ tuyến qua sáu đợt | Vàng, căn cứ 12, ba tháp và ba cấp | Thắng đợt 6; thua căn cứ hết sức bền | shield-defense: Bố trí nhiều tháp và tài nguyên thay cho xoay một khiên. | sky-interceptor: tháp đặt trên bản đồ tự chọn mục tiêu, thay vì tự ngắm từng tên lửa |
| frontier-command<br>**Mặt Trận Bình Minh** | Chiến thuật | Chọn đơn vị rồi điểm đến; công nhân tự khai thác, dùng các nút xây doanh trại và tuyển quân.<br>Khai thác, xây và chiếm căn cứ | Tinh thể, công nhân, quân, doanh trại, hai căn cứ | Thắng phá căn cứ địch; thua mất căn cứ mình | star-guard: Kinh tế, nhiều đơn vị và mục tiêu căn cứ; không điều một tàu bắn. | nexus-conquest: đơn vị vật lý, công nhân mang quặng và sản xuất; không chỉ chuyển số quân giữa nút |
| hex-vanguard<br>**Biệt Đội Lục Giác** | Chiến thuật | Chọn chiến binh rồi chọn ô đến hoặc địch trong tầm; Kết lượt cho máy đi.<br>Dùng đội hình AP chiếm cờ hoặc hạ địch | Ba quân, AP 3, cover, HP, 18 lượt | Thắng hạ hết địch hoặc tới cờ; thua hết đội/quá lượt | knights-tour: Đội hình đối kháng có AP/sát thương, không đi mã phủ ô. | royal-chess: nhiều hành động mỗi quân, tầm bắn, cover và đánh sườn; không luật cờ vua |
| island-dominion<br>**Vương Quốc Quần Đảo** | Chiến thuật | Chọn đảo rồi Khám phá, Định cư hoặc Nghiên cứu; kết lượt để thu tài nguyên.<br>Giữ hải đăng và nghiên cứu | Đất, sương mù, vàng, lương, quân, công nghệ, AP | Thắng hai hải đăng và công nghệ 2; thua sau lượt 16, hết tinh thần hoặc mất đất | color-flood: Đảo có quân đồn trú, sản lượng và công nghệ; không tô vùng một màu. | frontier-colony: khám phá/chiếm lãnh thổ, đồn trú và nghiên cứu; không chỉ phân việc trong một căn cứ |
| hidden-fleet<br>**Hạm Đội Bí Mật** | Chiến thuật | Chọn ô đặt tàu, đổi chiều bằng nút; sau triển khai bắn hoặc dùng sonar giới hạn.<br>Triển khai tàu rồi suy luận vị trí | Ba tàu 3/2/2 ô, hai sonar, bàn bí mật | Thắng đánh chìm toàn bộ tàu địch; thua mất hạm đội | treasure-grid: Hai đội tàu đối kháng, bố trí và tàu chìm thay vì tìm kho báu cố định. | hidden-ranks: ẩn vị trí tàu cố định và suy luận hit/miss; không di chuyển/so cấp quân |
| crater-command<br>**Pháo Binh Địa Hình** | Chiến thuật | Trái/phải chỉnh góc, lên/xuống chỉnh lực; chọn đạn, di chuyển hoặc khai hỏa.<br>Đấu pháo tính gió và địa hình | Góc/lực, HP hai xe, nhiên liệu, ba đạn nặng | Thắng xe địch hết HP; thua xe mình hết HP | basket-shot: Đối thủ, địa hình biến dạng và vị trí chiến thuật thay cho ném vào rổ. | polarity-workshop: vật thể bay theo lực ban đầu và phá địa hình; không đổi trường lực liên tục |
| nexus-conquest<br>**Chinh Phục Trạm Năng Lượng** | Chiến thuật | Chọn trạm mình rồi trạm đích để gửi nửa lực lượng; có thể ra lệnh khi đang hành quân.<br>Chiếm mạng chín trạm | Quân sinh ở trạm, đoàn quân, thời gian di chuyển, 180 giây chuẩn | Thắng chín trạm hoặc nhiều trạm hơn khi hết giờ; thua hết trạm/quân hoặc ít trạm hơn; hòa bằng trạm | orbit-collect: Chiếm quyền sở hữu trạm bằng quân số, không lái vật thể quỹ đạo. | frontier-command: đồ thị cố định, quân số trừ trực tiếp và viện quân; không worker, kinh tế hoặc đội quân vật lý |
| squad-draft<br>**Đấu Trường Đội Hình** | Chiến thuật | Mua quân ở chợ, chọn quân dự bị và ô đội hình; bắt đầu trận khi đã sẵn sàng.<br>Mua/ghép và bố trí đội hình năm vòng | Vàng, shop, dự bị 8, đội hình 6, bốn vai trò, ba mạng | Thắng vượt vòng 5; thua hết mạng hoặc thua vòng cuối | connect-four: Xây đội quân có chỉ số/đặc tính, không tạo hàng bốn quân. | forge-expedition: thắng bằng composition, merge và synergy; không chế tạo chỉ số qua rèn |
| runedeck-quest<br>**Chinh Phục Cổ Ngữ** | Chiến thuật | Chọn lá bài hợp lệ; kết lượt khi hết năng lượng; chọn một phần thưởng sau trận.<br>Xây bộ bài qua năm trận | Bộ rút/tay/bỏ, năng lượng 3, khiên, combo, HP, bài thưởng | Thắng trận 5; thua HP bằng 0 | code-breaker: Quản lý bộ bài và chiến đấu theo lượt, không đoán mã màu. | dice-expedition: bài giữ lại qua chiến dịch và deck cycling; không gieo lại/phân vai xúc xắc |
| royal-chess<br>**Cờ Vua Hoàng Gia** | Chiến thuật | Chọn quân rồi ô hợp lệ; chọn quân phong cấp ở bảng thao tác khi tốt tới cuối bàn.<br>Bảo vệ vua và chiếu hết | 32 quân chuẩn, quyền nhập thành, en passant, phong cấp | Chiếu hết thắng/thua; bí nước/lặp ba/50 nước/thiếu lực lượng cơ bản là hòa | n-queens: Đối thủ và toàn bộ quân/luật cờ vua thay cho bài toán sáu hậu. | crown-draughts: sáu loại quân, vua bị chiếu và nước đặc biệt; không nhảy bắt chéo |
| crown-draughts<br>**Cờ Đam Vương Miện** | Chiến thuật | Chọn quân sáng rồi ô đi; khi đang bắt liên tiếp phải tiếp tục cùng quân đó.<br>Đam Anh bắt bắt buộc và chuỗi nhảy | 12 quân mỗi phe, phong vua ngắn, bộ đếm nước yên | Thắng đối thủ hết quân/nước; thua tương ứng; hòa 80 nửa lượt yên | peg-solitaire: Hai phe đối kháng, luật hướng đi và phong vua; không còn một quân là thắng. | royal-chess: chuỗi nhảy cùng quân, phong vua kết lượt; không chiếu, nhập thành hoặc phong cấp lựa chọn |
| lotus-go<br>**Cờ Vây Hoa Sen** | Chiến thuật | Chọn giao điểm để đặt quân đen; Bỏ lượt hai phía để tính điểm diện tích.<br>Giữ khí và tạo diện tích bàn 9×9 | Nhóm quân, khí, ko, pass, komi 6,5 | Hai pass chốt điểm quân/vùng; nhiều điểm thắng, ít điểm thua | reversi-mini: Bắt nhóm hết khí và tính vùng, không kẹp lật quân theo hàng. | bridge-hex: bắt nhóm hết khí và chấm diện tích; không chỉ nối hai cạnh |
| seed-duel<br>**Cờ Hạt Ánh Dương** | Chiến thuật | Chọn một hố phía mình có hạt; kho và lượt rải được xử lý theo luật Kalah.<br>Kalah rải hạt và tích kho | 48 hạt, 12 hốc, hai kho, thêm lượt, bắt đối diện | Một hàng trống thì quét hạt; kho nhiều hơn thắng, ít hơn thua, bằng hòa | towers-hanoi: Phân phối tài nguyên đối kháng thay cho di chuyển đĩa theo kích cỡ. | auction-guild: tài nguyên luân chuyển có luật rải/ăn/lượt thêm; không đấu giá vốn |
| bridge-hex<br>**Cầu Nối Lục Giác** | Chiến thuật | Chọn ô trống; xanh nối trên–dưới, hồng nối trái–phải; máy đi sau bạn.<br>Nối hai cạnh bằng chuỗi lục giác | 49 giao điểm, sáu láng giềng, hai phe | Bạn nối trên–dưới thắng; máy nối trái–phải thua | connect-four: Kết nối cạnh qua đường bất kỳ, không căn bốn quân thành hàng. | lotus-go: quân không bị bắt, không điểm vùng hay ko; chỉ kết nối cạnh |
| hidden-ranks<br>**Cờ Mật Lệnh** | Chiến thuật | Ở triển khai đổi vị trí hai quân; Sẵn sàng rồi chọn quân và ô kề để di chuyển/đấu.<br>Triển khai và dò cấp bậc, chiếm cờ | Bàn 6×6, cấp ẩn, bom/cờ/spy/scout/engineer, thông tin lộ | Thắng chiếm cờ hoặc khóa nước địch; thua mất cờ/hết nước | memory: Suy luận quân ẩn qua chiến đấu, không lật ghép cặp. | hidden-fleet: cấp bậc ẩn của quân có thể di chuyển/đánh; không tàu cố định và lượt bắn |
| wall-race<br>**Cờ Chặn Lối** | Chiến thuật | Chọn ô kề để đi; bật chế độ Tường và chọn cạnh; đổi hướng tường khi cần.<br>Tới cạnh đích, đặt tường giữ đường hợp lệ | Hai pawn, năm tường mỗi phe, tường hai cạnh, pathfinding | Tới hàng đích trước thắng; máy tới trước thua | maze-path: Hai người thay đổi mê cung trong ván, không đi một mê cung có sẵn. | bridge-hex: pawn di chuyển và cạnh bị chặn nhưng vẫn phải có đường; không đặt chuỗi quân nối cạnh |
| auction-guild<br>**Hội Đấu Giá** | Chiến thuật | Tăng giá hoặc bỏ lượt; thắng lô trả tiền thật trong ván, hoàn tất tám phiên đấu.<br>Đấu tám lô để tối ưu tài sản | Vàng, định giá riêng, giá tăng, bộ sưu tập ba loại | Sau tám lô so vàng + giá trị + bộ; thắng/thua/hòa theo tổng | cafe-orders: Cạnh tranh giá và vốn với máy, không chọn nguyên liệu theo công thức. | tide-merchants: cạnh tranh đấu giá và set bonus; không giao dịch giá niêm yết và đi cảng |
| dice-expedition<br>**Xúc Xắc Viễn Chinh** | Chiến thuật | Chọn xúc xắc để giữ; gieo lại tối đa hai lần, rồi phân bổ và chốt lượt.<br>Giữ/gieo lại và phân vai năm xúc xắc | Hai lần gieo lại, hold, attack/guard/heal, skull risk, HP | Thắng trận 4; thua đội hết HP | reaction-stop: Quyết định xác suất và tài nguyên theo lượt, không bấm theo tín hiệu. | runedeck-quest: ngẫu nhiên có giới hạn và gán kết quả vào vai; không xây/rút bộ bài |
| gem-tactics<br>**Chiến Trận Ngọc** | Chiến thuật | Chọn hai viên kề nhau; chỉ nước tạo bộ ba hợp lệ được chốt; dùng kỹ năng khi đủ năng lượng.<br>Match-3 sinh công/thủ/mana qua ba boss | 36 ngọc, swap kề, cascade, khiên, HP, mana | Thắng boss 3; thua HP về 0 | merge: Đổi hai ô và xóa bộ ba, không trượt bàn hay cộng ô bằng nhau. | bubble-reactor: đổi hai ô cố định và sinh tài nguyên chiến đấu; không bắn bóng/nhóm neo |
| dungeon-chronicle<br>**Hầm Ngục Theo Lượt** | Phiêu lưu | Mũi tên hoặc ô kề để đi/đánh; dùng Bình máu và Khiên khi cần, tới cầu thang để xuống tầng.<br>Khám phá ba tầng, đánh boss cuối rồi thoát | Lương, bình máu, khiên, vũ khí, chìa khóa, fog, HP | Thắng thoát tầng 3 sau hạ boss; thua HP về 0 | crate-lab: Chiến đấu, loot và quản lý máu; không đẩy thùng tới đích. | hex-vanguard: một nhân vật, đồ nhặt, đói và dungeon nhiều tầng; không đội hình AP |
| blast-grid<br>**Đấu Trường Bom** | Hành động | Bốn hướng di chuyển; Hành động đặt bom; tránh toàn bộ đường nổ kể cả bom mình.<br>Đặt bom, phá crate và giữ đường thoát | Sức chứa bom, tầm nổ, vật phẩm, timer, bot né nguy hiểm | Bot trúng nổ thắng, mình trúng thua; cùng trúng/hết giờ hòa | mines: Bom do người chơi đặt và né theo thời gian, không suy luận mìn tĩnh. | frontier-trail: chiến đấu bằng nổ có delay/chain và phá vật cản; không khép đường chiếm đất |
| street-vanguard<br>**Vệ Binh Đường Phố** | Hành động | Bốn hướng đi; Hành động đấm, Q hất, E lướt; chọn đúng khoảng cách và hướng.<br>Vượt ba khu phố cuộn ngang | HP, thể lực, combo, đấm/uppercut/dash, địch báo đòn | Hạ hết địch và tới cổng khu 3 thắng; hết HP thua | orbit-runner: Vượt khu bằng chiến đấu nhóm, không nhảy bục để tìm cổng. | blade-duel: nhiều địch, lane dọc, knockback và camera cuộn; không duel 1v1 cố định |
| blade-duel<br>**Kiếm Đấu** | Hành động | Trái/phải giữ cự ly; Hành động chém, Q đỡ, E phá thủ theo tín hiệu địch.<br>Đấu ba hiệp bằng khoảng cách và phản đòn | HP, stamina, block/parry, guard break, cooldown | Hạ đối thủ hiệp 3 thắng; hết HP thua | lock-timing: Có cự ly, thế đánh, AI và quản lý thể lực, không dừng kim trong vòng. | street-vanguard: cửa sổ parry/guard và chu kỳ báo đòn 1v1; không quét nhóm ở nhiều lane |
| silent-infiltrator<br>**Đột Nhập Bóng Đêm** | Hành động | Bốn hướng đi; Q gây tiếng động tại điểm ngắm, E dùng khói; lấy hồ sơ rồi về vùng xanh.<br>Lấy hồ sơ rồi rút lui | Tầm nhìn, raycast tường, suspicion, noise, smoke, thời gian/HP | Mang hồ sơ tới extraction thắng; hết HP/thời gian thua | maze-path: Có tuần tra, phát hiện, công cụ và hành trình lấy–rút thay cho tìm lối tĩnh. | dungeon-chronicle: tránh phát hiện theo thời gian thực và đánh lạc hướng; không địch phản ứng mỗi lượt |
| grapple-sky<br>**Móc Treo Trên Không** | Hành động | Ngắm/bấm điểm bám để móc; Hành động thả/móc, trái/phải lấy đà, lên/xuống chỉnh dây.<br>Đu dây qua năm bến | Dây đổi chiều dài, điểm móc, vận tốc tiếp tuyến, checkpoint, mạng/giờ | Tới bến cuối thắng; hết mạng/giờ thua | sky-glider: Con lắc từ điểm neo và bảo toàn quán tính, không nâng qua cổng. | titan-ascent: chuyển động tự do theo quán tính dây; không bám chuỗi grip và stamina boss |
| returning-blade<br>**Lưỡi Dao Hồi Quy** | Hành động | Bốn hướng đi; ngắm chuột/chạm, Hành động ném; Q gọi về, E lướt bắt dao.<br>Ném/căn đường về, bắt lại để giữ combo | Một vũ khí, hai pha hit, recall, dash, combo, HP | Thắng bốn đợt; hết HP thua | star-guard: Đường hồi và bắt vũ khí quyết định chiến đấu, không bắn đạn liên tục. | kinetic-arena: một vũ khí hồi về và timing bắt; không nâng nhiều vật thể có khối lượng |
| frontier-trail<br>**Chiếm Vùng Ánh Sáng** | Hành động | Bốn hướng đi; rời biên để vẽ, quay về vùng an toàn để chiếm miền.<br>Khép đường chiếm 65% vùng | Ô an toàn, trail dễ bị cắt, roaming enemies, mạng/giờ | Đạt 65% thắng; hết mạng/giờ thua | snake: Mục tiêu diện tích và đóng miền, không ăn để kéo dài thân rắn. | blast-grid: tách vùng bằng flood fill và tránh cắt trail; không gây sát thương bằng bom |
| crystal-excavator<br>**Thợ Mỏ Vực Sâu** | Hành động | Bốn hướng đào/đi; Hành động dùng mũi khoan, chú ý đá rơi khi mất điểm tựa.<br>Đào quặng và cứu hai người về cửa | Đất/đá rơi/khí, quặng, drill, oxy, tải mang, mạng | Đưa hai người + năm quặng về thắng; hết oxy/mạng/giờ thua | crate-lab: Thay đổi đất và đá rơi, không đẩy khối theo bài Sokoban. | abyss-rescue: đào terrain thay đổi với đá rơi từng ô; không bơi có dòng chảy và buoyancy |
| kinetic-arena<br>**Đấu Trường Niệm Lực** | Hành động | Bốn hướng đi; chọn vật bằng con trỏ, Hành động nhấc/ném, Q xoay, E dựng khiên.<br>Nhấc, giữ, ném và chắn trong ba đấu trường | Bảy vật thể có mass/radius, stamina, orbit, projectile, HP | Hạ địch đấu trường 3 thắng; hết HP thua | target-range: Vật thể môi trường có động lượng và phòng thủ, không bấm vào bia. | returning-blade: vật môi trường nhiều khối lượng, va chạm dây chuyền và chắn đạn; không vũ khí hồi quy duy nhất |
| portal-courier<br>**Sứ Giả Cổng Không Gian** | Phiêu lưu | Chọn bề mặt để đặt cổng A/B; bốn hướng đi/nhảy, Hành động nhặt/thả kiện; đổi cổng bằng nút.<br>Dùng cổng và quán tính giao kiện qua ba phòng | Hai cổng có pháp tuyến, mount, vận tốc, gravity, crate, carry, mạng/giờ | Kiện hạ ổn định tại bến phòng 3 thắng; hết mạng/giờ thua | pipe-link: Dịch chuyển vật thể giữ động lượng, không xoay ống nối nguồn. | polarity-workshop: vận chuyển qua hai đầu không gian và đổi hướng vận tốc; không lực điện từ từ xa |
| ring-sumo<br>**Võ Đài Vòng Tròn** | Hành động | Bốn hướng đi; Hành động lao đẩy, Q ghìm chống đẩy, E né ngang khi đủ thể lực.<br>Lấy vị trí, tích lực và đẩy ra vòng | Động lượng, brace đổi mass/drag, charge/dodge, stamina | Thắng ba ring-out thắng; bị loại ba hiệp thua | paddle-duel: Va chạm hai đấu sĩ và đẩy khỏi vòng, không đỡ bóng. | blade-duel: điều kiện vị trí/động lượng, không trừ HP bằng lưỡi kiếm |
| titan-ascent<br>**Chinh Phục Hộ Vệ Khổng Lồ** | Phiêu lưu | Bốn hướng leo; Hành động bám/nghỉ, Q phá điểm yếu khi tới gần; nghỉ ở bệ an toàn.<br>Leo boss động và phá ba điểm yếu | 11 grip, stamina, perch nghỉ, shake/brace, mạng/giờ | Phá điểm 3/6/9 rồi tới đỉnh thắng; hết mạng/giờ thua | jump-tower: Bám và đánh boss theo pha thay cho nhảy lên bục tĩnh. | grapple-sky: bám grip chuyển động, leo có stamina và phá yếu điểm; không đu rope tới đích |
| sky-hoist<br>**Cứu Hộ Cáp Treo** | Hành động | Trái/phải chỉnh lực ngang, lên giữ độ cao, xuống giảm lực; Q/E thu/thả tời, Hành động móc/thả người.<br>Điều khiển trực thăng/tời cứu ba người | Thrust, gió, dao động dây, tải trọng, móc, HP/giờ | Thả đủ ba người tại bãi xanh thắng; hết HP/giờ thua | coin-catcher: Vận chuyển người bằng dây có quán tính, không hứng vật rơi bằng giỏ. | abyss-rescue: hai vật nối dây và tời có tải; không người bơi giữ oxy |
| trial-rider<br>**Mô Tô Địa Hình** | Đua xe | Lên ga, xuống phanh; trái/phải nghiêng trọng tâm; Hành động trở lại checkpoint khi ngã.<br>Vượt tuyến mô tô và tiếp đất | Hai bánh constraint, terrain contact, lean torque, ga/phanh, checkpoint | Tới mốc 1950 thắng; hết năm mạng/giờ thua | road-rush: Vật lý bánh/khung và tiếp đất, không đổi làn né xe. | apex-drift: mặt cắt dọc và độ nghiêng hai bánh; không đua mặt phẳng checkpoint vòng |
| apex-drift<br>**Đường Đua Drift** | Đua xe | Lên ga, xuống phanh/lùi, trái/phải đánh lái; Hành động phanh tay để tạo drift.<br>Hoàn thành ba vòng đúng checkpoint | Gia tốc, hướng liên tục, grip/slip, phanh tay, drift chain, giờ | Qua ba vòng đúng thứ tự thắng; hết giờ thua | road-rush: Đánh lái liên tục và drift theo vòng, không chạy thẳng đổi làn. | trial-rider: quán tính ngang, drift và vòng kín; không địa hình đứng/hai bánh |
| prism-pinball<br>**Pinball Lăng Kính** | Phản xạ | Trái/phải giữ cần gạt, lên hoặc Hành động kéo/phóng bóng; theo dõi bumper và nhiệm vụ.<br>Dùng cần gạt đạt 2.200 điểm | Bóng trọng lực, flipper động, bumper, multiplier, drain, lives | Đủ điểm thắng; hết bóng thua | breakout: Hai flipper, bàn vật lý có bumper và đường hồi, không thanh đỡ phá gạch. | bubble-reactor: một bóng tự do chịu trọng lực và flipper; không bắn gắn cụm màu |
| bubble-reactor<br>**Lò Phản Ứng Bong Bóng** | Trí tuệ | Ngắm chuột/chạm hoặc trái/phải; Hành động bắn, Q đổi bóng dự trữ.<br>Bắn/bật tường tạo nhóm và bỏ neo | Cụm lục giác 10×9, dự trữ bóng, chuỗi cùng màu, hàng dâng | Xóa bảng 3 thắng; không chỗ gắn hoặc bóng quá vạch thua | memory: Ghép cụm qua quỹ đạo bắn, không ghi nhớ thẻ úp. | gem-tactics: ngắm đạn liên tục và flood nhóm ≥3/drop unanchored; không đổi ô và combat tài nguyên |
| abyss-rescue<br>**Thợ Lặn Cứu Hộ** | Phiêu lưu | Bốn hướng bơi; Hành động cắt lưới/đón/thả người; Q dùng bình oxy dự phòng.<br>Cắt lưới, đưa ba nạn nhân về tàu | Dòng chảy, lực nổi, oxy/dự trữ/trạm khí, tải, reef, HP/giờ | Đưa đủ ba người về tàu thắng; hết HP/giờ thua | meteor-dodge: Quản lý oxy, mang người và trạm khí; không chỉ né để sống sót. | sky-hoist: bơi sâu với sức cản/oxy và trạm khí; không dây tời trực thăng |
| sky-interceptor<br>**Lưới Lửa Bầu Trời** | Hành động | Ngắm chuột/chạm hoặc hướng; Hành động bắn, chọn bệ phóng có đạn bằng nút.<br>Dự đoán quỹ đạo, bảo vệ ba thành phố năm đợt | Ba bệ đạn 12, thời gian đạn bay, blast tăng/giảm, split missile | Qua đợt 5 còn thành phố thắng; mất hết thành phố thua | shield-defense: Chủ động dự đoán vùng nổ cho nhiều thành phố, không xoay khiên quanh lõi. | fortress-weave: chọn điểm nổ và bệ bắn theo timing; không xây/nâng mạng tháp trên tuyến cố định |
| polarity-workshop<br>**Xưởng Từ Trường** | Trí tuệ | Bấm để đặt nam châm; Hành động đảo cực, trái/phải chỉnh vị trí; dẫn hạt qua các bến theo thứ tự.<br>Dẫn hạt qua ba cổng vào dock ba phòng | Điện tích, lực hút/đẩy, nam châm kéo được, năng lượng, vận tốc/giờ | Hạt qua cổng và dừng trong dock phòng 3 thắng; hết giờ thua | ball-balance: Trường lực nhiều cực và cổng điện tích, không nghiêng một mặt bàn. | portal-courier: lực điện biến thiên liên tục và đổi cực; không dịch chuyển tức thời qua cổng đôi |
| forge-expedition<br>**Lò Rèn Viễn Chinh** | Mô phỏng | Chọn vật liệu; điều nhiệt, búa tạo hình, tôi rồi lắp; chọn trang bị phù hợp trước trận.<br>Rèn đồ có chất lượng rồi đánh ba chặng | Vật liệu/nhiệt/fuel, năm độ dày, cracks, quench, cán, công/thủ, HP/vàng | Thắng chặng 3; đội hết HP thua | lock-timing: Chuỗi chế tạo có vật liệu/hình dạng và hệ quả chiến đấu, không dừng kim. | squad-draft: quy trình chế tạo quyết định stat thực; không mua/ghép đội hình và auto combat |
| factory-flow<br>**Dây Chuyền Tinh Thể** | Mô phỏng | Chọn công cụ rồi ô để đặt; xoay hướng bằng nút; Chạy/Dừng thử dây chuyền và sửa điểm nghẽn.<br>Xử lý nguyên liệu, tối ưu hàng đợi | Vốn, belt, refiner, assembler hai-input, queues/backpressure, 150 giây chuẩn | Giao tám sản phẩm hoàn chỉnh thắng; hết giờ thua | pipe-link: Sản xuất và vận chuyển vật phẩm rời rạc, không nối một đường ống. | rail-dispatch: mạng sản xuất với công thức và queue; không phương tiện theo timetable/ga màu |
| rail-dispatch<br>**Nhà Ga Điều Phối** | Chiến thuật | Chọn ghi để đổi nhánh, chọn tín hiệu để giữ/thả tàu; quan sát đường chung và ga đích.<br>Đưa tàu đúng ga không xung đột | Ghi, tín hiệu, đoạn chung, queue, lịch 12 chuyến, mistakes/giờ | Giao mười tàu an toàn thắng; ba sự cố hoặc hết lịch/giờ chưa đủ thua | road-rush: Điều phối nhiều tàu và tài nguyên đoạn đường, không lái xe né làn. | factory-flow: phương tiện có lộ trình, tín hiệu và va chạm; không biến đổi hàng bằng máy |
| tide-merchants<br>**Thương Hội Thủy Triều** | Mô phỏng | Chọn hàng để mua/bán, chọn cảng rồi ra khơi; cân đối tải, phí và thời tiết từng tuyến.<br>Đạt tài sản 130 qua giao dịch cảng | Bốn cảng, ba hàng hóa, cargo 6, giá cung cầu, fare, thời tiết/bảo hiểm, HP | Đến ngày 14 hoặc quyết toán: tài sản ≥130 thắng, thấp hơn thua; chìm tàu thua | treasure-grid: Giao dịch theo giá và hành trình, không khám phá ô tìm tài sản. | auction-guild: mua/bán niêm yết theo cảng và rủi ro vận chuyển; không đấu tăng giá với máy |
| frontier-colony<br>**Thuộc Địa Mùa Đông** | Chiến thuật | Chọn công việc để phân người, dùng nút Thu hồi khi cần; kết ngày sau khi cân đối nguồn lực.<br>Sống mười ngày, xây tám đoạn hải đăng | Sáu lao động/vị trí giới hạn, lương, củi, tools, health, morale, dự báo | Ngày 10 còn HP và beacon≥8 thắng; hết HP hoặc thiếu hải đăng thua | garden-care: Phân phối lao động đa ngành và hậu cần theo ngày, không tưới cây. | island-dominion: phân công lao động, thiếu hụt và thời tiết; không sương mù/chiếm đảo |
| wildfire-command<br>**Chỉ Huy Cứu Hỏa** | Chiến thuật | Chọn đội rồi ô đến; chọn Dập lửa/Tạo vành đai, tiếp nước ở trạm, kết lượt để mô phỏng cháy.<br>Dập cháy/tạo firebreak, sơ tán ba người | Ba đội AP3, nước5, gió/nhiên liệu lửa, cargo, căn cứ, 24 lượt | Đưa ba người về căn cứ thắng; người chết/căn cứ hết HP/quá lượt thua | color-flood: Đội cứu hộ, lan cháy đối kháng môi trường và tài nguyên; không đổi màu vùng. | frontier-colony: mô phỏng lan lửa không gian và điều đội cứu hộ; không phân bổ sản lượng theo ngày |
| bridgeworks<br>**Kỹ Sư Cầu** | Trí tuệ | Chọn hai nút để nối thanh, chọn vật liệu; Thử tải để xe đi qua, sửa thanh bị quá tải.<br>Nối thanh trong vốn, chịu tải xe | Mười nút, gỗ/thép, độ cứng, lực dọc, ứng suất/độ võng, năm lần thử | Xe tới bờ kia trên kết cấu ổn định thắng; hết lần thử thua | stack-tower: Thiết kế kết cấu phân lực, không thả khối chồng theo phần giao. | castle-mosaic: tính ma trận giàn và lực chịu tải; không chỉ xếp ô và điểm kề nhau |
| drone-programmer<br>**Lập Trình Drone** | Giáo dục | Thêm lệnh ở bảng công cụ; dùng Lặp/Điều kiện, Chạy hoặc Từng bước để kiểm tra chương trình.<br>Lập chương trình lấy pin/tới bến ba bài | 32 token, LOOP2, IF cảm biến, bytecode/stack, năng lượng bước | Hoàn tất bài 3 thắng; hết ngân sách bước thua; đụng tường/hết chương trình cho sửa lại | maze-path: Lập thuật toán rồi thực thi, không điều khiển trực tiếp đi từng ô. | dungeon-chronicle: chương trình soạn trước và máy ảo thực thi; không điều người từng bước trực tiếp |
| living-world<br>**Kiến Tạo Hệ Sinh Thái** | Mô phỏng | Chọn ô và công cụ địa hình/trồng/thả loài; chuyển mùa, đọc chỉ số và cân bằng nguồn thức ăn.<br>Giữ chuỗi thức ăn ba mùa liên tiếp | Nước/rừng, sinh khối cây, ăn cỏ/săn mồi, mưa, AP/điểm sinh thái | Từ mùa 8 có ba mùa đạt ngưỡng thắng; hết mùa 12 chưa đủ thua | garden-care: Quần thể và chuỗi thức ăn có phản hồi, không chăm từng chậu theo lịch. | frontier-colony: dân số động với sức chứa, ăn mồi và di cư; không cân đối tài nguyên tuyến tính mỗi ngày |
| castle-mosaic<br>**Vương Quốc Ghép Mảnh** | Trí tuệ | Chọn vị trí đặt mảnh đang có; xoay bằng nút; theo dõi thưởng liền kề và mục tiêu từng khu.<br>Quy hoạch polyomino theo công năng | Bàn 7×7, hồ, 12 mảnh, xoay, hai discard, adjacency và mục tiêu | Đặt≥10 mảnh, đủ điểm + hai homes/farms đạt chuẩn thắng; hết mảnh/chỗ và không bỏ được thua | block-drop: Quy hoạch tĩnh theo công năng/liền kề, không khối rơi hay xóa hàng. | bridgeworks: xếp công trình theo lưới và điểm liền kề; không kết cấu cơ học/nút thanh |

## Checklist 109 game

Dấu ✓ nghĩa là đã đối chiếu engine/catalog, có thay đổi hình ảnh trong vùng chơi và đã chạy QA điều khiển/vòng đời ở 1440/768/375px. 59 dòng đầu là danh mục ban đầu ở commit `8c7cf6c`; 50 dòng sau là phần mới. Với 50 game mới có thêm bài input theo cơ chế, ảnh desktop/mobile và nhánh thắng/thua. Đây không phải tuyên bố chơi tay hết mọi game.

| ID | Tên | Engine | Vùng chơi / hình ảnh | Input + pause/resume/restart + responsive |
|---|---|---|---|---|
| snake | Neon Snake | arcade | ✓ Palette thân tàu/rắn/gạch và vật liệu Canvas | ✓ |
| breakout | Prism Breaker | arcade | ✓ Palette thân tàu/rắn/gạch và vật liệu Canvas | ✓ |
| star-guard | Star Guard | arcade | ✓ Palette thân tàu/rắn/gạch và vật liệu Canvas | ✓ |
| merge | Neon Merge | puzzles | ✓ Bevel bảng, ô số, Mines và Memory có tone riêng | ✓ |
| mines | Crystal Mines | puzzles | ✓ Bevel bảng, ô số, Mines và Memory có tone riêng | ✓ |
| memory | Memory Constellation | puzzles | ✓ Bevel bảng, ô số, Mines và Memory có tone riêng | ✓ |
| block-drop | Block Drop | adventure | ✓ Khối facet, crate, nhân vật và platform bão hòa hơn | ✓ |
| crate-lab | Crate Lab | adventure | ✓ Khối facet, crate, nhân vật và platform bão hòa hơn | ✓ |
| orbit-runner | Orbit Runner | adventure | ✓ Khối facet, crate, nhân vật và platform bão hòa hơn | ✓ |
| lights-out | Lights Out | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| slide-tiles | Sliding Tiles | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| peg-solitaire | Peg Solitaire | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| n-queens | Queen Constellation | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| nonogram | Pixel Logic | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| towers-hanoi | Hanoi Orbit | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| maze-path | Maze Pathfinder | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| connect-four | Four Connect | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| tic-tac-toe | Orbit Tic Tac Toe | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| reversi-mini | Mini Reversi | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| word-search | Word Galaxy | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| number-order | Number Trail | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| sudoku-mini | Sudoku Mini | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| color-flood | Color Flood | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| pipe-link | Pipe Link | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| code-breaker | Code Breaker | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| knights-tour | Knight Journey | pack-puzzles | ✓ Cạnh sáng/bóng ô; palette quân/bàn; Hanoi nhiều màu | ✓ |
| paddle-duel | Paddle Duel | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| sky-glider | Sky Glider | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| meteor-dodge | Meteor Dodge | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| coin-catcher | Coin Catcher | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| road-rush | Road Rush | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| river-cross | River Cross | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| asteroid-drift | Asteroid Drift | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| gravity-flip | Gravity Flip | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| ball-balance | Ball Balance | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| jump-tower | Jump Tower | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| laser-dash | Laser Dash | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| orbit-collect | Orbit Collector | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| shield-defense | Shield Defense | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| target-range | Target Range | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| penalty-kick | Penalty Kick | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| mini-golf | Mini Golf | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| basket-shot | Basket Shot | pack-arcade | ✓ Viền/ánh phản chiếu vật thể, panel và palette sân chơi | ✓ |
| simon-sequence | Simon Sequence | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| reaction-stop | Reaction Stop | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| rhythm-tap | Rhythm Tap | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| whack-orb | Whack an Orb | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| aim-trainer | Aim Trainer | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| math-sprint | Math Sprint | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| color-word | Color Word | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| odd-one-out | Odd One Out | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| pattern-recall | Pattern Recall | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| treasure-grid | Treasure Grid | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| lock-timing | Lock Timing | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| stack-tower | Stack Tower | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| constellation-trace | Constellation Trace | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| pixel-painter | Pixel Painter | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| garden-care | Garden Care | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| cafe-orders | Café Orders | pack-casual | ✓ HUD và gradient vật liệu/đối tượng, DOM/cue | ✓ |
| fortress-weave | Pháo Đài Lăng Kính | strategy-fields | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| frontier-command | Mặt Trận Bình Minh | strategy-fields | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| hex-vanguard | Biệt Đội Lục Giác | strategy-fields | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| island-dominion | Vương Quốc Quần Đảo | strategy-fields | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| hidden-fleet | Hạm Đội Bí Mật | strategy-fields | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| crater-command | Pháo Binh Địa Hình | strategy-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| nexus-conquest | Chinh Phục Trạm Năng Lượng | strategy-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| squad-draft | Đấu Trường Đội Hình | strategy-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| runedeck-quest | Chinh Phục Cổ Ngữ | strategy-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| royal-chess | Cờ Vua Hoàng Gia | strategy-board | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| crown-draughts | Cờ Đam Vương Miện | strategy-board | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| lotus-go | Cờ Vây Hoa Sen | strategy-board | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| seed-duel | Cờ Hạt Ánh Dương | strategy-board | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| bridge-hex | Cầu Nối Lục Giác | strategy-board | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| hidden-ranks | Cờ Mật Lệnh | strategy-table | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| wall-race | Cờ Chặn Lối | strategy-table | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| auction-guild | Hội Đấu Giá | strategy-table | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| dice-expedition | Xúc Xắc Viễn Chinh | strategy-table | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| gem-tactics | Chiến Trận Ngọc | strategy-table | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| dungeon-chronicle | Hầm Ngục Theo Lượt | strategy-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| blast-grid | Đấu Trường Bom | action-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| street-vanguard | Vệ Binh Đường Phố | action-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| blade-duel | Kiếm Đấu | action-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| silent-infiltrator | Đột Nhập Bóng Đêm | action-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| grapple-sky | Móc Treo Trên Không | action-physics | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| returning-blade | Lưỡi Dao Hồi Quy | action-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| frontier-trail | Chiếm Vùng Ánh Sáng | action-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| crystal-excavator | Thợ Mỏ Vực Sâu | action-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| kinetic-arena | Đấu Trường Niệm Lực | action-combat | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| portal-courier | Sứ Giả Cổng Không Gian | action-physics | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| ring-sumo | Võ Đài Vòng Tròn | action-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| titan-ascent | Chinh Phục Hộ Vệ Khổng Lồ | action-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| sky-hoist | Cứu Hộ Cáp Treo | action-physics | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| trial-rider | Mô Tô Địa Hình | action-physics | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| apex-drift | Đường Đua Drift | action-motion | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| prism-pinball | Pinball Lăng Kính | action-physics | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| bubble-reactor | Lò Phản Ứng Bong Bóng | action-motion | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| abyss-rescue | Thợ Lặn Cứu Hộ | action-motion | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| sky-interceptor | Lưới Lửa Bầu Trời | action-motion | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| polarity-workshop | Xưởng Từ Trường | action-motion | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| forge-expedition | Lò Rèn Viễn Chinh | management-workshop | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| factory-flow | Dây Chuyền Tinh Thể | management-workshop | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| rail-dispatch | Nhà Ga Điều Phối | management-workshop | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| tide-merchants | Thương Hội Thủy Triều | management-workshop | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| frontier-colony | Thuộc Địa Mùa Đông | management-workshop | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| wildfire-command | Chỉ Huy Cứu Hỏa | management-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| bridgeworks | Kỹ Sư Cầu | management-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| drone-programmer | Lập Trình Drone | management-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| living-world | Kiến Tạo Hệ Sinh Thái | management-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |
| castle-mosaic | Vương Quốc Ghép Mảnh | management-world | ✓ Canvas và SVG riêng, bảng lệnh/HUD riêng | ✓ + 50-game deep QA |

## Bằng chứng tự đánh giá hình ảnh

Đã xem thư viện desktop/mobile, bàn cờ, phòng thủ, dây chuyền và bảng tổng hợp các nhóm. Sau khi xem ảnh đã thu gọn hero mobile, bỏ D-pad không cần ở chiến thuật/quản lý, sửa HUD mục tiêu đợt và nhãn công cụ, thêm chỉ báo tầm tháp, sửa CTA/metadata trên thẻ sáng. Ảnh mới được chụp lại sau chỉnh sửa.

Bản so sánh cơ chế là kiểm tra thiết kế thủ công, không suy ra “khác game” chỉ từ chuỗi metadata khác nhau. Những cặp dễ trùng được tách bằng hệ luật: tháp tự ngắm / bắn đánh chặn; RTS đơn vị / đồ thị quân số; drift mặt phẳng / né xe theo làn; flipper động / paddle phá gạch; match-3 combat / ghép số; Go khí/ko / Reversi lật hàng; chương trình drone / tìm đường trực tiếp; leo boss có grip/stamina / nhảy platform.
