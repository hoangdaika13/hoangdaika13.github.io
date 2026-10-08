# Học cùng nhau · Cosmic Study Lounge · release 1035

Mở rộng workspace /learn/study-together trong HH Platform từ release 1034. Giữ App Shell, auth, route/link mời cũ, sidebar, breadcrumb và giới hạn 12 Vercel functions. Không thêm dependency, dịch vụ trả phí, ghi âm/ghi hình hoặc dữ liệu mẫu vào production.

## Chức năng và dữ liệu thật

- Bố cục lưới / trình bày / tập trung, thu gọn panel, màu neon thống nhất; board dùng vùng trình bày chính. Không thêm WebGL hoặc vòng render liên tục.
- Xem tên phòng, sức chứa, quyền mic/share, trạng thái khóa và yêu cầu duyệt trước khi tham gia; không tạo danh tính hay kết nối RTC khi xem lời mời.
- Chọn thiết bị trước/trong cuộc gọi; lỗi quyền, không tìm thấy thiết bị, thiết bị bận và cấu hình không hỗ trợ được phân biệt. Không xin quyền tự động; rejoin/reload vẫn tắt mic/camera.
- Chủ phòng khóa/mở nhận người mới, thu hồi và đổi lời mời trên backend. Thành viên đã duyệt có danh sách phòng riêng để quay lại bằng room ID sau thu hồi. Người chưa được duyệt/bị chặn không có danh sách này. Phòng chờ có tìm kiếm, lọc khách/tài khoản và thời gian yêu cầu.
- Chat phiên có tìm kiếm, trả lời, nhắc tên, unread và giữ vị trí đọc; hệ thống chỉ thêm tin từ sự kiện SDK participant thực. Nội dung dùng text/escape, không tự phát tiếng. Giới hạn tin 500 ký tự, packet 4096 byte, chat 20/10 giây, reaction 4/5 giây trong client.
- Giơ tay dùng hàng đợi, timestamp/revision từ backend; UI chỉ hiển thị người thực sự đang kết nối. Không suy đoán online từ room membership.
- Bình chọn do host tạo, 2–6 đáp án, một phiếu cho mỗi danh tính đã được duyệt; retry cùng phiếu không tăng lượt, đổi phiếu bị từ chối. Snapshot backend giữ lượt của mình qua rejoin, metadata chỉ chứa kết quả tổng hợp, không có danh sách người bỏ phiếu.
- Checklist có phân công cho thành viên đang kết nối. Host điều khiển giai đoạn tập trung/nghỉ/thảo luận, start/pause/reset; chuyển giai đoạn không tự chạy hay bật âm thanh. Deadline/revision do backend xác nhận. Tổng kết JSON chứa nhiệm vụ, kết quả bình chọn, tổng đồng hồ nhóm và tối đa 32 khoảng gần nhất; không chứa token/ghi chú cá nhân.
- Settings, agenda, timer, polls và từng đối tượng board có revision/CAS chống ghi đè. Bản quyền phòng/agenda đang nhập không bị metadata mới thay thế; bản cũ bị báo xung đột và có nút lấy bản mới. FormData được lấy trước trạng thái busy để không mất các trường bị disabled.
- Lưu database và phát metadata là hai trạng thái riêng. Lỗi LiveKit sau khi lưu trả syncPending, không giả vờ chưa lưu hoặc đã đồng bộ đầy đủ.

## Bảng trắng chung

- Canvas 2D native, lazy-load study-whiteboard.js; bút, tẩy nguyên nét, chữ, hình chữ nhật/ellipse, màu HEX và độ dày 1–12. Chọn/kéo đối tượng và dịch bằng các nút bàn phím.
- Backend lưu vector snapshot trong studyTogetherBoards, TTL cùng thời hạn phòng. Chỉ phát revision qua metadata; mỗi thao tác hoàn tất gửi batch, không stream ảnh canvas. Client tải lại snapshot khi cần.
- Tối đa 160 đối tượng, 128 điểm/nét, 12 thao tác/batch và 180.000 ký tự JSON snapshot. Batch ID chống retry trùng; version/tombstone bảo vệ sửa/xóa/khôi phục. Server tự gán owner/version, kiểm tra membership, quyền vẽ và phạm vi phiên khách.
- UI chỉ sửa nội dung của mình; API cho host quyền điều tiết. Undo/redo tối đa 30 thao tác trong tab; chuỗi hoàn tác nhiều bước được cập nhật version cho thao tác do chính tab thực hiện, không hoàn tác đè thay đổi từ tab khác.
- Snapshot phục hồi khi rejoin. Bản chưa lưu nằm dưới hh.studyTogether.boardDraft.v1.<identity>.<roomId>, account dùng localStorage, khách dùng sessionStorage; không chứa token. Có retry, bỏ bản nháp và PNG 1200 × 800. Bản xung đột vẫn xem/xuất được nhưng không tự rebase thành một lệnh ghi đè lên server.
- Chỉ canvas chặn touch để vẽ; phần ngoài vẫn cuộn được. RAF theo thay đổi, DPR tối đa 2; dừng khi pane/tab ẩn, cleanup observer/listener/Blob URL khi đóng.

## Kiểm thử · 2026-10-08

- **83/83** focused Node tests: Study Together + collaboration, Platform catalog/navigation/shell, Focus Room compatibility và release/cache consistency.
- **107/107** auth/security/backend readiness tests. Syntax checks và git diff --check đạt.
- Không có scripts lint/typecheck/build độc lập cho workspace JavaScript tĩnh này; không báo chúng là đã chạy. npm run test:study-together bao gồm bộ collaboration mới.
- Full browser runner dùng **máy chủ LiveKit thật 1.13.8 trên loopback**, hai SDK clients và một khách mời ký session thật. Account/database là QA doubles, camera/mic dùng thiết bị mẫu Chromium, screen dùng video canvas tổng hợp; không phải thiết bị vật lý hay đăng nhập/MongoDB production.
- Luồng đầy đủ: tạo/mời/xem preview/chờ duyệt/vào → camera/mic/share/push-to-talk → chat/hand/reply/mention/search → checklist/phân công/timer/giai đoạn/tổng kết → poll/vote/close → board/undo/redo/move/chữ/màu/tẩy/PNG/quyền vẽ → reload/rejoin → close/kick/cleanup.
- Kiểm tra thao tác sửa đồng thời với metadata, xung đột agenda/settings, failed-save board giữ draft rồi reload và retry, phiếu giữ nguyên khi rejoin, ghi chú riêng download/reload/tách tài khoản và guest.
- Full index guest deep link → đúng workspace; sidebar/catalog/command search; Back/Forward/reload; HH School → Học cùng nhau giữ nguyên shell. Lazy whiteboard group tải được từ manifest production.
- Viewport 1440/768/375, chữ 200%, reduced motion và không overflow ngang ở các màn hình đã kiểm tra; keyboard pin/focus, board move/undo/redo và cleanup track/preview. Browser pageErrors: 0.
- LiveKit Cloud thật đã nhận kết nối/media và các phần cộng tác trong các lượt thử, nhưng có timeout/reconnect làm một số lượt dừng. Kết quả full-pass nêu trên là loopback, không phải chứng nhận một phiên Cloud/WAN ổn định hoàn chỉnh.
- Runner xóa các room QA do nó tạo; screenshot/profile ở Temp, không commit khóa, credential, cấu hình CLI hoặc profile.

## Giới hạn và tương thích

- Rooms/membership/board/polls/agenda dùng TTL phòng hiện có (24 giờ), không phải kho lớp học vĩnh viễn. Chat và undo history chỉ trong phiên/tab; ghi chú vẫn riêng theo tài khoản.
- Một phiếu theo danh tính session/tài khoản, không xác minh một người ngoài đời. Giới hạn chống spam chat là lớp ứng dụng; không phải WAF/DDoS protection cho SFU.
- Thời gian tổng kết là thời gian đồng hồ nhóm chạy, không phải thời gian từng người thực sự chú ý học. Mở nhiều tab không tạo thêm vòng hoặc tổng thời gian server.
- Chưa kiểm thử Safari/iOS, thiết bị mic/cam vật lý, tải 32 người, WAN mất mạng dài, restart MongoDB hoặc TTL qua 24 giờ. Không tự tạo tài khoản production để kiểm thử.
- Room cũ thiếu các trường mới được đọc với mặc định an toàn, không cần migration hay đổi định dạng dữ liệu cũ. Client cũ không gửi settings revision vẫn được hỗ trợ; client mới gửi revision để phát hiện bản sửa cũ.
- Assets: Study Together CSS/JS v6; study-room-core.js?v=1; lazy study-whiteboard.js?v=1; Platform Home JS v12; router v284; loader v697; service-worker release 1035.

## Nguồn và giấy phép

Không dùng mã/asset bên ngoài mới. Mã vector board, timer/poll core và UI là phần tự xây dựng của dự án. Giữ SDK/thư viện đã có:

- LiveKit client 2.22.3 và server SDK 2.19.1 · Apache-2.0 · [client](https://github.com/livekit/client-sdk-js), [server SDK](https://github.com/livekit/server-sdk-js).
- LiveKit server 1.13.8 dùng cho QA cục bộ · Apache-2.0 · [server](https://github.com/livekit/livekit).
- qrcode-generator local · MIT · [repository](https://github.com/kazuhikoarase/qrcode-generator).

Không hotlink media, sao chép giao diện hoặc thêm thư viện whiteboard nặng.
