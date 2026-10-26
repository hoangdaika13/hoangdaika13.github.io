# Studio và Play — nội dung campaign 1063

85 ID cũ được giữ nguyên trong 17 bundle. Chơi nhanh tiếp tục dùng engine và luật đầy đủ của phiên bản trước. Bộ campaign chỉ tạo điều kiện khởi đầu và mục tiêu luyện tập/scenario; di chuyển, bài, bot, va chạm và tính điểm vẫn chạy qua engine gốc.

| Mô hình | Game | Nội dung mỗi game | Tổng |
| --- | ---: | ---: | ---: |
| Chiến thuật/quản lý | 18 | 12 scenario, 4 chương | 216 |
| Cờ/bài/bàn và luyện suy luận | 31 | 28 tình huống, 4 chương | 868 |
| Truyện/nhập vai | 2 | 16 nhiệm vụ, 4 chương | 32 |
| Hành động | 18 | 20 nhiệm vụ, 4 vùng | 360 |
| Thể thao/phương tiện | 16 | 16 trận/chặng, 4 vòng | 256 |
| **Tổng** | **85** | | **1.732** |

Các file `all-game-campaign-<bundle>.js` đăng ký nội dung tải theo nhu cầu, sử dụng `all-game-campaign-studio-runtime.js`. Mỗi mission có ID/chương/prerequisite ổn định, mục tiêu, gợi ý, điều kiện kết thúc và rewards. Không thay ID route, favorites hay kỷ lục Chơi nhanh.

Ví dụ thay đổi gameplay thực:

- Cờ vua luyện xe, tượng, mã và hậu; cờ tướng luyện xe, ngòi pháo, chân mã và tốt; shogi luyện xe, tượng, bạc và vàng. Có 84 thế cờ nguyên bản được kiểm tra bằng legality của chính engine. Cờ vây chuyển từ nhóm một đá/một khí tới nhóm bốn đá/hai khí.
- Hành động thay đội hình, vật ném/khối lượng, dây/neo và bến đáp, cổng và kiện giao, đường lặn và số người cần cứu, hành lang tầm nhìn, điểm yếu khi leo. Street Vanguard, Returning Blade và Kinetic Arena yêu cầu hạ toàn bộ đội hình nhiệm vụ.
- Scenario quản lý thay lịch tàu, hai nguồn/ga đích, gió và địa hình cứu hỏa, đồ thị drone, chướng ngại dây chuyền, cấu kiện cầu có sẵn và ngân sách, kho hàng/giá/thời tiết, đất và phân bố sinh vật.
- Mùa giải giữ kết quả thật của trận. Thua/hòa vẫn là một trận đã hoàn tất, được lưu đúng là thua/hòa; không biến kết quả này thành chiến thắng. Trận bóng chuyền mùa giải có giới hạn 180 giây hiển thị trong mô tả; Chơi nhanh giữ luật trước đó.
- Runedeck Quest và Dungeon Chronicle có hai tuyến truyện nguyên bản, bốn quyết định mở chương và hai kết cục. Quyết định được giữ trong flags; các nhiệm vụ sau nhận lá khiên/thiên thạch hoặc tiếp tế/vũ khí tương ứng. Chưa chọn thì gameplay dừng, không chạy RAF chờ quyết định.

Sửa lỗi được phát hiện bằng walkthrough: target tàu vẫn hardcode 10 khi scenario ngắn hơn; sông được đặt vào ô căn cứ cứu hỏa; practice carrom chỉ có quân cuối khiến luật cover queen trả quân lại; cầu thang dungeon thay tầng trước khi adapter nhận biết hoàn thành; âm 0 của vector cube không giữ được qua JSON checkpoint; kênh phóng pinball giữ bóng trong lane. Các sửa đổi giữ điều kiện Chơi nhanh tương ứng. Bowling, bi-a và carrom ngừng xin frame trong lúc người chơi ngắm; bot và vật thể đang chuyển động vẫn được cập nhật.

## Bằng chứng

- `tests/all-game-campaign-studio-play.test.js`: 94 kiểm tra đạt, không skip; gồm cả 1.732 walkthrough từ state mới ở độ khó **normal**, không gán trạng thái thắng, không gọi rule mutator để giải hộ. Có kiểm tra no-op, JSON/immutability, cả hai campaign từ đầu tới kết cục, carry-over lựa chọn, legality, queen/last-coin và idle frame.
- `scripts/all-game-campaign-studio-play-checks.js --detail --output=docs/ALL_GAME_CAMPAIGN_STUDIO_PLAY_PROOFS.json` tái tạo báo cáo từng mission: hash SHA-256 state đầu, hash chuỗi input hợp lệ, số bước, kết quả và điểm thực. Solver điều khiển qua API action công khai; preview là bản sao qua `engine.step`, không thay state ván đang chứng minh.
- 238 kiểm tra hồi quy `all-game-studio`, `all-game-studio-outcomes` và `all-game-exp-play` đạt, không skip. Fixture gần cuối trong bộ hồi quy cũ tách biệt với walkthrough state mới ở bộ campaign.
- QA shell, checkpoint, 3D và ảnh runtime do bộ QA chung của release thực hiện, được tổng hợp trong báo cáo 209 game; tài liệu này không dùng test Node để thay bằng chứng trình duyệt.

Renderer metadata mặc định là 2D Canvas; Fortress Weave dùng các khối tháp chiếu 2.5D của core chung. Tùy chọn Three.js cho bowling/bi-a thuộc adapter đồ họa chung, không thay vật lý 2D. Nội dung và đồ họa native trong nhóm này là mã/primitive nguyên bản, không lấy media thương mại hoặc mã từ nguồn bên ngoài.

Thời lượng trong spec là mục tiêu thiết kế nội bộ, trạng thái `unmeasured-human-playtime`. Chưa có dữ liệu chơi thử độc lập; số bước và thời gian solver chỉ là số đo kiểm thử, không phải số phút trải nghiệm. Các tình huống cờ/bài là bài luyện ngắn; người chơi muốn ván dài có thể dùng luật đầy đủ ở Chơi nhanh. Tiến trình campaign lưu cục bộ theo tài khoản bằng hệ thống IndexedDB chung.
