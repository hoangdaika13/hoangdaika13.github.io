# HH School 1066 — theme chung, học gọn hơn và lịch sử nhiều phần

Đợt tiếp nối 1065, hoàn thiện ngày 28/10/2026, trong phạm vi HH School `/learn/*` và các thành phần trực tiếp phục vụ module. Giao diện dùng token theme của website, nội dung phụ gọn hơn trên mobile, bài luyện giữ nháp, có đường quay về bài nền tảng và đồng bộ lịch sử vượt giới hạn snapshot 280 KB cũ.

**Giáo trình lớp 1–12 chưa hoàn tất.** Hiện có 225 bài nguyên bản, 822 câu; toàn bộ vẫn là bản nháp, 0 bài được thẩm định. Người học chọn xem trước một cách rõ ràng. Độ phủ chính thức tiếp tục là `null`, `complete: false`.

## Những thay đổi trong trải nghiệm

| Khu vực | Hành vi sau nâng cấp | Bằng chứng |
| --- | --- | --- |
| Theme và full shell | Màu nền, surface, field, chữ và accent lấy từ theme chung; thích nghi 16 theme; chữ đọc không nhận bóng neon | 760 phép đo tương phản, focus/forced colors, desktop/mobile và zoom 200% |
| Hôm nay | Bài học và nút bắt đầu đứng trước bộ lọc; gợi ý vẫn dựa vào mức nội dung, lỗi và bài đang học | Ảnh full shell; native chọn foundation/school/advanced |
| Môn học | Nhóm bài theo chương/chủ đề; có trạng thái đã xem/hoạt động/tự luyện; bộ lọc thu gọn trên mobile | 168 cấu hình lớp–môn mở được; bookmark/tìm kiếm và chọn bài giữ hoạt động |
| Bài học | Header gọn, outline/ghi chú là disclosure; ưu tiên vùng đọc; có liên kết tiên quyết, lazy-load được bài khác lớp | Nút lớp 5 mở bài nền tảng lớp 4; cùng route vẫn cập nhật đúng bài |
| Luyện tập | Lưu nháp riêng từng câu, giữ dấu/đoạn văn và mức trợ giúp; chấm một câu không xóa câu đang làm | Nhập hai form, chấm một, reload giữ câu còn lại; nháp đã nộp có tombstone để archive không phục hồi nhầm |
| Cập nhật nền | Ghi dữ liệu đang nhập trước khi vẽ lại, khôi phục đúng ô đang nhập và vị trí con trỏ | Kiểm tra IME/timer, nháp và các luồng browser hiện có |
| Kiểm tra/tiến độ/thư viện | Cùng hệ surface và control; thanh thi gọn; thẻ lỗi, kết quả và phần nguồn có phân cấp; thư viện cho xem/hủy phiên gửi dở | Các luồng thi–reload–nộp–chữa, lỗi → thẻ → luyện lại được chạy lại |
| Giáo viên/biên tập/phụ huynh | Cùng token và control; giữ server permissions và lịch sử sửa bài; các màn hình cũ dùng surface chung | Luồng giao–nộp–72/redo–sửa–91 và tạo nháp/phiên bản/đề xuất chạy qua handler thật với fixture QA |

## Nội dung mới

6 bài Toán nối kiến thức, 29 câu mới:

| Lớp | Bài | Trọng tâm |
| --- | --- | --- |
| 4 | So sánh phân số bằng cùng một đơn vị phần | Quy đồng, mốc một nửa, điều kiện cùng toàn thể |
| 4 | Trừ phân số và kiểm tra bằng phép cộng | Đơn vị phần không đổi, hiệu không âm, phép tính kiểm tra |
| 5 | Nối phân số, số thập phân và phần trăm | Bảng 100 ô tương tác, đổi cách biểu diễn cùng một lượng |
| 5 | Tìm toàn thể khi biết một phần và phần trăm | Xác định 100%, phần còn lại; gắn nhãn mở rộng |
| 6 | Tỉ số và giá trị ứng với một đơn vị | Thứ tự tỉ số, đổi đơn vị và giới hạn suy luận từ trung bình |
| 7 | Tỉ lệ nghịch: nhận ra tích không đổi | Bảng dữ liệu, phân biệt với tỉ lệ thuận, điều kiện mô hình |

Các hình thanh phân số, bảng và lưới phần trăm được vẽ bằng DOM/CSS, có mô tả chữ và giới hạn dữ liệu. Không nhập hình hoặc bài tập của sách. Các cạnh tiên quyết dùng ID thật, không có chu trình hay yêu cầu học lớp tương lai; không khóa việc chọn bài.

[Ma trận từng lớp–môn](hh-school-curriculum-coverage-2026-10-27.md) và [hồ sơ nguồn](hh-school-content-sources-2026-10-27.md) ghi rõ phần đối chiếu OpenStax 2e và những phần SGK Việt Nam chưa hoàn tất. Vẫn còn 22 cấu hình chưa có bài, các môn có bài chỉ là tập con. Chưa hoàn thành ma trận thi chính thức hoặc đánh giá đầu vào của toàn bộ chương trình.

## Lưu và đồng bộ

Snapshot nhỏ giữ tương thích đường lưu cũ. Lịch sử lớn được gửi theo phần, tối đa 180.000 byte/phần và 32 MiB toàn snapshot, tối đa 1024 phần. Bộ mã hóa chia ở ranh giới Unicode, có SHA-256 từng phần và toàn bộ nội dung. Bốn request độc lập được gửi mỗi lô; khi cùng snapshot bị gián đoạn, chỉ gửi lại phần còn thiếu.

Máy chủ lưu phần bất biến theo tài khoản/hồ sơ/transfer/index, kiểm tra đầy đủ rồi đổi con trỏ tiến độ bằng compare-and-set revision. Khóa trạng thái `staging → publishing → committed` bảo vệ tình huống hủy đồng thời với công bố. Cùng một snapshot gửi từ hai tab nhận một revision; snapshot khác nhận xung đột. Chưa đủ phần hoặc sai hash thì bản máy chủ cũ được giữ. Phiên gửi dở có thể xem và hủy trong Thư viện.

Mỗi request nhiều phần ràng buộc owner với tài khoản xác thực, nên đổi cookie giữa lúc gửi bị từ chối; tài khoản cũ có thể tiếp tục sau khi đăng nhập lại. Parent/teacher linked reports không cung cấp phần chứa bài làm riêng. Client đời cũ không được ghi đè một hồ sơ nhiều phần. Legacy snapshot đọc được và được chuyển sang dạng nhiều phần ở lần lưu lớn kế tiếp; không chạy tác vụ sửa toàn bộ database của người dùng.

Service Worker nạp bộ mã hóa trong graph script lúc cài đặt. Hàng đợi dùng cùng transport, chỉ xóa sau revision xác nhận. Lỗi mạng giữ hàng đợi và trả trạng thái thất bại cho Background Sync để trình duyệt có thể thử lại; xung đột chờ người dùng giải quyết. Bản mới trên thiết bị vẫn được phân biệt với bản đã gửi. API nhận upload không làm snapshot lớn trở thành một request vượt giới hạn gateway.

Giới hạn: chưa benchmark toàn mức 32 MiB trên thiết bị yếu; bản công bố cũ và các phần được giữ, chưa có lịch tự động thu gom. Cần theo dõi dung lượng và hoàn thiện bảo trì trước quy mô lớn. Thời điểm retry nền do trình duyệt/hệ điều hành quyết định. File minh chứng dạng Blob vẫn thuộc cơ chế lưu file hiện có; việc gửi JSON không tự tải các Blob lên cloud. Tóm tắt linked report của snapshot nhiều phần phản ánh thời điểm đồng bộ, có `updatedAt`.

## Kiểm thử và ảnh

467 kiểm thử đạt, 0 lỗi, 0 bỏ qua: Học tập 119, công cụ/shell 241, bảo mật 107. Kiểm tra cú pháp, diff whitespace và rebuild pack có kết quả byte/hash không đổi. Bộ test mới kiểm tra truyền nhiều phần, Unicode, checksum, tiếp tục sau gián đoạn, idempotency, phiên cũ, đổi tài khoản, private reports, hai tab và cuộc đua hủy–công bố. Ba trường hợp bổ sung kiểm tra client lưu snapshot nhỏ khi bản nhiều phần thắng trước, trong lúc tạo hồ sơ hoặc trong lúc cập nhật revision; phản hồi xung đột giữ owner và manifest để tải đủ lịch sử cần hợp nhất. Fixture database áp dụng projection ở `findOne` như truy vấn thật.

7 bộ kiểm tra Chromium: workspace, shell, recovery, refinement, offline, classroom, editorial. Có 168 cấu hình lớp–môn, bài của 12 lớp, 16 theme, 375/768/1440px, DPR2, zoom 200%, keyboard/IME/reduced motion/forced colors. 13 tình huống recovery hiện có tiếp tục đạt. Đã mở xem ảnh, bỏ phần header thừa và đưa nút học lên trước mô tả dài trên mobile.

QA backend dùng handler sản xuất với danh tính cookie và MongoDB trong bộ nhớ được khai báo rõ; không sửa lớp học thật trên máy chủ. Native button gửi 1601 lượt làm rồi tải đủ về; native Service Worker gửi 1500 lượt sau offline, cố tình gây HTTP 503 ở một phần, giữ hàng đợi và hoàn tất khi gửi tiếp. Node tests kiểm tra 1800 lượt và các race. Đây không phải kiểm thử tải lớn trên MongoDB sản xuất. TTS dùng spy dispatch, clock/visibility có fixture và Background Sync dùng CDP để điều khiển lịch phát sự kiện.

[Báo cáo máy đọc được](qa-1066/report.json) liên kết kết quả và hash ảnh.

| Màn hình | Ảnh |
| --- | --- |
| Hôm nay | [Desktop](qa-1066/home-desktop.jpg), [full shell mobile](qa-1066/home-mobile.jpg) |
| Môn học, luyện tập, thư viện | [Môn học](qa-1066/subjects-desktop.jpg), [luyện tập](qa-1066/practice-desktop.jpg), [thư viện](qa-1066/library-desktop.jpg) |
| Bài học | [Desktop](qa-1066/lesson-desktop.png), [mobile](qa-1066/lesson-mobile.png), [mô hình phần trăm](qa-1066/percent-model.png) |
| Thi và chữa lỗi | [Kết quả](qa-1066/exam-result.png), [thẻ lỗi](qa-1066/mistake-flashcard.png) |
| Tiến độ | [Báo cáo và mục tiêu tiếp theo](qa-1066/progress-desktop.jpg) |
| Nghiệp vụ | [Nhận xét bài](qa-1066/classroom-feedback.png), [biên tập](qa-1066/editorial-drafts.png) |

Chạy lại bằng `npm run test:learning`, `npm run test:all-tools`, `npm run test:security:full`. Với Playwright/Chromium đã cung cấp qua `HH_QA_PLAYWRIGHT` và `HH_QA_CHROMIUM`, chạy các script `scripts/qa-hh-school-{workspace,shell,recovery,refinement,offline,classroom,editorial}.js`. Output mặc định nằm trong `.study-local/`, không stage profile hoặc dữ liệu trình duyệt.

## Phiên bản và phần tiếp theo

Loader 727, cache SW 1066; workspace JS/CSS v2, core v6, sync v5, host v8, codec v1, content manifest v2; nội dung `2026.10.27-authored-drafts-v2`. Backend tạo các index mới khi khởi tạo; script migration giữ cùng definitions. Schema tiến độ v3 và study workspace v1 được mở rộng theo cách cộng thêm trường, giữ dữ liệu cũ.

Còn phải biên soạn nhiều chủ đề, đối chiếu đầy đủ chương trình/SGK theo ấn bản và năm, chọn tài liệu địa phương/ngôn ngữ, bổ sung ma trận thi và đồ thị kiến thức rộng hơn, thẩm định chuyên môn và đo hiệu quả học thật. Đợt này không thay các trạng thái đó thành đã hoàn tất.
