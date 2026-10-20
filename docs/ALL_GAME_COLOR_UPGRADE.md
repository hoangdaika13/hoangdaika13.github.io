# All Game Color Arcade — release 1060

Đã nâng cấp thư viện và giao diện bên trong đủ 59 game. Hình ảnh được dựng từ SVG, Canvas và DOM trong project; mỗi game có minh họa gameplay riêng, thuộc một trong 12 nhóm cảnh nền.

## Thay đổi

- Thư viện mới với hero, poster gameplay cho từng game, bộ lọc thể loại đồng bộ với danh sách chọn, yêu thích và trạng thái rỗng có nút khôi phục.
- Bảng màu tươi, vật liệu chuyển sắc, bảng chơi riêng cho từng nhóm và chữ dễ đọc. Các tiêu đề All Game tách khỏi hiệu ứng chữ cũ của trang portfolio.
- HUD hiển thị điểm, cấp, kỷ lục, thời gian; mạng/giáp, lượt đi và mục tiêu chỉ xuất hiện khi game có dữ liệu tương ứng.
- Màn hình chuẩn bị, tạm dừng, thắng, thua và lỗi tải thống nhất. Điểm trong màn kết thúc lấy từ lượt chơi thật.
- Khung chơi thích ứng theo chiều rộng nội dung, bàn vuông tận dụng chiều ngang điện thoại và vùng bấm khớp với hình Canvas; giữ điều khiển cảm ứng từ 44px, bàn phím, chế độ giảm chuyển động và màu tương phản hệ thống.
- Canvas hỗ trợ DPR đến 2, tọa độ chuột/chạm tính theo kích thước hiển thị. Host tiếp tục sở hữu duy nhất vòng lặp và giải phóng khi rời game.
- Tài sản All Game lên phiên bản 2, loader 721, Service Worker 1060. Dữ liệu yêu thích/kỷ lục tiếp tục dùng schema hiện tại.

## Kiểm tra

- `npm run test:all-game` với Playwright: 226/226 đạt, không bỏ qua test.
- `npm run test:all-tools`: 241/241 đạt.
- Nhóm puzzle, release và layout lifecycle sau chỉnh màu chữ: 44/44 đạt.
- `node scripts/qa-all-game-color.js`: đủ 59 game ở 1440px, 768px, 375px. Kiểm tra bắt đầu, nhập điều khiển, tạm dừng, tiếp tục, chơi lại và dừng vòng lặp khi unmount.
- Kiểm tra thêm: bộ lọc, yêu thích lưu theo tài khoản, màn thắng/thua qua thao tác thật, chuột trên Canvas DPR2, tọa độ bảng cảm ứng sau resize, zoom 200%, focus trong forced-colors, không tràn ngang.
- `node scripts/qa-all-game.js`: kiểm tra trong shell thật, CSP, 59 route, tải engine theo nhu cầu, lịch sử Back/Forward, khôi phục phiên, lỗi tải/thử lại và storage lỗi.

Ảnh và kết quả QA cục bộ nằm trong `.study-local/all-game-color-1060/` và `.study-local/all-game-shell-1060/`. Các thư mục này được Git bỏ qua để không đưa profile trình duyệt và ảnh QA vào bản phát hành. Có thể đặt `HH_QA_OUTPUT` để đổi thư mục cho QA shell. Thiết lập `HH_QA_PLAYWRIGHT` và `HH_QA_CHROMIUM` tới Playwright/Chromium đã cài khi chạy kiểm tra trình duyệt.

## Phạm vi xác nhận

Các game vẫn là mini-game 2D chạy cục bộ. Điểm và yêu thích lưu theo tài khoản trên thiết bị; phiên đang chơi giữ tạm trong tab, không có bảng xếp hạng hay đồng bộ tiến trình trực tuyến. Các lượt thắng/thua được kiểm tra sâu theo engine và các kịch bản trình duyệt; kiểm tra đủ 59 game xác nhận các luồng điều khiển và vòng đời ở ba kích thước, không thay thế việc chơi thủ công mọi ván ở mọi độ khó.

## Danh sách đủ 59 game

Mỗi dòng đã có minh họa riêng, giao diện/chất liệu cập nhật và kiểm tra các luồng chơi ở 1440/768/375px.

| Hoàn thành | Game | Bộ máy | Nhóm cảnh |
|---|---|---|---|
| ✓ | Neon Snake (`snake`) | arcade | forest |
| ✓ | Prism Breaker (`breakout`) | arcade | workshop |
| ✓ | Star Guard (`star-guard`) | arcade | space |
| ✓ | Neon Merge (`merge`) | puzzles | workshop |
| ✓ | Crystal Mines (`mines`) | puzzles | solar |
| ✓ | Memory Constellation (`memory`) | puzzles | space |
| ✓ | Block Drop (`block-drop`) | adventure | workshop |
| ✓ | Crate Lab (`crate-lab`) | adventure | temple |
| ✓ | Orbit Runner (`orbit-runner`) | adventure | alpine |
| ✓ | Lights Out (`lights-out`) | pack-puzzles | workshop |
| ✓ | Sliding Tiles (`slide-tiles`) | pack-puzzles | workshop |
| ✓ | Peg Solitaire (`peg-solitaire`) | pack-puzzles | forest |
| ✓ | Queen Constellation (`n-queens`) | pack-puzzles | temple |
| ✓ | Pixel Logic (`nonogram`) | pack-puzzles | sea |
| ✓ | Hanoi Orbit (`towers-hanoi`) | pack-puzzles | temple |
| ✓ | Maze Pathfinder (`maze-path`) | pack-puzzles | river |
| ✓ | Four Connect (`connect-four`) | pack-puzzles | temple |
| ✓ | Orbit Tic Tac Toe (`tic-tac-toe`) | pack-puzzles | temple |
| ✓ | Mini Reversi (`reversi-mini`) | pack-puzzles | temple |
| ✓ | Word Galaxy (`word-search`) | pack-puzzles | cafe |
| ✓ | Number Trail (`number-order`) | pack-puzzles | cafe |
| ✓ | Sudoku Mini (`sudoku-mini`) | pack-puzzles | sea |
| ✓ | Color Flood (`color-flood`) | pack-puzzles | workshop |
| ✓ | Pipe Link (`pipe-link`) | pack-puzzles | workshop |
| ✓ | Code Breaker (`code-breaker`) | pack-puzzles | workshop |
| ✓ | Knight Journey (`knights-tour`) | pack-puzzles | temple |
| ✓ | Paddle Duel (`paddle-duel`) | pack-arcade | stadium |
| ✓ | Sky Glider (`sky-glider`) | pack-arcade | alpine |
| ✓ | Meteor Dodge (`meteor-dodge`) | pack-arcade | space |
| ✓ | Coin Catcher (`coin-catcher`) | pack-arcade | river |
| ✓ | Road Rush (`road-rush`) | pack-arcade | city |
| ✓ | River Cross (`river-cross`) | pack-arcade | river |
| ✓ | Asteroid Drift (`asteroid-drift`) | pack-arcade | space |
| ✓ | Gravity Flip (`gravity-flip`) | pack-arcade | city |
| ✓ | Ball Balance (`ball-balance`) | pack-arcade | sea |
| ✓ | Jump Tower (`jump-tower`) | pack-arcade | alpine |
| ✓ | Laser Dash (`laser-dash`) | pack-arcade | city |
| ✓ | Orbit Collector (`orbit-collect`) | pack-arcade | space |
| ✓ | Shield Defense (`shield-defense`) | pack-arcade | space |
| ✓ | Target Range (`target-range`) | pack-arcade | stadium |
| ✓ | Penalty Kick (`penalty-kick`) | pack-arcade | stadium |
| ✓ | Mini Golf (`mini-golf`) | pack-arcade | stadium |
| ✓ | Basket Shot (`basket-shot`) | pack-arcade | stadium |
| ✓ | Simon Sequence (`simon-sequence`) | pack-casual | solar |
| ✓ | Reaction Stop (`reaction-stop`) | pack-casual | city |
| ✓ | Rhythm Tap (`rhythm-tap`) | pack-casual | city |
| ✓ | Whack an Orb (`whack-orb`) | pack-casual | forest |
| ✓ | Aim Trainer (`aim-trainer`) | pack-casual | stadium |
| ✓ | Math Sprint (`math-sprint`) | pack-casual | cafe |
| ✓ | Color Word (`color-word`) | pack-casual | solar |
| ✓ | Odd One Out (`odd-one-out`) | pack-casual | garden |
| ✓ | Pattern Recall (`pattern-recall`) | pack-casual | garden |
| ✓ | Treasure Grid (`treasure-grid`) | pack-casual | forest |
| ✓ | Lock Timing (`lock-timing`) | pack-casual | temple |
| ✓ | Stack Tower (`stack-tower`) | pack-casual | temple |
| ✓ | Constellation Trace (`constellation-trace`) | pack-casual | space |
| ✓ | Pixel Painter (`pixel-painter`) | pack-casual | workshop |
| ✓ | Garden Care (`garden-care`) | pack-casual | garden |
| ✓ | Café Orders (`cafe-orders`) | pack-casual | cafe |
