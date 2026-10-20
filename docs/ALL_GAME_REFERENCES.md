# All Game · Neon Arcade

Thiết kế và triển khai: 16/10/2026. Mục con độc lập của **Giải trí & Nội dung**, route `/all-game`, dùng nguyên shell HH Platform. Không thay HH Play hoặc EonWild.

## Thư viện 59 game

Thư viện gồm chín game đầu tiên bên dưới và **50 game bổ sung**, chia thành engine độc lập theo luật chơi. Không dùng cùng một game đổi tên để đếm đủ số lượng.

| Game | Luật và mục tiêu thực tế |
|---|---|
| Neon Snake | Ăn năng lượng, tránh va chạm; mục tiêu 10/14/18 quả theo độ khó. |
| Prism Breaker | Phá gạch bằng bóng/thanh đỡ, ba màn, ba mạng, kết thúc thắng/thua. |
| Star Guard | Di chuyển/bắn, va chạm/sát thương, ba đội hình và boss cuối. |
| Neon Merge | Ghép ô cùng số tới 2048, tiếp tục sau thắng, hoàn tác, hết nước đi là thua. |
| Crystal Mines | Ba kích thước bàn, ô đầu và vùng lân cận an toàn, cờ và flood reveal thật. |
| Memory Constellation | Ba bộ 6/8/12 cặp; lật/ghép, đếm lượt, úp lại có thời gian xác định. |
| Block Drop | 7-bag, xoay/wall kick giới hạn, ghost, xóa hàng, điểm/cấp và top-out. |
| Crate Lab | Bảy bản đồ nguyên bản, đẩy thùng, hoàn tác/reset và tự chuyển màn. Bộ test BFS xác nhận tất cả giải được. |
| Orbit Runner | Ba chặng nguyên bản có vật lý, vật phẩm, nguy hiểm, checkpoint, mạng và cổng kết thúc. |

Đây là game nhỏ chơi đơn có luật/đầu ra hoàn chỉnh trong phạm vi mô tả, không phải tuyên bố ngang toàn bộ độ sâu của các game thương mại. Block Drop và Neon Merge cho phép chơi dài; không bịa một campaign đã hoàn thành.

### 50 game bổ sung

- **17 trò giải đố/chiến thuật:** Lights Out, Sliding Tiles, Peg Solitaire, Queen Constellation, Pixel Logic, Hanoi Orbit, Maze Pathfinder, Four Connect, Orbit Tic Tac Toe, Mini Reversi, Word Galaxy, Number Trail, Sudoku Mini, Color Flood, Pipe Link, Code Breaker, Knight Journey.
- **17 trò arcade/thể thao:** Paddle Duel, Sky Glider, Meteor Dodge, Coin Catcher, Road Rush, River Cross, Asteroid Drift, Gravity Flip, Ball Balance, Jump Tower, Laser Dash, Orbit Collector, Shield Defense, Target Range, Penalty Kick, Mini Golf, Basket Shot.
- **16 trò thư giãn/phản xạ/mô phỏng:** Simon Sequence, Reaction Stop, Rhythm Tap, Whack an Orb, Aim Trainer, Math Sprint, Color Word, Odd One Out, Pattern Recall, Treasure Grid, Lock Timing, Stack Tower, Constellation Trace, Pixel Painter, Garden Care, Café Orders.

Phạm vi được ghi rõ trong UI: Sudoku là bàn 4×4; Word Galaxy tìm sáu từ theo hàng xuôi/ngược; Queen Constellation có sáu hậu; Pixel Painter là tranh 8×8; Café Orders có tám đơn mỗi ván; đối thủ Four Connect/Tic Tac Toe/Reversi/Paddle là máy cục bộ. Đây không phải chế độ nhiều người hoặc AI qua dịch vụ bên ngoài.

### Đồ họa và khả năng đọc bàn chơi

- `all-game-scenes.js` tạo 59 profile cảnh xác định trong 12 họ mỹ thuật: vũ trụ, rừng, núi tuyết, thành phố, sông, sân thể thao, xưởng sáng tạo, đền logic, vườn, quán cà phê, biển và hoàng hôn.
- Cảnh được vẽ bằng Canvas/SVG nguyên bản: tiền cảnh/hậu cảnh, ánh sáng, vật liệu, bóng và sắc độ. **Đây là đồ họa 2D cách điệu có chiều sâu, không phải ảnh thật hay renderer 3D chân thực.** Không có ảnh tải ngoài hoặc tài nguyên mượn không rõ giấy phép.
- Xe/bánh/kính/đèn, tàu/cockpit, thiên thạch, rổ/lưới, sân golf, robot, cây/cốc cà phê và các vật thể có tác dụng trong game được engine vẽ theo trạng thái thật. Đạo cụ minh họa trên thumbnail không bị đưa vào vùng chơi như vật thể tương tác giả.
- Mỗi nhóm có chất liệu bàn riêng; 15 puzzle bổ sung dùng Canvas với lớp nút DOM có tên trợ năng khớp đúng vị trí, Hanoi có hình đĩa cùng nút chọn trụ. Forced colors chuyển lớp nút sang màu hệ thống. Nonogram đặt gợi ý sát hàng/cột; Color Word có tín hiệu màu kèm nhãn hỗ trợ; các game cần chỉ báo động hiển thị Canvas cùng nút điều khiển.
- Không tạo vòng render nền thứ hai. Cảnh không bắt sự kiện hoặc che điều khiển; giảm chuyển động vẫn giữ chuyển động bắt buộc của luật game.

## Nguồn cảm hứng và quyền sử dụng

Tất cả engine, giao diện, nét vẽ Canvas/SVG, biểu tượng bố cục và bản đồ/màn của bản này được viết riêng cho HH. **Không lấy mã, ảnh, nhạc, sprite hoặc bộ level của các dự án dưới đây. Không iframe game từ website khác. Không thêm dependency/CDN/API.**

- [2048 — Gabriele Cirulli](https://github.com/gabrielecirulli/2048), [GameManager](https://github.com/gabrielecirulli/2048/blob/master/js/game_manager.js), [MIT](https://github.com/gabrielecirulli/2048/blob/master/LICENSE.txt): tham khảo quy tắc mỗi ô chỉ merge một lần/nước, không spawn khi không có thay đổi và phân biệt thắng/tiếp tục/hết nước. Không sao chép mã nguồn hoặc nhận là tác giả của ý tưởng 2048. Đây là dự án cổ điển, không dùng như dependency cần theo dõi cập nhật.
- [Basic Sokoban — Steven Lambert/straker](https://gist.github.com/straker/2fddb507d4bb6bec54ea2fdb022d020c): nguồn minh họa luật đẩy thùng, ghi CC0 trong README; không sao chép map hoặc code. Bảy map HH có kiểm tra giải được riêng.
- [Phaser Examples — Breakout](https://github.com/phaserjs/examples/blob/master/public/src/games/breakout/breakout.js), [Phaser framework](https://github.com/phaserjs/phaser), [MIT framework](https://github.com/phaserjs/phaser/blob/master/LICENSE.md): tham khảo phân tách input/physics/scene và vòng đời level. Không lấy asset trong Examples, không suy đoán mọi asset có cùng giấy phép framework, không cài Phaser cho chín game nhẹ này.
- [Hextris](https://github.com/Hextris/hextris): đã đối chiếu nhưng **không sử dụng**. Repository ghi GPL-3.0 và không còn được duy trì tích cực; không copy mã/tài nguyên hoặc gọi bản HH là Hextris.
- [Y8](https://www.y8.com/): tham khảo cách phân loại game ngắn, thể thao, đua xe, giải đố, mô phỏng và cách quay lại game gần đây. Nội dung có bản quyền, không sao chép mã/ảnh/nhân vật, không nhúng game Y8.
- [Game24h](https://game24h.vn/), [Đua xe](https://game24h.vn/dua-xe-c117.html), [Trí tuệ](https://game24h.vn/tri-tue-c119.html): tham khảo danh mục và trải nghiệm chơi nhanh từ nội dung trang chính thức được máy tìm kiếm lập chỉ mục; lần mở trang trực tiếp không thành công. Không lấy tài nguyên hoặc cho rằng nội dung được cấp phép tái phân phối.

Tên game HH và đồ họa neon không dùng nhận diện, nhân vật hoặc âm thanh của các game thương mại. Các quy tắc cổ điển được ghi rõ là cảm hứng, không tuyên bố độc quyền ý tưởng.

## Dữ liệu và vòng đời

- Yêu thích, gần đây, số lượt bắt đầu, số lần thắng và kỷ lục dựa trên thao tác thật; lưu localStorage với `hh.all-game.library.v1:<account>`. Chỉ dùng ID/email định danh theo auth hiện có, không lưu mật khẩu hoặc token.
- Không có leaderboard online, đối thủ, người đang chơi hoặc thành tích giả. Kỷ lục là tổng hợp trên thiết bị, chưa chia bảng thi đấu theo độ khó.
- Phiên game giữ **trong RAM** theo tài khoản + game + độ khó khi đổi workspace và luôn quay lại ở trạng thái dừng, tối đa 48 phiên gần nhất để giới hạn bộ nhớ. Reload bắt đầu ván mới; UI thông báo rõ, không gọi đó là cloud save hoặc lưu checkpoint lâu dài.
- Một RAF do host sở hữu cho game cần thời gian thực; game theo lượt không chạy vòng lặp thường trực. Memory chỉ cần tick khi đang chờ úp thẻ. Pause, blur, hidden và unmount hủy vòng lặp, xóa phím đang giữ. Không tự tiếp tục khi tab hiện lại.
- Bundle engine chỉ tải khi mở game thuộc nhóm đó. Tất cả asset có mặt trong runtime cache; chơi offline phụ thuộc tài nguyên đã được trình duyệt tải/cache, không cam kết ván đầu tiên offline khi chưa tải.
- Giảm hiệu ứng/reduced motion, forced colors, bảng puzzle dùng nút DOM với nhãn tiếng Việt, bàn phím/điều khiển cảm ứng, không khóa body. Không audio, mic/camera, quảng cáo hoặc dịch vụ tính phí trong module.

## Kiểm chứng

Các engine có test seed, immutable state, collision, luật, thắng/thua, xóa hàng, giải level thật và cleanup theo hợp đồng. Runner `scripts/qa-all-game.js` kiểm tra bằng Chromium thật; backend/auth/realtime trong môi trường QA trả unavailable có chủ đích, không xác nhận backend/WAN.

Kết quả ngày 16/10/2026:

- `npm run test:all-game` với hai biến QA đã cấu hình: **222/222 test đạt, 0 skip**, gồm 206 test engine/catalog/scene/host và 16 test của ba suite audit. Kiểm tra seed, immutable state, va chạm, thắng/thua, các màn giải được và lỗi nhập giữ phím Block Drop.
- Ba suite audit có kiểm tra Chromium thật: 20 puzzle ở 375/768/1280px; 20 arcade ở 375/1280px; 16 casual ở 375px, thêm 375/1280px với CSS zoom 200% cho nhóm điều khiển phức tạp. Không có pageerror trong các suite.
- Chơi thắng bằng thao tác DOM/pointer thật: Hanoi, Lights Out, Pixel Painter (640 điểm), Constellation (480 điểm), Café (8 đơn), Target Range (15 bia/1.500 điểm), Penalty (3 bàn). Orbit có bằng chứng dùng nút cảm ứng thu tinh thể vòng trong.
- Runner tích hợp shell xác nhận toàn bộ 59 route mở/bắt đầu/dừng/tiếp tục/nhận input ở 375px; Guest → Platform → All Game, Back/Forward, giữ shell, search/favorite/reload, phân tách tài khoản, khôi phục phiên trong RAM, lỗi tải/retry, storage error, forced colors và cleanup. Backend trong runner trả unavailable chủ đích; không xác nhận backend, mạng WAN hay thiết bị di động vật lý.
- Test lỗi render bằng fault injection xác nhận dừng an toàn, không tạo vòng lỗi lặp và unmount vẫn giải phóng listener/RAF. Summary đọc theo yêu cầu, chỉ trạng thái rời rạc được thông báo cho trình đọc màn hình.
- 48 test hồi quy liên quan HH Play, điều hướng/shell/runtime/release và Thiết kế đồ họa đạt. Bộ All Tool riêng 241 test đạt; có test trùng với nhóm hồi quy, không cộng các số thành tổng duy nhất.

Chạy `npm run test:all-game` cho engine/hợp đồng. Các suite Chromium chỉ bật khi có `HH_QA_PLAYWRIGHT` và `HH_QA_CHROMIUM`; nếu không, test browser được ghi rõ skip. `node scripts/qa-all-game.js` dùng hai biến này để chạy luồng shell đầy đủ.

Ảnh/log trong `.study-local/all-game-1058`, không đưa dữ liệu QA vào Git. Không thay đổi hoặc commit/push phần Facebook/auth còn dang dở. Repository không cung cấp lệnh lint/typecheck/build tổng quát cho frontend thuần JavaScript này; đã dùng kiểm tra cú pháp Node, test hợp đồng, test engine và Chromium thật. Chưa kiểm tra offline với service worker thật hoặc cloud sync; chưa có leaderboard online, multiplayer, nhạc/âm thanh hay bộ asset ảnh chân thực.
