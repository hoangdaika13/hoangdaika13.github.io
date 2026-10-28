# HH School 1068 — học đại học, học phần và học liệu đa ngành

Ngày 28/10/2026. Tiếp nối [1067](HH_SCHOOL_RELEASE_1067.md); phạm vi `/learn/*`, nội dung, đồng bộ và API giáo dục phục vụ trực tiếp. Không chỉnh All Game hoặc các module sản phẩm khác.

## Kết quả sử dụng được

Khu **Đại học** có trong sidebar và điều hướng HH School tại `#/learn/university`. Người học chọn trường, ngành/chương trình, khóa, năm và học kỳ trong bối cảnh riêng. Dữ liệu phổ thông vẫn giữ lớp 1–12, không dùng lớp 13 để biểu diễn đại học. Có bàn học, danh mục học phần, bảng chương trình, trang học phần, bài học, luyện tập/chẩn đoán, thi thử, thư viện, kế hoạch/ôn tập và dự án/lớp đại học.

Giao diện dùng token/theme hiện có, giảm ánh sáng trang trí ở vùng đọc, giữ tương phản chữ và màu trạng thái. Mục lục, ghi chú, nguồn và bộ lọc thu gọn trên mobile. Có trạng thái tải, lỗi, chưa có kết quả, thiếu nội dung và bản nháp chưa thẩm định.

## Nội dung và độ phủ thật

| Phạm vi | Số lượng | Ý nghĩa |
|---|---:|---|
| Nhóm ngành có thư mục học liệu | 16 | Nhóm chưa có bài trong ứng dụng được ghi rõ |
| Chương trình UIT đối chiếu | 2 | Kỹ thuật Phần mềm khóa 2025, Khoa học Dữ liệu khóa 2024 |
| Mã môn trong hai bảng | 176 | 85 + 91 mã duy nhất theo từng chương trình, không phải yêu cầu tốt nghiệp |
| Chuỗi nền tảng HH nguyên bản | 6 | Đại số tuyến tính, thống kê, lập trình, vi mô, nghiên cứu, mạch DC |
| Bài học / mục tiêu tự biên soạn | 36 / 36 | Có bài giảng, ví dụ theo bước, hoạt động và hiểu nhầm thường gặp |
| Câu hỏi | 126 | 108 câu luyện khác nhau + 18 câu chẩn đoán |
| Mô hình tương tác / dự án | 6 / 6 | Có giới hạn mô hình và rubric, không giả nhận xét chuyên môn |
| Nguồn/thư mục liên kết | 65 | 47 sách Open Textbook Library + 13 cổng/trang khóa học + 5 repo GitHub |
| Học phần đã thẩm định/công bố chính thức | 0 / 0 | Chỉ xem trước bản biên soạn có thông báo rõ |

Sáu chuỗi là phạm vi nền tảng tự học khoảng 10–12 giờ dự kiến mỗi chuỗi, không nhận là học phần đầy đủ học kỳ của MIT, Harvard, Berkeley hoặc UIT. Các phần chưa có như SVD/QR trong đại số tuyến tính, mạch AC/quá độ trong điện và chủ đề chuyên ngành khác được ghi ngay trong scope từng chuỗi. Không có cấp tín chỉ, chứng chỉ hay tính GPA giả.

Danh mục UIT giữ mã môn, tên và tín chỉ khi bảng công khai thể hiện rõ; chưa xác minh toàn bộ đề cương, môn bắt buộc/tự chọn, phân học kỳ, tiên quyết và điều kiện tốt nghiệp. Bốn gợi ý học bổ trợ theo MA003, MA005, IT001, SS004 chỉ là đối chiếu nội dung nền, không phải công nhận tương đương.

Nội dung phổ thông giữ nguyên **225 bài nháp, 822 câu hỏi, 0 bài được thẩm định**, có bản nháp ở 146/168 cấu hình lớp–môn. Chưa hoàn thiện toàn bộ nội dung SGK hoặc chương trình đại học. [Ma trận đọc nhanh](hh-school-university-coverage-2026-10-28.md), [ma trận đầy đủ](hh-school-university-coverage-2026-10-28.json), [kiểm kê nguồn/quyền](hh-school-university-sources-2026-10-28.md).

## Học, luyện, thực hành và đánh giá

- Mỗi bài có giải thích, ví dụ từng bước, nhiệm vụ tự làm, đáp án đối chiếu, lỗi thường gặp, câu luyện và liên kết nền tảng. Có cầu nối về bài phổ thông hiện có.
- Mỗi chuỗi có ba câu đầu vào, phản hồi lỗi và đường học lại. Câu số được chấm bằng grader xác định với dung sai; câu tự luận giữ trạng thái chờ nhận xét. Lượt đọc, lượt làm và kết quả tự luận không bị đánh đồng với thành thạo.
- Sáu mô hình có miền đầu vào kiểm soát: định thức 2×2, thống kê mẫu, truy vết vòng lặp, cung/cầu tuyến tính, nguồn áp/điện trở DC lý tưởng và khung đề cương nghiên cứu. Mã giả không chạy mã tùy ý. Mô hình điện chỉ hỗ trợ tính toán, không thay thực hành có giám sát.
- Kiểm tra dùng engine assessment đã có: 12 câu theo ma trận hai câu/mục tiêu; snapshot khóa phiên bản đề và quy tắc chấm. Tự luyện có tạm dừng/tiếp tục; thi thử 30 phút giữ deadline qua reload, đánh dấu câu, xác nhận nộp, chữa bài và liên kết học lại.
- Sổ lỗi/lịch ôn dựa trên lượt trả lời, flashcard có thao tác lật thật. Kế hoạch sáu bài được chia theo ngày ôn chọn; đây là lịch tất định, không hứa tối ưu hóa hay AI.
- Dự án có bài toán, rubric và lịch sử sửa cá nhân. Giảng viên có quyền thật tạo lớp đại học, mời người học, giao dự án, nhận bài, chấm/nhận xét/yêu cầu sửa. Người học không tự đổi vai để chấm. Bài nộp dùng revision/CAS; browser QA đi qua 72 điểm/yêu cầu sửa, nộp revision 2 và nhận 91 điểm.
- Thư viện tìm kiếm/phân trang, lưu nguồn yêu thích và ghi chú theo trang hoặc mốc video. Link ngoài mở nguồn chính thức với thông tin quyền; không nhúng toàn văn hoặc tự tải PDF/video/notebook bên ngoài.

## Lưu trữ, cập nhật nền và phục hồi

`universityWorkspace.version=1` được bổ sung vào school schema 3; `studyWorkspace.version=1` giữ nguyên. Owner/profile dùng cùng cơ chế tài khoản hiện có. Ghi chú, nháp, lịch ôn, phiên thi, mô hình và dự án nằm trong snapshot đầy đủ IndexedDB; localStorage chỉ chiếu trạng thái tối thiểu. Nội dung tách khỏi tiến độ và tải pack theo nhu cầu, SHA-256/byte kiểm tra trước khi đọc.

Merge giữ các map theo thời điểm, tombstone nháp đã nộp, phiên thi đã nộp và phiên bản dự án. `pagehide`/visibility lưu nháp còn chờ; trước khi đồng bộ, workspace flush ô đang nhập rồi mới chụp snapshot. Bản dữ liệu mới hơn/corrupt vào chế độ bảo vệ, không ghi đè; có tải backup phục hồi thật. Timer, fetch, listener và worker của view được giải phóng theo vòng đời hiện có.

QA mới đã phát hiện và sửa hai lỗi thực tế: request body sản xuất từ chối JSON key có dấu chấm (ID bài/câu đã chuyển sang dấu gạch nối), và thao tác sync quá sớm trước đây có thể gửi snapshot thiếu ký tự vừa nhập. Bộ kiểm thử mới gọi `platform.bodyOf` thật và xác minh nội dung vừa nhập sau offline được gửi lên handler.

Giới hạn vận chuyển giữ nguyên: tối đa 32 MiB cho snapshot multipart, 280 KB cho endpoint nguyên khối cũ. Chưa benchmark trọn 32 MiB trên thiết bị yếu hoặc bổ sung lịch thu gom snapshot cloud cũ. Offline hỗ trợ các pack đã mở/tải thành công; không hứa xem được sách/video tại nguồn khi mất mạng.

## Pipeline và quyền học liệu

`scripts/import-hh-school-university.js --refresh` chỉ tạo bản candidate được bỏ qua bởi Git. Biên tập kiểm tra thay đổi và quyền trước khi thay `sources.json`. Build từ dữ liệu pin không gọi mạng, tạo catalogue/sáu pack và manifest SHA-256; đã xác minh chạy lại cho byte giống nhau. `.gitattributes` giữ LF cho JSON để blob Git trùng checksum.

Repo GitHub ghim branch, file và SHA cùng liên kết khóa học xác nhận; không dùng bài làm sinh viên làm đề cương chính thức. Tất cả học liệu ngoài ở chế độ link-only, không sao chép toàn văn, đề thi, notebook hoặc code. Khai báo license của repo không áp chung mọi tài sản. 64/65 URL trả HTTP 200; Node chưa truy cập được TU Delft. Thông báo chuyển nền tảng cuối năm 2026 được lưu là rủi ro liên kết cần kiểm tra lại, không giả báo nguồn hoạt động ổn định.

Các nhóm sức khỏe/luật chưa có nội dung chuyên môn tự biên soạn hoặc được thẩm định. Học liệu nguồn cần kiểm tra quốc gia, thời điểm, ấn bản và quyền trước khi sử dụng cho chương trình cụ thể.

## Kiểm thử và ảnh runtime

**478 kiểm thử đạt, 0 lỗi, 0 bỏ qua:** Học tập 130, công cụ/shell 241, bảo mật 107. Kiểm tra cú pháp các JS mới/thay đổi, manifest từng byte, build lặp lại và `git diff --check` đều đạt. Không đổi dependency.

Đủ **9 bộ Chromium**: workspace, shell, recovery, refinement, offline, classroom, editorial, university, university-shell. Bảy bộ phổ thông cũ được chạy lại; hai bộ mới kiểm tra UI và handler thật của Đại học, bài/nháp/mô hình, chẩn đoán, đề cố định, deadline, lưu reload, lớp/nộp/chấm/sửa, Service Worker thật, IndexedDB, sync và dữ liệu phiên bản tương lai. Cookie danh tính và MongoDB là fixture cô lập; body parser, quyền truy cập, rate limiter và handler sản xuất được gọi thật. Không dùng tài khoản riêng hoặc ghi dữ liệu QA vào production.

Full shell kiểm tra **16 theme**, tổng **1.640 phép đo tương phản** K12/Đại học không có mục tiêu đo nào thất bại. Đã kiểm tra 375/768/1440 px, DPR2, zoom 200%, forced colors, keyboard focus, IME và reduced motion trong các bộ liên quan. Khi rà ảnh 200% đã phát hiện header chồng ô tìm kiếm; container query nay xếp dọc header theo chiều rộng thực, notice xuống dòng và bổ sung assertion kiểm tra giao nhau của các nút. Phép đo áp dụng cho các màn hình/thành phần được chọn, không phải chứng nhận accessibility toàn website. Ảnh đã mở xem để rà vùng học, chương trình, mô hình, kết quả, thư viện và mobile.

[Báo cáo máy đọc được](qa-1068/report.json), [bảng chức năng](HH_SCHOOL_FUNCTION_MATRIX_1068.md), [ảnh desktop](qa-1068/university-home-desktop.png), [ảnh 375px](qa-1068/university-home-mobile.png), [bài học light theme](qa-1068/university-lesson-light.png), [bảng chương trình](qa-1068/university-programme.png), [kết quả](qa-1068/university-exam-results.png), [thư viện](qa-1068/university-library.png), [dự án nhận xét](qa-1068/university-project-feedback.png).

## Phiên bản và phát hành

Release/cache 1068; loader 729; script 296; host HH School v10; core v7; workspace phổ thông v4; workspace CSS v3. University core/content/manifest/UI/CSS v1. School CSS v4, sync v5, offline v5, assessments/codec v1 và K12 manifest v2 giữ nguyên.

Nhánh phát hành `main`. Sau commit/push cần xác minh GitHub Pages, hai deployment Vercel, cache/loader và hash pack trên hoang8.com, rồi mở phiên khách mới trên domain thật. Kết quả xác minh production được báo ở phần bàn giao chat, không suy từ QA local. CI production dependency audit đã có lỗi từ các bản trước; bản này không thay package/lockfile và không coi build/deployment thành công là toàn bộ CI đạt.
