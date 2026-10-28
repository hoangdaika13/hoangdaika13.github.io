# HH School 1068 — chức năng và bằng chứng kiểm tra

Các pane Đại học dùng `#/learn/university`, trạng thái điều hướng riêng trong workspace. Route phổ thông cũ giữ nguyên. Có tìm kiếm trong sidebar/command search từ entry HH School hiện có.

| Vùng | Chức năng hoạt động | Bằng chứng | Giới hạn |
|---|---|---|---|
| Sidebar và host | Mở Phổ thông/Đại học, nội dung lazy-load, theme và identity | university-shell.json; shell.json | Tìm học phần dùng bộ tìm riêng trong Đại học |
| Bàn học | Chuỗi đang học, số lượt làm thật, chọn trường/ngành/khóa/năm/kỳ, mời tham gia lớp | university.json | Năm/kỳ cá nhân không giả phân môn chính thức |
| Danh mục | Sáu chuỗi, tìm tên/chủ đề, lọc 16 nhóm, trạng thái rỗng, lưu yêu thích | university.json; university-shell.json | Nhóm chưa có bài dẫn sang thư viện |
| Chương trình | Hai bảng UIT, 176 mã, tín chỉ khi có, tìm mã/tên/phân trang, nguồn gốc | university.json; university-programme.png | Metadata, chưa có toàn bộ đề cương hoặc kiểm tra tốt nghiệp |
| Trang chuỗi | Đề cương, yêu cầu đầu vào, nguồn, chẩn đoán, bài, dự án, đánh giá | university.json; unit tests | Nội dung nền tảng HH, không quy đổi tín chỉ |
| Cầu nối | Mở bài phổ thông phù hợp và quay lại Đại học | university UI; workspace/refinement.json | Cầu nối tự học, không chứng nhận tiên quyết đại học |
| Bài học | 36 bài, lý thuyết, ví dụ từng bước, hoạt động, hiểu nhầm, ghi chú, liên kết tiên quyết | university.json; university-lesson-light.png | 0 bài đã thẩm định; preview rõ ràng |
| Mô hình | Sáu mô hình có miền đầu vào; giữ input và kết quả qua reload/render | university.json; unit tests | Không chạy mã tùy ý, không thay phòng lab thật |
| Luyện/chẩn đoán | Nháp, chấm xác định, phản hồi, sổ lỗi và mục tiêu học lại | university.json; 126 đáp án trong unit tests | Tự luận chờ nhận xét; không tự gán thành thạo |
| Đề kiểm tra | Ma trận 12 câu, snapshot, flags, pause/resume, mock deadline, reload, nộp, chữa | university.json; assessments unit tests | QA expiry dùng clock fixture 31 phút được khai báo |
| Thư viện | 65 nguồn, tìm/lọc/phân trang, nguồn/giấy phép, pin repo, bookmark/note gắn vị trí | university.json; university-library.png | Link-only; một URL TU Delft chưa ổn định qua pipeline |
| Ôn tập | Lượt làm, sổ lỗi, lịch ôn, flashcard, kế hoạch theo ngày, export backup | university.json; core unit tests | Lịch tất định; không hứa đủ điều kiện thi trường |
| Dự án cá nhân | Task/rubric, nháp, lịch sử revision | university.json | Chưa có người nhận xét thì không giả điểm |
| Lớp đại học | Giảng viên tạo lớp/invite/assign, sinh viên join/submit, chấm/redo/resubmit | university.json; classroom.json; API unit tests | Backend QA cô lập; không dùng tài khoản production |
| Autosave/offline/sync | Flush trước sync/pagehide, localStorage projection + IndexedDB, SW, merge/CAS | university.json; offline.json; recovery.json | Pack offline phải đã mở; chưa benchmark32MiB ở thiết bị yếu |
| Phiên bản tương lai | Chế độ bảo vệ byte gốc, tải backup thật, không ghi đè | university.json; recovery.json | Chưa tự hạ phiên bản snapshot |
| Owner/profile/multi-tab | Cách ly tài khoản/hồ sơ, xung đột và lịch sử hiện có | hh-school unit tests; recovery.json; offline.json | Không thay chính sách lưu cloud cũ |
| Responsive/theme | 375/768/1440, DPR2,200%,16theme,forcedcolors,focus | university-shell.json; shell.json; hai readability.json | Đo các màn hình chọn, không phải audit WCAG toàn trang |
| Nội dung phổ thông | 168 cấu hình,225bài/822câu,reader/lab/thi/lớp/editorial | workspace/shell/recovery/refinement/offline/classroom/editorial.json | Vẫn là bản nháp; SGK chưa phủ toàn bộ |

Tất cả JSON/ảnh ở [qa-1068](qa-1068/report.json). Kết quả `errors: []` chỉ là không có lỗi runtime được các bộ ghi nhận; các điều kiện cụ thể có assertion riêng trong script `scripts/qa-hh-school-*.js`.
