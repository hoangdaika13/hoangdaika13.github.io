# Phật Pháp v10 — học tiếp, đọc có nguồn và âm đọc theo câu

## Kiểm kê đầu đợt

Khảo sát từ commit `8cfc20c`. Giữ 27 route và shell Platform; không chỉnh đăng nhập/Galaxy.

| Nhóm hiện có | Nền tảng giữ lại | Vấn đề / ưu tiên đợt này |
| --- | --- | --- |
| Hôm nay, nhập môn, ứng dụng | 10 bài nhập môn, tình huống đời sống | Nối với giáo lý đã đọc, đã lưu và ôn câu trả lời |
| Giáo lý / bản đồ | 24 chủ đề, 16 câu hỏi, 3 lộ trình | Thêm bài có nguồn, cấp độ, kế hoạch 7/14/30 buổi, tìm và deep link bản đồ |
| Thiền | 12 đề mục, timer deadline, lịch sử | Thời lượng tùy chọn, âm lượng, khóa nhiều tab |
| Nghi thức / tụng đọc | 8 checklist, 8 bài HH | TTS hiện dùng interval cố định có thể cắt câu; chuyển sang onend, dừng/tiếp tục có trạng thái lỗi |
| Toàn thư / kinh / nghiên cứu / OCR | Metadata, bản tóm lược, đối chiếu, OCR tùy trình duyệt | Không nhập toàn văn chưa rõ quyền; giữ công cụ hiện có, thêm điều khiển đọc giáo lý |
| Nguồn / nghe pháp / chùa / Việt Nam | Liên kết nguồn, metadata biên tập cũ | Không coi nhãn cũ là chứng nhận mới; chưa duyệt lại tất cả cơ sở/lịch/bản thu |
| Thời khóa / hồ sơ / ôn / dữ liệu | Calendar, review, backup checksum | Kế hoạch học tự nguyện, backup nhận diện phạm vi và xác nhận nhập |
| Nhật ký / nhóm / trợ năng | AES-GCM, backend khả dụng mới kết nối, cài đặt | Giữ khóa và dữ liệu; không giả realtime hoặc tự gửi ghi chú |

## Nội dung

Mục tiêu đợt này: 40 chủ đề (thêm 16 bài gốc HH) và công cụ hỗ trợ học thật. Mốc 60–80 bài được chia nhiều đợt, không nhân bản nội dung để đủ số. Lịch sử/đối chiếu tông phái và Phật giáo Việt Nam cần nguồn chuyên biệt cùng biên tập chuyên môn trước khi mở rộng.

## Tham khảo

- Bilara published, commit `18f34da070277768c259dd3e4e343b574e6af039`, kiểm tra 26/09/2026: https://github.com/suttacentral/bilara-data . API license NOASSERTION, không archived; README quy định metadata CC0 cho bản dịch trong quy trình. Chỉ đọc để đối chiếu, không nhập nguyên văn hoặc bản dịch.
- Hamro Meditation Timer, commit `ccc53a5cb41277f4a1ddb06d0cff3239cf192a66`: https://github.com/thesamanshakya/meditation-timer . MIT (Saman Shakya, 2024), không archived, pushed 15/08/2026. Đọc `pages/index.vue` về lưu preset và cleanup; không sao chép code, nhạc, NoSleep, quảng cáo hoặc cơ chế xóa cache của dự án.
- Mã và nội dung mới tự viết cho HH. Không dependency/media mới. Nguồn liên kết chỉ mở khi người dùng chọn.

## Kiểm thử và giới hạn

Đã kiểm thử tự động **90/90** bài trong nhóm liên quan: dữ liệu giáo lý, runtime đọc cục bộ, timer thiền, backup, route/deep-link, shell Platform, responsive và release consistency. Các kiểm tra trình duyệt trực tiếp trên fixture và phiên khách HH Platform đã xác nhận:

- 40 chủ đề, kế hoạch 7/14/30 buổi, lưu/gần đây/cần ôn, lọc không dấu và đường dẫn bản đồ giữ đúng node.
- Ghi chú, bài đã lưu, đáp án, cỡ chữ 24px, màu đọc ban đêm và timer 2 phút được khôi phục sau reload; 375px không tràn ngang.
- Timer từ chối khởi chạy khi Web Locks không có hoặc tab bị ẩn; không chạy trùng giữa hai tab/tài khoản.
- Bộ đọc chỉ dùng giọng tiếng Việt cục bộ sau thao tác người dùng. Máy QA không có voice `vi-*` cục bộ nên hiển thị trạng thái chưa cấu hình; không dùng giọng mạng và không tự phát âm thanh.
- Phật Pháp mở đúng trong HH Platform, giữ header/sidebar/breadcrumb và các route con. Lỗi CORS/API/realtime của máy chủ tĩnh không được coi là lỗi của workspace local-first.

Chưa coi 60–80 chủ đề, lịch sử các tông phái, toàn bộ Phật giáo Việt Nam, kho audio người thật hay phòng realtime là đã hoàn thành; các phần này vẫn cần nguồn chuyên môn, giấy phép và backend tương ứng. Xuất tệp Markdown/backup đã có mã xử lý và test checksum; trình duyệt QA không xác nhận được đường dẫn tải xuống nên không tuyên bố kiểm thử tải file end-to-end.

## Nguồn đối chiếu đã dùng

Các bài mới chỉ đối chiếu bản tiếng Anh công bố tại Bilara/SuttaCentral, không nhập nguyên văn hoặc bản dịch: [SN 45.8](https://suttacentral.net/sn45.8/en/sujato), [SN 48.43](https://suttacentral.net/sn48.43/en/sujato), [AN 4.125](https://suttacentral.net/an4.125/en/sujato), [AN 5.148](https://suttacentral.net/an5.148/en/sujato), [AN 4.32](https://suttacentral.net/an4.32/en/sujato), [DN 31](https://suttacentral.net/dn31/en/sujato), [AN 6.55](https://suttacentral.net/an6.55/en/sujato), [MN 26](https://suttacentral.net/mn26/en/sujato) và [MN 107](https://suttacentral.net/mn107/en/sujato). Nội dung hiển thị là HH biên soạn, có nhãn truyền thống và trạng thái chưa được chuyên gia duyệt.

Mã tham khảo được đọc tại Bilara commit `18f34da070277768c259dd3e4e343b574e6af039` và Hamro Meditation Timer commit `ccc53a5cb41277f4a1ddb06d0cff3239cf192a66`; không sao chép code, media hoặc dependency. Thay đổi này chưa tạo phụ thuộc mới.

Release `v1027` đã sẵn sàng commit/push sau khi hoàn tất kiểm thử trên.
