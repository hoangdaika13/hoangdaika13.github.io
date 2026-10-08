# Học cùng nhau · trình bày và theo dõi nhóm · release 1033

Route `/learn/study-together` tiếp tục là mục riêng trong Học tập & Ngôn ngữ của HH Platform. Bản này mở rộng client LiveKit hiện có, không thêm thư viện, endpoint hoặc thay đổi schema backend.

## Điều khiển đã nâng cấp

- Ghim camera hoặc màn hình bằng click / Enter. Ghim chỉ ảnh hưởng bố cục của người đang xem, không áp đặt lên người khác.
- Bố cục trình bày chỉ mở rộng một ô: ô được ghim → màn hình đang chia sẻ → camera của người đang nói có video → chủ phòng / ô khả dụng. Mất track hoặc người rời phòng thì tự chọn lại; đăng ký cả `TrackPublished` và `TrackUnpublished` để không giữ ô chia sẻ cũ.
- Tìm thành viên theo tên hoặc vai trò, hỗ trợ tiếng Việt không dấu. Các nút quản lý giữ nguyên node DOM khi mic, giơ tay hoặc chất lượng kết nối thay đổi, nên không làm mất focus bàn phím.
- Tin nhắn có giờ nhận trên thiết bị, số chưa đọc, nút về tin mới nhất và trạng thái rỗng. Tin mới không kéo người đang đọc lịch sử xuống cuối. Nội dung/tên dùng `textContent`; chỉ giữ tối đa 100 tin trong bộ nhớ của phiên.
- Lưu bố cục và tùy chọn phản chiếu camera vào key preferences đã có. Tài khoản HH dùng localStorage theo account; khách dùng sessionStorage. Phản chiếu chỉ tác động camera của chính mình, không ảnh hưởng dữ liệu video truyền đi hoặc màn hình chia sẻ. Ghim không được mang sang phòng/phiên mới.
- Tải ghi chú cá nhân thành file UTF-8 `.txt`, kiểm tra nội dung tải được. Không gửi ghi chú lên backend hoặc cho thành viên khác. Blob URL và timeout được giải phóng sau tải / unmount.
- Hiển thị chất lượng mạng từ SDK; chưa nhận số đo thì ghi rõ. Các nút media/chat/timer tạm vô hiệu khi mất kết nối. Nhấn giữ V bỏ qua tổ hợp Ctrl/Meta/Alt và quyền mic bị tắt.
- Giao diện neon gọn hơn trong cuộc gọi, ô ghim rõ trạng thái, chữ dễ đọc. Ô video có chiều rộng giới hạn theo grid để tỷ lệ 16:9 và chiều cao tối thiểu không gây tràn ở 375px / chữ 200%.

## Lỗi reload đã sửa

Kiểm tra full shell phát hiện phiên khách khôi phục có thể khiến renderer bị treo. Đã tái hiện với `study-together.js` / CSS từ `HEAD` trước đợt nâng cấp để xác định đây là lỗi có sẵn.

Nhánh success của `auth-neon-gateway.js` gọi `classList.remove("is-gateway-opening")` dù class đã vắng mặt. MutationObserver lại theo dõi chính thuộc tính class đó, nên liên tục chạy lại. Bản sửa chỉ remove khi class còn tồn tại; không thay đổi quyết định xác thực. Gateway JS tăng v35 cùng catalog cache. Regression test kiểm tra observer dừng khi class ban đầu có hoặc không có; browser kiểm tra lại reload thành công.

## Bằng chứng kiểm thử · 2026-10-08

- 60/60 focused Node tests: Study Together, dữ liệu Focus Room, catalog Platform, điều hướng, shell và release/cache consistency.
- 107/107 auth/security/backend readiness tests, gồm regression cho observer success.
- Syntax checks của JS thay đổi và `git diff --check` đạt. Repository không có lệnh lint/typecheck/build độc lập cho workspace này.
- Runner `scripts/qa-study-together.js`: LiveKit Cloud thật, hai client và phiên khách; account/DB là QA doubles, không phải đăng nhập tài khoản production. Mic/camera dùng thiết bị mẫu của Chromium; screen share dùng canvas tổng hợp.
- Qua luồng mic/camera nhận track, chat HTML được hiển thị như văn bản, giơ tay, đồng hồ chung, screen share dừng/chia sẻ lại/fallback, kick/deny/rejoin, đóng phòng và dừng track/preview.
- Qua ghim bằng Enter, một ô trình bày, ghim không ảnh hưởng người khác, focus thành viên không mất khi giơ tay, tìm kiếm vai trò, unread và giữ vị trí đọc, file ghi chú đúng nội dung, preferences/notes khôi phục và tách tài khoản, transcript và ghim không khôi phục sang phiên mới.
- Full index: lời mời → tiếp tục với tư cách khách → đúng workspace; sidebar/catalog/command search; Back/Forward/reload; HH School → Học cùng nhau giữ header/breadcrumb.
- Viewport 1440/768/375, chữ 200%, reduced motion: không overflow ngang ở các luồng đã kiểm tra. Không có `pageerror`. Phòng QA do runner tạo được xóa khi kết thúc; ảnh QA chỉ lưu ở Temp.

Chưa kiểm thử thiết bị mic/cam vật lý, Safari/iOS, tải 32 người hoặc mất mạng WAN kéo dài. Trạng thái reconnect được nối với event SDK, không có tuyên bố thử nghiệm WAN. Test hủy screen picker dùng lỗi `NotAllowedError` được inject. Chat không phải lịch sử lưu trên máy chủ.

## Tài nguyên

Tiếp tục dùng LiveKit client 2.22.3 / server SDK 2.19.1 (**Apache-2.0**) và qrcode-generator local (**MIT**) đã ghi nguồn ở release 1030/1031. Không có mã, media hoặc dependency bên ngoài mới.

Để chạy lại browser QA: cung cấp `HH_PLAYWRIGHT_PATH`, `HH_BROWSER_EXECUTABLE`, `HH_STUDY_QA_CLOUD_PROJECT_ID` cho project đã xác thực, rồi chạy `node scripts/qa-study-together.js`. `HH_STUDY_QA_SHELL_ONLY=1` chỉ kiểm tra shell; `HH_STUDY_QA_BASELINE=1` phục vụ JS/CSS Study Together từ HEAD để so sánh read-only, không reset hoặc sửa worktree. Không in giá trị khóa CLI ra stdout.
