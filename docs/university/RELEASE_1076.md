# HH University — bản 1076

Ngày 29/10/2026. Tiếp tục trên bản 1075, giữ module `/university/*`, danh mục/điểm 2020–2026, Bàn học và tiến độ K12/MATHCORE. Không thêm dependency.

## Đối chiếu hiện trạng và kết quả

| Phần | Hiện trạng 1075 đã kiểm tra | Kết quả 1076 |
| --- | --- | --- |
| Điều hướng | Thanh mục dài; nhiều form mở cùng lúc | Thêm Tổng quan, gom công cụ phụ vào phần mở rộng; bộ lọc mobile mở/đóng có số điều kiện; thu gọn các form bổ sung và cấu hình ít dùng. Giữ token, 16 theme và đường đi cũ. |
| Trang cá nhân | Hai thẻ hành trình tĩnh | `/university/overview` có chọn hành trình, hướng dẫn có thể bỏ qua, số liệu thực từ hồ sơ, mốc/việc cần làm, thẻ đến lịch ôn, câu sai, dự án và kết quả đã nộp. Không sinh tiến độ giả. |
| Khám phá | Tìm trường/ngành và lọc nhưng chưa lưu bộ lọc | Lưu tối đa 20 tìm kiếm trường và 20 tìm kiếm ngành; URL công khai giữ bộ lọc và hỗ trợ quay lại. Tìm không dấu/mã/tên giữ nguyên. |
| Hồ sơ | Ba hồ sơ có metadata chính thức bổ sung | Năm hồ sơ; thêm Cao Thắng và HUBT, liên kết mở địa chỉ trên bản đồ, thông tin chương trình tiên tiến Cao Thắng có phạm vi riêng. Không gộp mã/biến thể chương trình. |
| So sánh | Một bảng hiện tại, tối đa bốn lựa chọn | Tối đa 12 bảng có tên; chọn tiêu chí, đặt hàng ưu tiên, lọc hàng khác nhau, xem thẻ trên mobile; lưu ưu/nhược điểm và câu hỏi từng lựa chọn. Báo thay đổi chưa lưu vào bảng có tên. CSV/in/PDF cũ tiếp tục hoạt động. |
| Nguyện vọng | Thứ tự, ghi chú và gợi ý có giải thích | Bổ sung phương thức tự ghi, điều kiện còn thiếu và checklist riêng từng nguyện vọng; xóa nguyện vọng cũng xóa phần chuẩn bị tương ứng. Không tính xác suất đỗ. |
| Lịch | Danh sách, checklist và ICS | Lịch tháng 42 ô, lọc trường/loại/hoàn thành, hiển thị quá ngày, sửa mốc cá nhân, giờ kết thúc, liên kết học phần và cảnh báo trùng sự kiện. Mốc nguồn giữ riêng. ICS dùng đúng thời lượng; nhắc chỉ khi trang mở và người dùng cấp quyền. |
| Tài chính | Một dự toán, hai dòng học phí UIT dự kiến | Thêm mức phí chương trình tiên tiến Cao Thắng; lưu tối đa 12 kịch bản ngân sách độc lập, mở lại, ghi giả định và xuất CSV. Không tự trừ học bổng hoặc biến học phí dự kiến thành chính thức. |
| Sinh viên | Danh sách học phần/GPA, mục tiêu và môn tiên quyết | Thời khóa biểu tuần theo kỳ, đổi ngày bằng nút/bàn phím, nhóm môn tự đặt, trạng thái học lại/tạm hoãn; mô phỏng điểm một môn không thay điểm thật. Tín chỉ loại trùng mã và GPA theo cấu hình được giữ. |
| Học liệu | 65 liên kết, sáu khóa nền tảng, flashcard/câu sai | Phân trang 12 nguồn, lọc nhóm/quyền/thẩm định/ngôn ngữ/trình độ có trạng thái chưa xác minh và không kết quả. Thêm 24 bài tự biên soạn, mỗi bài có hai gợi ý, bước giải, đáp án, cách kiểm tra và câu trắc nghiệm. Lưu lịch sử mở chủ đề và kết quả bài đã nộp; việc đọc không tự ghi thành thạo. |
| Gemini | Chọn môn/trường rồi gửi trực tiếp | Xem trước câu hỏi, bài làm và ngữ cảnh; xác nhận mới gửi. Đi từ chủ đề học sang AI bằng ID công khai; máy chủ xác minh chủ đề thuộc học phần. Hủy được truyền tới fetch nhà cung cấp, giữ kiểm tra nguồn và chống kết quả cũ. |
| Năng lực/dữ liệu | Kỹ năng, dự án, CV, state cục bộ | Dự án gắn học phần, kỹ năng, đóng góp/minh chứng; hai cách trình bày CV và giữ xuất/in/xóa. Bản sao máy chủ thủ công theo nhóm, xác thực, revision và xử lý xung đột. Trang nguồn thêm các dấu hiệu cần kiểm tra lại. |

## Dữ liệu thực có

Giữ **959 hồ sơ lịch sử/đơn vị/cơ sở**, **21.286 biến thể chương trình ở 586 hồ sơ**, **119.621 bản ghi điểm ở 309 hồ sơ**. Đây chưa phải danh sách đối chiếu đầy đủ các trường và ngành đang hoạt động. Không sửa năm, thang điểm thiếu hoặc suy luận kiểm định hiện tại từ hồ sơ lịch sử. [Độ phủ gốc](coverage-1069.json), [giới hạn bản trước](RELEASE_1075.md).

Metadata mở rộng hiện có **5 hồ sơ**, **3 dòng học phí**, **2 thông báo đăng ký học bổng**, **1 công thức HUBT phạm vi hẹp**, **4 mốc nguồn** và **12 nguồn cơ quan/trường**. Không tăng số công thức khi chưa đọc đủ quy tắc, mã chương trình và điều kiện áp dụng.

- [Cao Thắng: thông báo chương trình tiên tiến 2026](https://caothang.edu.vn/tuyensinh/chuong-trinh-tien-tien.html) cung cấp thông tin hai chương trình Cơ khí và Điện, Điện tử: ba năm/sáu kỳ, mức công bố 15 triệu đồng/kỳ. Không áp dụng mức này cho toàn trường hoặc tự suy ra tổng học phí toàn khóa; lộ trình tăng các năm sau giữ đúng nhãn dự kiến trong nguồn.
- [Cao Thắng: FAQ 2026](https://caothang.edu.vn/tuyensinh/hoi-dap) là nguồn riêng cho mã/địa chỉ và trạng thái ký túc xá đang bảo trì trong thông báo. Mốc đóng đăng ký chương trình tiên tiến là mốc lịch sử dự kiến, cần kiểm tra thông báo điều chỉnh trước khi sử dụng.
- [HUBT: liên hệ tuyển sinh](https://tuyensinh.hubt.edu.vn/thong-tin-lien-he/) bổ sung hai địa chỉ và số liên hệ. [Thông báo học phí khóa 31](https://tuyensinh.hubt.edu.vn/dai-hoc/hoc-phi-k31/) giữ liên kết tài liệu gốc, chưa nhập số tiền khi chưa đối chiếu tài liệu đính kèm.
- Các mức UIT khóa 2025 vẫn là dự kiến; điều kiện và hạn của hai thông báo học bổng giữ nguyên theo nguồn. Không đổi thành dữ liệu khóa 2026 của mọi chương trình.
- Ba trang nguồn [MIT 18.06](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/pages/syllabus/), [MIT 14.01](https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2023/pages/syllabus/) và [MIT 6.002](https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/) được đối chiếu thêm metadata tiếng Anh/trình độ Undergraduate. Những nguồn khác giữ chưa xác minh ngôn ngữ/trình độ; không đoán theo tiêu đề và không sao chép nội dung khóa học.

Audit trực tiếp 12 nguồn cơ quan/trường: **12 HTTP 200**, một fingerprint thay đổi so với baseline trước. Fingerprint không chứng nhận thay đổi chính sách; dữ liệu công bố vẫn được duyệt riêng. Tất cả giữ `published:false` cho báo cáo kiểm tra tự động. [Baseline](../../data/hh-university/workspace/source-baseline.json).

Học liệu vẫn là **65 liên kết** và **6 học phần nền tảng/36 chủ đề**. Bộ mới có **24 bài tập nguyên bản HH**, không phải 24 khóa hoặc đề thi chính thức. Hai bảng UIT vẫn gồm 176 mã học phần, chưa được biến thành chương trình phân kỳ/điều kiện tốt nghiệp hoàn chỉnh. Chưa có nguồn tin việc làm còn hạn hoặc dữ liệu lương; giữ cổng trường làm liên kết.

## Bảo toàn và bản sao giữa thiết bị

Schema hồ sơ công cụ tăng **1 → 2**, vẫn dùng key `hh.university.workspace.v1:<owner>` để tìm đúng dữ liệu cũ. Bộ đọc mới nhận schema 1/2, bảo toàn CV, lịch, điểm, ghi chú và ID; lần lưu tiếp theo tạo schema 2. Bộ đọc 1075 chỉ nhận schema 1 nên sẽ bảo vệ dữ liệu mới thay vì âm thầm làm rơi các trường mở rộng. Phiên bản tương lai hoặc sai cấu trúc được giữ nguyên để xuất phục hồi. Không thay schema HH School/IndexedDB, Bàn học hoặc `hh.university.v1` của danh mục.

Khi bộ nhớ đầy, công cụ tiếp tục giữ chỉnh sửa trong phiên và cho xuất hồ sơ; không báo đã lưu bền vững. Dữ liệu phiên bản tương lai không được biến thành bản sao rỗng tải lên máy chủ.

`GET/PUT/DELETE /api/university/workspace` dùng xác thực/CSRF hiện có và collection `university_workspaces`, khóa duy nhất theo chủ sở hữu. Người dùng chọn một hoặc nhiều nhóm: so sánh, nguyện vọng, lịch/checklist, kế hoạch/điểm. Nội dung tải lên được xem trước và xác nhận. Tải xuống xác nhận hai bước, chỉ thay các nhóm có trong bản sao; CV, định hướng, lịch sử đọc, học liệu cá nhân và các nhóm khác ở thiết bị được giữ riêng.

Đây là **bản sao thủ công**, không đồng bộ thời gian thực hoặc tự hòa trộn. Cập nhật dùng revision; xung đột giữ bản trên thiết bị để người dùng xem lại. Xóa bản máy chủ xóa payload, giữ revision/metadata tối thiểu để thiết bị cũ không ghi đè bản vừa tạo lại. Giới hạn 120 lượt đọc/giờ và 30 lượt ghi/giờ/tài khoản, body tối đa 500 KB. API không nhận CV hay nhóm ngoài phạm vi. Các lần ghi/xóa và xung đột được kiểm tra bằng handler thật với DB mô phỏng; không ghi tài khoản production trong QA.

Gemini dùng adapter thật, có kiểm tra trích dẫn và phạm vi số liệu tuyển sinh. Thêm bước xem trước không tự gọi mô hình. QA sử dụng phản hồi provider mô phỏng và kiểm tra REST/cancellation bằng fixture; **không gọi mô hình trả phí**. Khóa/model/quota và chất lượng câu trả lời thực tế vẫn cần được đánh giá khi dùng tài khoản thật.

## Kiểm thử và tái tạo

**655 test đạt, 0 lỗi, 0 bỏ qua**: công cụ/shell 241, bảo mật đầy đủ 107, Học tập 130, University/MATHCORE/Pháp luật/gateway/home 177. Phần mới có 21 test về migration, lịch/ICS, snapshot đúng chủ sở hữu, revision/xung đột sau xóa, riêng tư, 24 bài tập, nguồn và hủy provider. Kiểm tra cú pháp và `git diff --check` đạt.

Native Chromium full shell đạt **41 luồng**, **117 lượt đo trạng thái**, **5.804 phép đo tương phản**, **16 theme**, 375/768/1440px, DPR2, zoom 200%, forced colors và bàn phím; **0 page error, 0 tràn ngang**. Bao gồm các luồng 1075, PDF chính thức thật/local blob, ghi chú Bàn học, offline, future-version/quota recovery; và các luồng mới cho dashboard, tìm kiếm lưu, bảng nhiều bản, checklist, lịch tháng, ngân sách, thời khóa biểu, mô phỏng GPA, nguồn phân trang/lọc, bài tập, AI preview và bản sao/xung đột.

```text
npm run test:all-tools
npm run test:security:full
npm run test:learning
node --test tests/hh-university*.test.js tests/hh-mathcore*.test.js tests/hh-vietnam-law*.test.js tests/hh-core-gateway.test.js tests/platform-home*.test.js
```

Lệnh focused thực tế và tổng số cụ thể được ghi trong [báo cáo](qa-1076/report.json); wildcard trên có thể gồm thêm test nếu repository mở rộng.

Đặt `HH_QA_PLAYWRIGHT`, `HH_QA_CHROMIUM` tới runtime native; đặt `HH_QA_UNIVERSITY_WORKSPACE=1`, `HH_QA_UNIVERSITY_EXPERIENCE=1`, tùy chọn `HH_QA_OUTPUT`, rồi chạy `node scripts/qa-hh-university.js`. DB, danh tính và phản hồi Gemini là fixture được đánh dấu; PDF trường được đọc qua mạng thật.

`node scripts/build-hh-university-workspace.js` tái tạo sidecar/chỉ mục và pin bộ bài tập theo byte/SHA/version. `node scripts/audit-hh-university-sources.js --refresh` ghi candidate tại `.study-local/university-source-audit`, không tự công bố. Không tạo API nguồn chính thức chưa được xác minh. Mẫu đóng gói Vercel vẫn 162 ký tự và được kiểm tra chứa đủ tài nguyên.

[Luồng trình duyệt](qa-1076/results.json), [tương phản](qa-1076/readability.json), [tổng quan](qa-1076/experience-overview.png), [so sánh](qa-1076/experience-comparison.png), [lịch](qa-1076/experience-calendar.png), [thời khóa biểu](qa-1076/experience-timetable.png), [ôn tập](qa-1076/experience-study.png), [mobile](qa-1076/experience-mobile.png).

Release/cache **1076**, loader **737**, router **300**, University main **3**, tools/workspace/data **2**, experience core/UI/CSS **1**. Cấu hình bảo mật Vercel giữ nguyên ngữ nghĩa, chỉ trả lại định dạng header tương thích contract test cũ. Dependency/lockfile không đổi; audit thư viện có sẵn vẫn cần xử lý riêng. Kết quả kiểm tra deployment/production được báo sau push.
