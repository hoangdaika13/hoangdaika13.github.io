# Học cùng nhau · mục tiêu nhóm và đồng hồ tùy chỉnh · release 1034

Mở rộng workspace `/learn/study-together` trong HH Platform, tiếp nối bản trình bày 1033. Không thêm dependency hoặc endpoint. Commit này gồm các thay đổi 1033 chưa push và phần mở rộng 1034.

## Chức năng

- Panel Tập trung có mục tiêu chung (240 ký tự) và tối đa 6 công việc (120 ký tự/việc). Chủ phòng sửa và đánh dấu hoàn thành; thành viên và khách xem trạng thái đã được server xác nhận.
- Kế hoạch lưu trong room record hiện có, đồng bộ qua LiveKit room metadata, mở lại khi rejoin. Thời hạn giữ dữ liệu là thời hạn phòng hiện có (24 giờ); không có phòng hoặc task mẫu được tạo giả.
- Backend kiểm tra quyền host, kiểu dữ liệu, độ dài và revision. MongoDB update có điều kiện revision để chặn hai tab cùng ghi đè một bản. Việc đã hoàn thành giữ trạng thái khi chủ phòng đổi thứ tự bằng cùng nội dung việc.
- Khi metadata mới đến, bản sửa đang nhập vẫn giữ trong workspace. Lưu bản cũ báo xung đột; nút “Bỏ bản sửa, lấy kế hoạch mới” tải dữ liệu hiện tại theo thao tác người dùng. Bản sửa chưa lưu không được tự gửi lên server hoặc lưu sau khi đóng workspace.
- Nếu database đã lưu nhưng LiveKit không broadcast được, API trả `syncPending`; UI ghi rõ đã lưu nhưng chưa đồng bộ, có thể lưu lại để thử. Không báo đã đồng bộ khi transport lỗi. Client bỏ qua bản agenda có revision thấp hơn bản đang xem.
- Checklist giữ node và focus khi cập nhật; không tick thành công trước khi server trả dữ liệu. Các nút async vô hiệu trong lúc xử lý, vẫn có thể rời phòng / tắt preview. Trạng thái giơ tay được dọn khi người tham gia ngắt kết nối.
- Timer có 5/15/25/45/50/90 phút và tùy chỉnh 1–180 phút. Đặt lại áp dụng thời lượng chọn; tiếp tục giữ phần thời gian đang dở. Đã hết giờ thì Bắt đầu mở vòng mới với thời lượng chọn. Tạm dừng ở 0 giữ 0; không tự cộng thời gian. Pause vẫn dùng được khi ô tùy chỉnh đang không hợp lệ.
- Hiển thị chưa bắt đầu / đang chạy / tạm dừng / hết giờ; chỉ cập nhật chữ đồng hồ và trạng thái khi nội dung đổi.

## Bằng chứng · 2026-10-08

- **65/65** focused Node tests: backend Study Together, timer, Platform catalog/navigation/shell, Focus Room compatibility và release/cache consistency.
- **107/107** auth/security/backend readiness tests, gồm sửa vòng lặp observer khi reload phiên khách ở release 1033.
- Syntax checks và `git diff --check` đạt. Không có lệnh lint/typecheck/build độc lập cho workspace trong repository.
- Browser runner qua toàn bộ luồng bằng **LiveKit Cloud thật**; account và database là QA doubles. Media dùng mic/camera mẫu Chromium và canvas tổng hợp, không phải thiết bị vật lý hay đăng nhập production.
- Qua lưu mục tiêu → peer nhận metadata → tick việc → peer nhận tick và readonly → mô phỏng tab host thứ hai sửa kế hoạch → giữ bản đang nhập → từ chối bản cũ → lấy bản mới.
- Qua tùy chỉnh **7 phút**, reset/start/pause/resume, peer reload/rejoin khôi phục mục tiêu/checklist/timer và mic/cam vẫn tắt. Test backend bổ sung expired restart, pause-zero, quyền host/guest, quá giới hạn, dữ liệu sai kiểu, CAS race và lỗi broadcast.
- Các luồng 1033 vẫn qua: ghim bằng Enter, một ô trình bày, screen-share dừng/chia sẻ lại/fallback, unread chat/giữ vị trí đọc, notes download/reload/account isolation, phòng chờ/duyệt/QR/kick, push-to-talk, đóng và cleanup track/preview.
- Full index lời mời/guest → đúng workspace; catalog/sidebar/command search; Back/Forward/reload; HH School → Học cùng nhau giữ khung trang. Viewport **1440/768/375**, chữ **200%**, reduced motion và không overflow ngang trong các luồng đã kiểm tra. `pageErrors: 0`.
- Screenshot và browser profile QA nằm ở Temp; runner xóa các room QA do nó tạo. Không commit khóa, cấu hình CLI hoặc dữ liệu trình duyệt.

Chưa kiểm thử Safari/iOS, mic/cam vật lý, tải 32 người hoặc mất mạng WAN kéo dài. Agenda lưu cùng TTL room, còn chat chỉ giữ trong phiên. Không thay bằng số liệu học tập hoặc trạng thái online giả.

## Tương thích và nguồn

Room cũ chưa có `agenda` được đọc thành mục tiêu/checklist rỗng revision 0; đọc không sửa dữ liệu cũ. Preferences/notes/auth giữ namespace và flow đã có. Asset Study Together CSS/JS v5, loader v696, cache release 1034; auth gateway v35 của release 1033 giữ nguyên.

Sử dụng LiveKit SDK đã pinned (**Apache-2.0**) và qrcode-generator local (**MIT**) từ release 1030/1031. Không tải mã hoặc tài nguyên ngoài mới.
