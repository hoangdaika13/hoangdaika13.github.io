# Cosmic Classroom · Học cùng nhau · release 1036

Nâng cấp sáu nhóm chức năng trong workspace /learn/study-together. HH Platform vẫn là shell duy nhất; giữ route, auth/Admin, lời mời phòng, notes và dữ liệu board cũ. Không thêm dependency hay endpoint Vercel; các action mới đi qua API Study Together đã có.

## 1. Cuộc gọi và mạng

- Bảng sức khỏe phân biệt RTC, chất lượng kết nối do SDK báo, mic/camera/share, yêu cầu backend cuối và cập nhật đã lưu nhưng chưa phát đầy đủ.
- Khi SDK báo poor/lost, giới hạn lớp video qua API SDK đã pinned, không bật mic/cam hoặc thay đổi quyền. Ba mẫu good/excellent mới bỏ trạng thái giảm chất lượng. AdaptiveStream/dynacast và reconnect của LiveKit vẫn được giữ.
- Chỉ nghe là thao tác người dùng: yêu cầu tắt mic/camera/share, bỏ nhận video; khi tắt Chỉ nghe không tự bật lại thiết bị. Các luồng reload vẫn giữ thiết bị tắt.
- Health polling chỉ khi có phòng và tab hiển thị; cleanup listener/timer khi unmount. Không hiển thị Mbps, RTT hoặc chất lượng giả.

## 2. Lớp học lâu dài

- Lớp riêng tư có tên, mô tả, lịch học văn bản, mã mời, thành viên, kế hoạch và nhiều phiên LiveKit. Lịch là thông tin đã lưu, không phải cron/nhắc lịch tự động.
- Chủ lớp chọn 30/90/365 ngày và gia hạn rõ ràng. Tách collection classes/documents/classSessions khỏi TTL phòng 24 giờ; class board và tài liệu giữ đến hạn lớp.
- Kế hoạch lớp dùng làm mẫu khi mở phiên; kế hoạch và tổng kết từng phiên lưu khi đóng. Đồng hồ đang chạy được đóng băng theo thời điểm đóng phòng, không tiếp tục tăng sau khi mọi người rời.
- Tối đa 20 lớp của mỗi chủ, 100 thành viên/lớp, 8 phiên/nhóm hoạt động/lớp; tối đa 32 người trong một phòng RTC. Danh sách chỉ trả về lớp mà tài khoản có quyền, kể cả sau khi bị chặn hoặc trước đây từng sở hữu phiên.
- Update revision/CAS; không âm thầm ghi đè bản cũ. Export tải metadata trước, rồi từng tài liệu để tránh response vượt giới hạn serverless; JSON tải về chứa dữ liệu tệp, chú thích, kế hoạch, các board và tối đa 100 bản ghi phiên.
- Xóa lớp cần nhập đúng tên: xóa nội dung chung, đóng các phiên; lỗi ngắt LiveKit được báo syncPending, không giả vờ đã ngắt hết.

## 3. Bảng trắng

- Tối đa 8 trang; main board cũ giữ nguyên ID và định dạng. Trang của lớp dùng chung giữa các phiên của cùng lớp.
- Sticky note, mẫu sơ đồ ba bước, zoom 50–250%, kéo khung, đặt lại góc nhìn, con trỏ/laser qua data channel thật.
- Cursor là dữ liệu tạm, giới hạn 32 người, payload/geometry kiểm tra, gửi tối đa khoảng 8 lần/giây, hết hạn sau 2,5 giây; không ghi cursor vào MongoDB hoặc gửi ảnh canvas liên tục.
- Quyền xem/vẽ, ownership/version, undo/redo, draft retry/export giữ từ 1035. Bản nháp theo account/class-or-room/page, không đổi trang khi còn bản chờ chưa xử lý. DPR/RAF/cleanup giữ giới hạn.

## 4. Tài liệu

- PDF/PNG/JPEG/WebP riêng tư, 750 KiB/tệp, 20 tệp và tổng 8 MiB/lớp. Lưu trong MongoDB hiện có; không cần Blob/API mới hay upload ra ngoài.
- Kiểm tra MIME/phần mở rộng/chữ ký nội dung bằng validator đang có. API xác thực membership cho từng lần đọc, ghi và xóa; không trả URL công khai.
- PDF.js và worker local được lazy-load, không chạy JS trong PDF. Tối đa 500 trang, canvas tối đa 2 triệu pixel/4096 cạnh; hủy render/loading task và giải phóng Blob URL khi đóng.
- Chú thích chung theo trang, revision chống ghi đè; bookmark riêng theo tài khoản/tài liệu. Theo trang chỉ khi người dùng bật; tự đồng bộ mỗi 6 giây khi tab/panel hiển thị, không đổi trang nếu đang gõ chú thích chưa lưu.
- Có tải tệp nguyên bản. Không quảng cáo OCR, sửa PDF gốc hoặc đồng bộ tự động không tồn tại.

## 5. Vai trò và nhóm nhỏ

- Chủ lớp / trợ giảng / người trình bày / thành viên / bị chặn là quyền của lớp, không phải quyền HH Admin.
- Backend quyết định quyền quản lý và signed publish grants. Đổi vai trò cập nhật room metadata/permission; lỗi transport được báo riêng. Thành viên bị chặn không mở lại lớp, đọc tài liệu, thấy danh sách phiên riêng hoặc mint token mới.
- Tối đa 4 nhóm nhỏ cho một phiên. Chỉ tài khoản HH đã được duyệt được chuyển nhóm; khách vẫn dùng phòng chính được mời, không tự mở quyền chéo scope JWT khách.
- Chuyển nhóm giữ cùng track camera/mic/share đang bật theo thao tác trước của người dùng và giữ notes cá nhân. Chờ disconnect(false) của phòng cũ xong rồi republish, không xin lại quyền hoặc phục hồi track qua reload. Nếu chuyển lỗi/unmount, track giữ tạm cũng được dọn.
- Đóng phiên chính đóng cả các nhóm con. Hand queue hiện có vẫn theo sự kiện/backend thực.

## 6. Giao diện

- Cosmic Classroom có màu neon tím/cyan, card/thư viện/role controls thống nhất dark/light và focus states.
- Giữ grid/presentation/focus, panel thu gọn; thêm độ rộng panel desktop 250–480px có lưu theo account. Mobile về một cột, không cuộn ngang hoặc body lock.
- Không tạo gateway mới, animation loop hoặc WebGL renderer phụ.

## Bằng chứng · 2026-10-08

- 92/92 focused Node tests và 107/107 auth/security/backend readiness tests; syntax checks, release/cache consistency và git diff --check đạt.
- Full browser runner: hai client LiveKit SDK và một khách ký session, qua máy chủ LiveKit thật 1.13.8 trên loopback. Account/database là QA doubles; camera/mic mẫu Chromium, share bằng canvas tổng hợp.
- Luồng cũ 1035 vẫn qua. Luồng mới qua: nhiều trang → template/note → Enter zoom → pan → laser tới peer; tín hiệu poor có kiểm soát gọi API giảm chất lượng thật; Chỉ nghe ngừng/resume nhận video mà không bật thiết bị; chuyển nhóm và quay lại giữ cùng mediaStreamTrack ID/notes.
- Qua tạo/mời/tham gia lớp → upload ảnh → chú thích/bookmark → reload → phục hồi → PDF hai trang bằng worker local → dẫn peer sang PDF/trang 2 → vai trò presenter → hai phiên mới giữ board → xuất JSON có dữ liệu hai tệp/chú thích → xóa lớp.
- Desktop/tablet/375px, chữ 200%, reduced motion, Back/Forward/reload và shell/navigation không đổi; pageErrors: 0. Kiểm tra keyboard resize panel và không overflow.
- Đây không phải benchmark WAN, thiết bị vật lý, Safari/iOS, 32 người hay MongoDB production. Chưa chạy qua 365 ngày TTL; test xác nhận field/permission/expiry và restore qua backend QA. Không có scripts lint/typecheck/build riêng cho workspace JavaScript tĩnh.

## Nguồn và phiên bản

Không tải mã hoặc asset ngoài mới. Reuse:

- LiveKit client 2.22.3/server SDK 2.19.1, Apache-2.0; [kết nối/reconnect](https://docs.livekit.io/intro/basics/connect/), [LocalVideoTrack](https://docs.livekit.io/reference/client-sdk-js/classes/LocalVideoTrack.html), [RemoteTrackPublication](https://docs.livekit.io/reference/client-sdk-js/classes/RemoteTrackPublication.html). Đối chiếu API với mã nguồn SDK đã cài.
- PDF.js 4.10.38 local, Apache-2.0, [Mozilla PDF.js](https://github.com/mozilla/pdf.js); pdf-lib local MIT dùng sinh dữ liệu thử, không thêm vào runtime mới.
- LiveKit server QA Apache-2.0, qrcode-generator MIT như release trước.

Assets: Study Together CSS/JS v7, class CSS/JS v1, call health v1, core/whiteboard v2, loader v698, router giữ v284, service-worker release 1036.

Hotfix 1037: theo trang chỉ lấy reading state, không cập nhật revision của bản sửa thông tin/kế hoạch đang mở. Class JS v2, loader v699 và cache v1037 để tránh tải lại bản cũ từ service-worker.
