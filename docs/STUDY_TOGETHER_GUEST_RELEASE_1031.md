# Học cùng nhau · lời mời cho khách · release 1031

## Cách vào phòng

1. Chủ phòng đăng nhập tài khoản HH, mở Học tập → Học cùng nhau và tạo phòng.
2. Giữ “Nhận khách mới không cần tài khoản HH”; “Duyệt khách trước khi vào phòng” mặc định bật.
3. Sao chép liên kết mời hoặc mở “Liên kết & mã QR”. Mã QR được tạo bằng thư viện local và có thể quét thật.
4. Người nhận mở liên kết; ở màn hình đăng nhập chọn tiếp tục với tư cách khách. Link hợp lệ sẽ mở đúng phòng, không bị chuyển về Trang chủ.
5. Nhập tên, yêu cầu tham gia; chủ phòng chọn Thành viên → Làm mới → Cho vào. Mic/camera vẫn tắt cho đến khi người dùng chủ động bật.

Mọi người có mã mời hợp lệ đều có thể yêu cầu vào với tên khách khi chủ phòng cho phép. Không mở danh sách phòng công khai, không bỏ auth của website, không cấp quyền Admin cho khách. Tạo/quản lý phòng vẫn cần tài khoản HH. Tắt nhận khách chặn yêu cầu/rejoin mới, không tự đuổi các khách đang kết nối; chủ phòng dùng “Mời ra” nếu cần.

## Thay đổi và bảo vệ

- Invitation nằm trong hash `#/learn/study-together?invite=...`, không đặt API secret, join token hay guest-session token vào URL/QR.
- Guest identity ngẫu nhiên 128-bit do server tạo; không nhận danh tính, owner, role từ client. Tên khách là tên tự đặt, được hiển thị rõ, không coi là tài khoản đã xác minh.
- Phiên khách có chữ ký HMAC-derived riêng, issuer/audience riêng, chỉ dùng cho một room, hết hạn tối đa 24 giờ hoặc cùng thời điểm room hết hạn. Không dùng guest token để đăng nhập HH hay điều khiển SFU.
- Browser giữ guest-session token trong `sessionStorage`, không trong `localStorage`; RTC join token TTL 90 giây chỉ ở bộ nhớ. Guest notes tách theo room + guest identity trong tab, giữ sau reload nhưng mất khi đóng tab. Dữ liệu tài khoản HH vẫn dùng namespace cũ.
- Khách chỉ dùng join/status/leave; không được liệt kê các phòng, tạo phòng, đổi quyền, duyệt người, reset đồng hồ, đổi mã hoặc đóng phòng.
- Mặc định khách vào phòng chờ trước khi nhận RTC token. Chủ phòng có thể tắt duyệt khách nếu muốn vào trực tiếp. Không giả lập “đã kết nối” khi chưa có transport.
- Giới hạn bootstrap theo hash IP, rate-limit tiếp cho phiên khách, giới hạn nhận yêu cầu khi phòng chờ đã có 50 người. Mongo TTL cleanup giữ cùng kiến trúc hiện tại.
- Kick chặn rejoin bằng cùng phiên khách; invalid/expired token không tự hạ thành guest mới. Không hứa chặn vĩnh viễn một người ẩn danh: họ có thể đổi browser/phiên, nên giữ phòng chờ và đổi mã mời khi bị quấy rối.
- Code cũ/đã hết hạn/đã đóng bị từ chối. Thành viên đã được duyệt vẫn có thể resume bằng phiên còn hiệu lực; đổi mã mời chỉ thu hồi lời mời mới, không xóa dữ liệu của người đang học.
- Đồng hồ, media controls và toàn bộ workspace ở trong App Shell hiện có. Guest entry chỉ bảo toàn deep link hợp lệ, không tự đăng nhập hoặc tự join/bật thiết bị.

## Backend đang dùng

LiveKit Cloud project `hoang8-study` đã được xác thực và ba biến server-only `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` đã đặt dạng sensitive trong production của đúng dự án Vercel. Release 1030 được redeploy và kiểm tra config=true trên hoang8.com/www/public API trước khi phát triển bản này. Không commit các giá trị, file cấu hình CLI, profile trình duyệt hoặc log riêng.

Khóa được cấp trong lúc liên kết CLI cũng là khóa backend đang sử dụng. Không dùng `lk cloud auth --revoke` cho khóa này khi chưa chuyển backend sang khóa thay thế và kiểm thử. Không đổi gói trả phí, data region hoặc các integration khác trong đợt này.

## Kiểm thử

**122/122** focused Node tests và **106/106** auth/security/readiness tests đạt (có contract trùng, không cộng thành số unique). Bao phủ guest bootstrap, chữ ký riêng, scope, phòng chờ, tùy chọn host, guest moderation, token giả/hết hạn, data cũ, queue/rate limit và việc bảo toàn deep link. Syntax checks và `git diff --check` đạt; không có lệnh lint/typecheck/build độc lập được cấu hình trong repository.

Runner `scripts/qa-study-together.js` đã kiểm thử với LiveKit Cloud thật bằng camera/mic mẫu và màn hình canvas tổng hợp. Danh tính/account DB trong runner là QA doubles được ghi rõ, không phải đăng nhập production. Mã QR được giải mã bằng `jsQR` và so khớp chính xác URL; guest request → duyệt → connect/chat → notes/reload → resume → kick/deny đạt. Full index/App Shell cũng được mở bằng link → guest button → đúng workspace (backend auth/provider trong fixture được stub rõ).

Đã kiểm tra viewport 1440/768/375, chữ 200%, cleanup track và không overflow ngang ở connected mobile; kết quả runtime fixture không có `pageerror`. Chưa kiểm thử thiết bị vật lý, Safari/iOS hoặc tải đông người đồng thời. Không cam kết số người không giới hạn; room hiện giới hạn 32 và Cloud còn áp dụng quota của dự án.

Run local bằng thiết lập release 1030; để chạy Cloud QA, dùng explicit `HH_STUDY_QA_CLOUD_PROJECT_ID` với project đã được CLI cấp quyền, cùng `HH_PLAYWRIGHT_PATH` / `HH_BROWSER_EXECUTABLE`. Runner không đọc/in API secret ra stdout và luôn cleanup các room QA do nó tạo. Static QA server không phục vụ thư mục ẩn, node_modules hoặc env files.

## Nguồn

- LiveKit client/server SDK đã pinned ở release 1030, **Apache-2.0**: [server API](https://docs.livekit.io/reference/server-sdk-js/classes/RoomServiceClient.html), [token API](https://docs.livekit.io/reference/server-sdk-js/classes/AccessToken.html).
- `vendor/qrcode.js`: **qrcode-generator 2.0.4, MIT**, Kazuhiko Arase, đã có trong repository; [upstream](https://github.com/kazuhikoarase/qrcode-generator). Chỉ mở rộng consumer, không thêm dependency/CDN hoặc copy tài nguyên.
- `vendor/jsqr.js`: **jsQR 1.4.0, Apache-2.0**, chỉ dùng để kiểm thử giải mã QR; [upstream](https://github.com/cozmo/jsQR).
