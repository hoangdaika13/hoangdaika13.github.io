# HH School — đợt hoàn thiện 1065

Ngày kiểm tra: 27/10/2026. Phạm vi phát hành là HH School `/learn/*`, dữ liệu, bộ tải và API giáo dục phục vụ trực tiếp module.

Đợt này bổ sung hành trình học–luyện–chữa lỗi–thi thử, giao–nộp–nhận xét–sửa bài, biên tập nháp và cơ chế giữ lịch sử. **Chưa hoàn tất giáo trình phổ thông lớp 1–12.** Không có bài nào được tự gắn nhãn đã thẩm định.

## Nội dung và cách mở

- 219 bài nguyên bản, 793 câu trong 12 pack theo lớp; 146/168 cấu hình lớp–môn của catalog có bản biên soạn. Một vài bài trong một môn không chứng minh đã hoàn thiện môn đó.
- 0 bài đã được duyệt. Chọn **Xem trước bản biên soạn** để đọc và luyện thử; lựa chọn lưu theo tài khoản/hồ sơ. Khi tắt xem trước, bài nháp được ẩn khỏi luồng học, tìm kiếm và thẻ ôn.
- 153 vị trí phần chương trình đã định vị phục vụ đối chiếu; chưa có mẫu số yêu cầu cần đạt chính thức. `officialOutcomeCount: null`, `complete: false`.
- 22 cấu hình chưa có bài gồm 12 phần giáo dục địa phương và 10 cấu hình ngoại ngữ lựa chọn/tiếng dân tộc chưa chọn chương trình. Các cấu hình đã có bài vẫn còn nhiều chủ đề thiếu.
- Bài đọc, tình huống, ví dụ và câu luyện được biên soạn nguyên bản. Đối chiếu toàn bộ SGK, sách giáo viên, sách nâng cao theo từng ấn bản và thẩm định chuyên môn còn thiếu.

Hai hồ sơ nội dung: [ma trận từng lớp–môn và bài/mục tiêu](hh-school-curriculum-coverage-2026-10-27.md), [nguồn đã đọc, phạm vi và khoảng trống](hh-school-content-sources-2026-10-27.md). Ma trận JSON giữ liên kết bài–mục tiêu–câu hỏi; mục tiêu nội bộ không giả là mã yêu cầu của Bộ.

## Bảng chức năng và bằng chứng

| Route/hành trình | Đã triển khai, kiểm tra | Giới hạn còn lại |
| --- | --- | --- |
| Hôm nay `/learn/today` | Năm chế độ đổi gợi ý bài thực tế; lý do dựa vào mức nội dung, bài đang học, lỗi, lịch ôn và kết quả đề đã nộp; mục tiêu/ngày học lưu được | Chưa có đồ thị tiên quyết và kiểm tra đầu vào bao phủ toàn bộ chương trình |
| Lộ trình `/learn/paths` | Đổi lớp, giữ giới hạn hồ sơ được quản lý, tải pack theo nhu cầu | Khung môn/chuyên đề chưa chứng minh độ phủ học thuật đầy đủ |
| Môn học `/learn/subjects` | 168 cấu hình mở được; lọc mức/học kỳ, mục tiêu và bài gắn ID; tìm kiếm, bookmark | 22 cấu hình chưa có nguồn/chương trình phù hợp; các môn khác mới là tập con |
| Bài học `/learn/lesson` | 10 bước; lý thuyết, ví dụ từng bước, luyện có gợi ý, tự làm, ghi chú; mô hình đếm, phân số, áp suất phù hợp bài | Chưa có minh họa/bản đồ/đồ thị hoặc mô phỏng riêng cho mọi bài |
| Ngoại ngữ phổ thông | 12 đoạn nguyên bản có transcript, giọng đọc máy chỉ bật khi chọn, dừng/tốc độ và trạng thái thiếu hỗ trợ | Không phải audio SGK, không chấm phát âm; chất lượng giọng tùy thiết bị |
| Luyện tập `/learn/practice` | Chấm số tương đương, phân số, sai số và đơn vị theo cấu hình; giữ dấu chính tả; gợi ý có ghi nhận trợ giúp; nút học lại ưu tiên đúng bài | Tự luận/sản phẩm giữ trạng thái tự đối chiếu rubric, không tự coi là giáo viên đã chấm |
| Tiến độ `/learn/progress` | Sổ lỗi, flashcard từ lần làm thật, ôn đến hạn, bằng chứng theo bài, CSV; lật thẻ/Next không chứng nhận thành thạo | Chưa hiệu chuẩn mức khó hoặc mô hình trí nhớ trên người học thật |
| Kiểm tra `/learn/assessments` | Luyện đề có tạm dừng; thi thử cố định câu/phiên bản/deadline, đánh dấu, tự lưu, reload, tự nộp khi hết giờ, khóa sau nộp, chữa theo mục tiêu | Chỉ đề tự biên soạn trong ngân hàng hiện có; chưa đủ ma trận giữa/cuối kỳ, tuyển sinh theo địa phương/năm, tốt nghiệp chính thức |
| Thư viện `/learn/library` | Nguồn, độ phủ, bài đã lưu, xuất ma trận, backup đúng tài khoản/hồ sơ | Không nhập sách/đề thương mại chưa có quyền |
| Giáo viên `/learn/teacher` và bài giao ở Hôm nay | Tạo lớp/giao bài gắn lesson ID; nháp giữ đoạn văn qua reload; nộp → nhận xét → sửa → nộp lại; lưu lịch sử, kiểm tra quyền và revision ở server | QA dùng người học đã được ghi danh bằng fixture, chưa kiểm thử lời mời với tài khoản sản xuất; chưa phải hệ thi giám sát |
| Biên tập `/learn/admin` | Form thật tạo nháp, thêm phiên bản, gửi đề xuất, tải queue/phiên bản; chống lưu bản cũ và chặn học sinh sửa | Bản nháp trên máy chủ chưa tự nhập vào pack tĩnh; thẩm định/phát hành cần quy trình và bằng chứng riêng |
| Phụ huynh `/learn/family` | Giữ các chức năng liên kết hiện có; kiểm tra quyền đọc hồ sơ liên quan ở backend, chờ kho hồ sơ trước khi tổng hợp | Chưa kiểm thử trình duyệt với cặp tài khoản phụ huynh/học sinh thật trong đợt này |
| Lưu/khôi phục/đồng bộ | IndexedDB giữ lịch sử đầy đủ, projection localStorage có dấu cần archive; bảo toàn save hỏng/future, quota báo lỗi; hàng đợi đúng owner/profile; offline reload bằng SW thật; bản mới trở về chờ đồng bộ | Snapshot cloud vẫn có giới hạn 280 KB. Vượt giới hạn được từ chối rõ, không cắt lịch sử; cần API chia trang/sự kiện để hỗ trợ nhiều năm trên nhiều thiết bị |

## Kiểm thử

449 bài kiểm thử đạt, 0 lỗi, 0 bỏ qua trong lượt chạy có Chromium: `test:learning` 101, `test:all-tools` 241, `test:security:full` 107. Kiểm tra cú pháp các file JS thay đổi và `git diff --check` đạt. Kiểm thử kỹ thuật không thay thẩm định nội dung.

Trình duyệt Chromium thật kiểm tra 168 cấu hình lớp–môn, bài của 12 lớp, 5 nhóm môn bổ sung, hoạt động đếm/áp suất, ghi chú/bookmark, chọn lộ trình, lỗi → flashcard → luyện lại, thi thử reload và chữa đề. Full shell qua 4 theme, 375/768/1440px, DPR2, zoom 200%, forced colors, focus bàn phím; 252 phép đo tương phản đạt. Đã mở xem ảnh runtime và loại bóng chữ neon gây nhiễu vùng đọc.

13 tình huống phục hồi gồm local/IndexedDB hỏng hoặc phiên bản mới, thiếu IndexedDB, quota, mạng/checksum lỗi, đổi lớp nhanh hủy request, IME khi timer hết giờ, tạm dừng luyện đề và TTS bật/dừng/không hỗ trợ.

Luồng lớp và biên tập dùng DOM thật cùng handler sản xuất; danh tính QA và MongoDB trong bộ nhớ là fixture công khai. Không kiểm tra bằng cách sửa dữ liệu giáo viên/người học thật trên website. TTS dùng spy dispatch; không đo chất lượng âm thanh. Clock/visibility được điều khiển rõ trong các tình huống timer. Kiểm tra offline dùng Service Worker, CacheStorage và IndexedDB thật; CDP phát sự kiện Background Sync để không phụ thuộc lịch của hệ điều hành.

[Báo cáo máy đọc được và hash ảnh](qa-1065/report.json) liên kết kết quả của từng kịch bản. Để chạy lại, cung cấp `HH_QA_PLAYWRIGHT` trỏ tới module Playwright và `HH_QA_CHROMIUM` tới executable Chromium, rồi chạy:

```powershell
npm run test:learning
npm run test:all-tools
npm run test:security:full
node scripts/qa-hh-school-workspace.js
node scripts/qa-hh-school-shell.js
node scripts/qa-hh-school-recovery.js
node scripts/qa-hh-school-classroom.js
node scripts/qa-hh-school-editorial.js
node scripts/qa-hh-school-offline.js
```

## Ảnh runtime

| Nhóm | Bằng chứng |
| --- | --- |
| Tiểu học, THCS, THPT | [Lớp 1](qa-1065/lesson-primary.png), [lớp 6](qa-1065/lesson-secondary.png), [lớp 12](qa-1065/lesson-high-school.png) |
| Đọc–viết, ngoại ngữ | [Tiếng Việt](qa-1065/vietnamese.png), [Ngoại ngữ](qa-1065/foreign-language.png) |
| Khoa học, xã hội, tin học | [Thực hành áp suất](qa-1065/science-lab.png), [Lịch sử–Địa lí](qa-1065/history-geography.png), [Tin học](qa-1065/informatics.png) |
| Ôn–thi–chữa lỗi | [Thẻ lỗi](qa-1065/mistake-flashcard.png), [kết quả desktop](qa-1065/assessment-desktop.png), [kết quả 375px](qa-1065/assessment-mobile.png) |
| Full shell và nghiệp vụ | [Mobile](qa-1065/full-shell-mobile.png), [bài nhận xét](qa-1065/student-feedback-mobile.png), [biên tập](qa-1065/editorial-drafts.png) |

## Dữ liệu và phát hành

Nguồn biên soạn nằm trong `data/hh-school/curriculum/authored-*.json`; chạy `node scripts/build-hh-school-content.js` để sinh pack, manifest, checksum và bảng độ phủ. Không sửa riêng pack đã sinh. JSON dùng LF để checksum không đổi khi checkout trên Windows. Phiên bản nội dung `2026.10.27-authored-drafts-v1`; loader 726, Service Worker cache 1065. Asset HH School đã đổi được tăng version tương ứng.

Các bản ghi mẫu cũ được giữ để tương thích ID/lịch sử và được lưu trong phần archive; không cộng vào 219 bài mới. Hàng đợi nền không phát toàn bộ bài làm của hồ sơ khác ra các tab. Chỉ trạng thái được máy chủ xác nhận mới được ghi nhận là đã đồng bộ; dữ liệu mới hoặc hợp nhất còn khác bản server giữ nhãn chờ đồng bộ.

Phần cần tiếp tục: đối chiếu toàn bộ yêu cầu hiện hành và sách theo ấn bản; biên soạn đủ các chủ đề; chọn nguồn địa phương/ngôn ngữ; mở rộng tiên quyết, đánh giá và media theo môn; thẩm định chuyên môn và thử nghiệm với người học; nâng API cloud để lưu lịch sử nhiều năm trên nhiều thiết bị. Chỉ khi có bằng chứng tương ứng mới thay `complete: false` hoặc đưa bài vào luồng đã duyệt.
