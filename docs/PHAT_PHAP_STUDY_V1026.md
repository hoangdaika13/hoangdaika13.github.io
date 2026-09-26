# Phật Pháp Study v9 — release 1026

## Phạm vi

Giữ nguyên HH Platform, đăng nhập, 27 route Phật Pháp, dữ liệu cũ và nhật ký mã hóa. Không thay Galaxy hoặc trang đăng nhập. Không thêm dependency, media, API hay đồng bộ tự động.

- Giáo lý: từ 8 lên 24 chủ đề; bổ sung 16 bài nhập môn, 16 câu tự kiểm tra và 3 lộ trình, mỗi lộ trình 6 bài. Sáu chủ đề cũ có thêm đề mục và liên kết kinh cụ thể. Giữ nguyên ID cũ.
- Bản đồ: 24 chủ đề phân nhóm, nhánh liên hệ đọc tiếp, điều hướng bàn phím bằng nút thật. Sửa Tam học/Thất giác chi trước đây mở nhầm Tứ Vô Lượng Tâm. Không khẳng định các cạnh là nhân quả hoặc phân loại chung cho mọi truyền thống.
- Thiền: 12 đề mục với hướng dẫn 4 bước, gồm 6 đề mục mới. Timer dùng mốc thời gian thay cho trừ một giây mỗi tick, cập nhật cả màn hình chính và thu gọn. Ẩn tab/rời workspace tự dừng; lưu thời gian còn lại và chỉ tiếp tục sau thao tác người dùng. Không cộng thời gian đóng trang; không phát chuông tự động khi mount.
- Nghi thức: 8 hướng dẫn, mỗi hướng dẫn 5 bước có thể tích chọn. Chỉ là chuẩn bị và nhắc thực hành; không phải quy y, truyền giới hay nghi quỹ trực tuyến.
- Niệm/tụng: giữ 2 bài cũ, thêm 6 lời tự nhắc tiếng Việt HH (3 dòng/bài), dùng bộ đọc/điều chỉnh hiện có. Không gắn nhãn các lời mới thành kinh, chú hoặc lời Phật.
- Lưu chủ đề, đã học, đáp án, checklist và ghi chú theo kho tài khoản hiện có. Gói sao lưu hiện có nhận thêm trường `studyLab`; không đổi định dạng `hh.phat-phap.study.v1:<account>`.
- Nếu lưu `studyLab` thất bại, thao tác được hoàn lại và báo chưa lưu, không báo thành công. `saveState` chung nay cũng trả lỗi lưu thay vì bỏ qua.

## Nguồn GitHub đã đọc (xác minh 2026-09-25)

| Nguồn | Giấy phép / tình trạng quan sát | Phần áp dụng |
| --- | --- | --- |
| [SuttaCentral bilara-data](https://github.com/suttacentral/bilara-data), [README nhánh published](https://github.com/suttacentral/bilara-data/blob/published/README.md) | API GitHub: NOASSERTION cho toàn kho; không coi đó là giấy phép dùng mọi tài nguyên. README quy định metadata xuất bản/CC0 cho bản dịch trong quy trình Bilara; vẫn phải kiểm tra từng tác phẩm. Không archived; pushed 2026-09-25. | Tham khảo tách bản văn, mã đoạn và metadata. HH thêm mã kinh + URL đối chiếu cho từng bài; không nhập bản dịch, code hoặc tài nguyên từ kho. |
| [nyxkn/meditation](https://github.com/nyxkn/meditation), [main.dart](https://github.com/nyxkn/meditation/blob/main/lib/main.dart), [LICENSE](https://github.com/nyxkn/meditation/blob/main/LICENSE) | GPL-3.0; không archived; pushed 2024-12-06, không khẳng định đang được bảo trì tích cực. | Đọc cách tách cài đặt âm lượng, chuông đầu/cuối/giữa và mặc định lưu trữ. Chỉ tham khảo chức năng, không chép GPL code hoặc âm thanh. |
| [Hamro Meditation Timer](https://github.com/thesamanshakya/meditation-timer), [pages/index.vue](https://github.com/thesamanshakya/meditation-timer/blob/main/pages/index.vue), [LICENSE](https://github.com/thesamanshakya/meditation-timer/blob/main/LICENSE) | MIT, Saman Shakya; không archived; pushed 2026-08-15. Quyền code không được suy rộng sang các bản thu thiền của bên thứ ba. | Đọc timer, chuông giữa buổi, local settings và cleanup. HH tự triển khai đồng hồ theo deadline, không sao chép bộ đếm giảm dần, NoSleep, nhạc hoặc giọng hướng dẫn. |

Tất cả nội dung tiếng Việt mới là diễn giải/bài tập HH, không phải bản dịch được SuttaCentral hay tăng đoàn duyệt. Không có code/media bên thứ ba được nhập nên không thêm tệp giấy phép phụ thuộc mới. Không gọi GitHub/SuttaCentral trong runtime; chỉ mở nguồn khi người dùng chọn liên kết.

## Nguồn giáo lý đối chiếu

Đã đọc các đoạn JSON tiếng Anh Sujato thuộc nhánh `published` của Bilara, đối chiếu mã kinh. UI ghi rõ đường dẫn tiếng Anh và tính chất diễn giải HH.

- [SN 56.11](https://suttacentral.net/sn56.11/en/sujato): bốn sự thật, con đường trung đạo.
- [SN 45.8](https://suttacentral.net/sn45.8/en/sujato): tám yếu tố, chánh tinh tấn; nhóm Tam học là cách tổ chức bài học HH.
- [SN 22.59](https://suttacentral.net/sn22.59/en/sujato): năm uẩn, vô thường, vô ngã.
- [SN 12.2](https://suttacentral.net/sn12.2/en/sujato): các chi duyên khởi.
- [MN 10](https://suttacentral.net/mn10/en/sujato): bốn niệm xứ; hướng dẫn ngắn trên HH không thay toàn bộ pháp hành trong kinh.
- [SN 46.51](https://suttacentral.net/sn46.51/en/sujato): triền cái và giác chi.
- [SN 48.10](https://suttacentral.net/sn48.10/en/sujato): năm căn.
- [AN 6.63](https://suttacentral.net/an6.63/en/sujato): nghiệp và tác ý.
- [MN 58](https://suttacentral.net/mn58/en/sujato): sự thật, lợi ích và thời điểm của lời nói.
- [MN 61](https://suttacentral.net/mn61/en/sujato): xét hành động trước, trong, sau.
- [AN 5.177](https://suttacentral.net/an5.177/en/sujato): sinh kế của cư sĩ.
- [AN 5.57](https://suttacentral.net/an5.57/en/sujato): năm điều thường quán.
- [AN 8.54](https://suttacentral.net/an8.54/en/sujato): cư sĩ, giới hạnh và bạn lành.
- [SN 55.1](https://suttacentral.net/sn55.1/en/sujato): niềm tin vào Tam Bảo và giới hạnh.
- [Snp 1.8](https://suttacentral.net/snp1.8/en/sujato): tâm từ; UI không trình bày đây là nguồn của toàn bộ bốn vô lượng tâm.

## Kiểm thử

### Tự động — 2026-09-26

- 77/77 test đạt: `phat-phap-study`, `phat-phap`, `release-consistency`, `platform-single-shell`, `app-shell-layout-lifecycle`, `auth-navigation-contract`, `runtime-boundary`, `dynamic-navigation-contract`, `galaxy-shell-contract`, `home-stable-layout`.
- Kiểm tra cú pháp đạt cho `phat-phap.js`, `phat-phap-study-data.js`, `phat-phap-study-ui.js`, `performance-loader.js`, `sw.js`; `git diff --check` sạch.
- Bao gồm: dữ liệu cũ, tách tài khoản, lưu/khôi phục đáp án và checklist, hoàn tác khi đầy bộ nhớ, escape ghi chú, tìm không dấu, liên kết bản đồ, timer theo thời gian thực, pause/resume và không ghi trùng phiên.
- Kho không có lệnh lint, typecheck hoặc build ứng dụng tổng quát; không báo các bước đó đã chạy. Đây là module JavaScript tĩnh, không thêm bước biên dịch hay dependency.

### Trình duyệt

- Trong ứng dụng đầy đủ trên máy: khách → HH Platform → Phật Pháp; tìm `chanh ngu`; lưu/đánh dấu đã học/trả lời câu hỏi; reload giữ các dấu và đáp án. Bản đồ mở đúng Chánh ngữ, chọn Tam học bằng bàn phím; checklist nghi thức còn được tích sau reload.
- Trên trang QA dùng chính module/CSS và kho dữ liệu thử riêng: mobile 375×812, desktop 1280×900. Sau sửa, kích thước trang bằng viewport, không tràn ngang hoặc kéo dài vì sidebar đã đóng. Timer được đưa lên trước thư viện đề mục và khóa tĩnh tâm hoạt động.
- Timer im lặng chạy → tạm dừng tại 04:41 → reload vẫn 04:41 với nút Tiếp tục → tiếp tục; phiên hoàn tất hiển thị đúng một bản ghi 5 phút. Không tự chạy khi mở lại.
- Niệm tụng: có đủ 8 lựa chọn; chọn Ý hướng đầu ngày, cỡ chữ 28px, câu 2. Reload giữ bài đã chọn và cỡ chữ. Ghi chú Chánh ngữ nhập bằng bàn phím được khôi phục nguyên văn sau reload.
- Console trang QA cuối không có warning/error trong các thao tác đã kiểm tra. Các tab ứng dụng đầy đủ đôi lúc không phản hồi công cụ kiểm thử sau reload; vì vậy sửa CSS cuối được xác minh trong `tests/fixtures/phat-phap-study-qa.html`, không coi trang QA là bằng chứng cho toàn bộ luồng đăng nhập thật.

### Giới hạn

- Chưa xác minh đăng nhập tài khoản thật/Admin, thiết bị vật lý, zoom trình duyệt 200%, giọng đọc/chuông thực tế hoặc bản triển khai production. Không suy rộng kết quả fixture thành kết quả end-to-end cho mọi route.
- Chỉ kiểm thử audio ở chế độ im lặng; giọng tổng hợp còn phụ thuộc trình duyệt và giọng được cài trên thiết bị.
- Không tuyên bố đầy đủ mọi tông phái; các bài Đại thừa/Tịnh độ cũ được giữ, chưa tự bổ sung nghi quỹ hoặc phiên bản kinh chưa kiểm tra quyền. Nội dung mới là hỗ trợ học nhập môn, chưa được chuyên gia Phật học duyệt.

## Phát hành

- Cache `hh-identity-portal-v1026`; loader v688; CSS Phật Pháp v22; module v20; dữ liệu v1; giao diện học v2.
- Sửa sidebar mobile được giới hạn trong `body.app-dharma-route.app-sidebar-collapsed`, không sửa menu hay bố cục các workspace khác.
- Trang QA không được nạp bởi ứng dụng; dùng mã module thật và tài khoản giả lập `dharma-browser-qa`, không gọi auth/API hoặc gửi dữ liệu.
