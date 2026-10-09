# Cosmic Study Campus · release 1038

Ngày kiểm thử: 2026-10-09. Nâng cấp tiếp workspace /learn/study-together; giữ HH Platform /platform, shell, auth/Admin, route, guest token và dữ liệu cũ. Không thêm dependency, API endpoint Vercel, dịch vụ trả phí hay renderer.

## Giao diện và lớp học

- Theme Nebula, Aurora, Solar, Ocean, Minimal; accent theo khu vực, chữ/vùng bấm lớn, focus rõ, motion có thể tắt. Reduced motion và forced colors được tôn trọng.
- Đưa lớp lâu dài lên trước công cụ tạo phòng nhanh. Dashboard gồm lịch sắp tới, nhiệm vụ đang mở, kế hoạch, tài liệu mới, dung lượng thực và ngày hết hạn.
- Tìm lớp theo tên/lịch văn bản, lọc vai trò, sắp xếp tên/gần đây/yêu thích, ghim riêng trên thiết bị. Chỉ danh sách backend đã cấp quyền được hiển thị.
- PDF/ảnh và công cụ lớp mở ở vùng chính trong cuộc gọi. Reader ưu tiên ở đầu vùng chính; sidebar và header Platform không bị thay thế.
- Lưu theme, motion, độ rộng panel, mục Campus gần đây, trang board và tài liệu/trang đọc gần đây theo tài khoản. Mic/camera/share không tự bật khi reload hoặc đổi chế độ xem.

## Dữ liệu lớp và công cụ thật

- Collection Campus bổ sung, không đổi schema cũ. Calendar, tasks, notes, bank, cards, announcements, policy và liveCards có revision riêng/CAS. Lưu thất bại hoặc xung đột giữ bản nháp riêng; có xuất/bỏ bản nháp. Không tự ghép văn bản và không ghi đè âm thầm.
- Lịch có chủ đề, giờ địa phương, múi giờ IANA, 5–240 phút, người phụ trách, buổi đơn/hằng tuần, hủy/đổi từng lần và hủy cả chuỗi. Tối đa 30 chuỗi, trong 52 tuần; xuất ICS escaped, UTF-8 folded. Xem danh sách/tuần/tháng là các card trong khoảng thời gian tương ứng, chưa phải lịch kéo thả.
- Giờ DST không tồn tại bị từ chối khi nhập; một giờ bị lặp chọn lần đầu. Các lần lặp rơi vào giờ không tồn tại không được sinh; có thể đổi giờ bằng ngoại lệ. ICS dùng UTC để tương thích ứng dụng lịch.
- Kanban tối đa 60 việc: mô tả, người nhận trong lớp, hạn, ưu tiên, tài liệu và 3 cột. Kéo thả hoặc chọn cột bằng bàn phím; thành viên chỉ đổi trạng thái việc được giao. Quản lý thêm/sửa/xóa.
- Ghi chú/biên bản chung là văn bản thuần tối đa 12.000 ký tự, mọi thành viên lớp được sửa bằng revision. Checklist tương tác hiện dùng Kanban/checklist phiên đã có; chưa thêm rich-text editor hoặc CRDT cho ghi chú.
- Ngân hàng tối đa 50 câu do quản lý tự soạn: trắc nghiệm, đúng/sai và câu ngắn. Bài 1–10 câu, 1–90 phút, mở/đóng/công bố do backend kiểm tra. Không trả đáp án cho học viên trước khi đóng và công bố.
- Mỗi quiz nhận một phiếu/tài khoản; gửi lại cùng phiếu idempotent, phiếu khác bị chặn. Trắc nghiệm chấm thật, câu ngắn chờ quản lý chấm 0/1. Không nộp là chưa nộp, không có điểm suy đoán.
- Flashcard tối đa 50 thẻ: luyện/lật riêng; quản lý hoặc presenter dẫn/lật thẻ chung. Theo thẻ chung là opt-in; polling 8 giây chỉ khi panel/tab hoạt động.
- Thông báo lớp do owner/assistant đăng, tối đa 30 bài, tên/ngày lấy từ người gửi và máy chủ.
- Chat lớp là kênh riêng, không đổi tính tạm thời của chat LiveKit. Opt-in lưu tin mới 1/7/30 ngày, không quá hạn lớp; tắt lưu không kéo dài hoặc xóa ngầm tin cũ. Có trả lời, 4 reaction, ghim, liên kết tài liệu/nhiệm vụ, xóa tin của mình/quản lý, xuất và xác nhận xóa lịch sử.
- Chat xác minh danh tính/membership, escape HTML ở client, rate limit và giới hạn 500 tin; tải 100 tin mới nhất, export lớp lấy tối đa 500 tin còn hạn. Gia hạn lớp không kéo dài thời hạn tin đã gửi.
- Chat phiên bổ sung ACK từ client nhận, tối đa ba lần chuyển cùng ID, chống trùng và nút thử lại rõ ràng. Chỉ là xác nhận client nhận, không phải người dùng đã đọc; client cũ chưa hỗ trợ ACK có thể chưa xác nhận dù đã nhận. Không lưu chat phiên vào backend. Retry dừng khi tab ẩn/reconnect và dọn khi rời phòng.
- Class export giữ schema hh.classroom.v1 và thêm trường campus. Tệp vẫn tải tuần tự để tránh giới hạn response. Export của học viên không chứa ngân hàng/đáp án chưa công bố; không xuất phiếu của người khác. Xóa lớp dọn collection Campus và snapshot; bản nháp/prefs riêng trên thiết bị không phải dữ liệu chung của lớp.

## Cuộc gọi, bảng trắng và điều phối

- Giữ adaptiveStream/dynacast, reconnect, sức khỏe RTC/backend/thiết bị và audio-only của SDK đã có. Bố cục Chỉ nghe tắt thiết bị của chính người chọn, không bật lại khi đổi bố cục.
- Floor queue dựa trên các lần giơ tay backend đã ghi; quản lý chọn đang phát biểu/đã xử lý. Spotlight chung qua metadata, khác ghim riêng; không bật mic của người được chọn.
- Nhóm nhỏ giữ giới hạn 4 nhóm. Có chủ đề, người phụ trách, lời mời phân công cho HH member đã được duyệt, thông báo nhóm, hạn thảo luận 0–120 phút, broadcast và nút trở về phiên chính. Phân công là lời mời, không tự di chuyển thành viên.
- Khách vẫn ở phòng chính: không mở token guest chéo scope hoặc cho guest vào lớp riêng.
- Board thêm đường nối/mũi tên hai điểm, nhóm tối đa 12 đối tượng của mình và di chuyển cả nhóm bằng kéo/phím. Mẫu 3 bước có đường nối; vẫn vector, ownership/version, undo/redo chống ghi đè và draft offline.
- Snapshot thủ công tối đa 3/trang, có TTL theo lớp/phòng. Slot ID duy nhất chặn vượt giới hạn khi lưu đồng thời. Phục hồi phải xác nhận và đúng revision toàn trang; tăng object version, giữ owner/tombstone và phát board hint. Không stream bitmap hoặc tạo canvas renderer thứ hai.
- Canvas/PDF workers/Blob URL, observer, listener, timer, track được dọn khi đóng/unmount; polling và motion ngừng theo tab/panel.

## Bằng chứng

- 107/107 focused Node tests: Campus, Classroom, Study Together, collaboration, Platform Home, navigation/single shell, Focus Room, release/cache.
- 107/107 auth/security/backend-readiness tests. Syntax checks 14 file JS và git diff --check đạt. Dự án JS tĩnh không có lint/typecheck/build chung riêng; không gọi các kiểm tra không tồn tại là thành công.
- Browser runner đầy đủ: hai client SDK và một guest ký session qua LiveKit server thật 1.13.8 loopback. Account/auth/database là QA doubles; mic/camera Chromium mẫu, share canvas tổng hợp. Không sử dụng dữ liệu production.
- Tạo/tham gia lớp, calendar/ICS, Kanban keyboard move, shared notes conflict/network retry, quiz không lộ đáp án/nộp/chấm/công bố, flashcard dẫn nhóm, thông báo/chat pin/reaction, reload và bản nháp đạt.
- Khi đang gọi: floor/spotlight tới peer, theme/motion, PDF vùng chính/trang gần đây, vector arrow/group movement, snapshot restore tới peer, nhóm nhỏ/phân công/broadcast/trở về đạt.
- Các luồng cũ mic/camera/share, admission, signed guest, quyền phòng, notes, timer, polls, board, phiên lớp, xuất có tệp và xóa lớp vẫn đạt.
- Ca mất gói chat đầu tiên được tạo có kiểm soát tại SDK sender; lần gửi lại đi qua SFU thật, receiver chỉ có một tin và sender nhận ACK. Không gọi mô phỏng mất gói này là thử WAN/thiết bị vật lý.
- Desktop 1440/1280, tablet 768, mobile 375; chữ 200%, keyboard, reduced motion, forced colors, không overflow ngang. Back/Forward/reload giữ shell. pageErrors: 0.
- Ảnh chụp, browser profile và credential QA ở Temp/.study-local, không đưa vào Git.

## Giới hạn và nguồn

- Chưa có máy chủ gửi nhắc lịch; dùng ICS/ứng dụng lịch. Không có AI tạo/chấm bài, ghi âm/ghi hình, camera attention tracking, push ngoài website hoặc thống kê học giả.
- Chưa benchmark WAN, thiết bị vật lý, Safari/iOS, 32 người hoặc tải đồng thời production. Backend persistence/revision được kiểm thử bằng MemoryDb có hợp đồng Mongo; không chạy dữ liệu QA trong Mongo production và không chờ TTL thực qua 365 ngày.
- Lịch/quiz/flashcard/chat được refresh theo thao tác hoặc polling có giới hạn; không quảng cáo toàn bộ là CRDT/realtime. Notes là văn bản; chú thích PDF là text theo trang, không sửa PDF gốc.
- Chưa có dashboard quota tổng hợp từ nhà cung cấp; hiển thị quota tài liệu/hạn lớp hiện có, không tăng các giới hạn đó.
- Không tải/sao chép mã hoặc asset GitHub mới. Tái sử dụng LiveKit client 2.22.3/server SDK 2.19.1 (Apache-2.0), PDF.js 4.10.38 (Apache-2.0), qrcode-generator (MIT); pdf-lib local MIT chỉ sinh PDF QA.
- Đối chiếu với mã SDK trong repository và [LiveKit connect/reconnect](https://docs.livekit.io/intro/basics/connect/), [data packets/best-effort](https://docs.livekit.io/transport/data/packets/), [JS Room API](https://docs.livekit.io/reference/client-sdk-js/classes/Room.html), [Mozilla PDF.js](https://github.com/mozilla/pdf.js).

Assets: loader v700, router giữ v284, Study Together JS v8/CSS v7, Classroom JS v3/CSS v1, room core/whiteboard v3, Campus core/UI/CSS v1, SW cache v1038.
