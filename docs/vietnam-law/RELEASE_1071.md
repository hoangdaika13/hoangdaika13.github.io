# Pháp Luật Việt Nam — trình đọc luật 1071

Ngày phát hành: 29/10/2026 (Asia/Bangkok). Đường dẫn chính: `#/vietnam-law`.

PDF mở ngay trong website bằng PDF.js 6.4.299, thay cho việc mở tệp ở tab khác. Bản công bố gốc và phần chữ trích tự động là hai cách đọc riêng, có liên kết qua đúng trang PDF.

## Trải nghiệm đọc

- Trang văn bản mặc định mở **PDF gốc trong trang**. Liên kết có `article` vẫn mở phần tra điều; liên kết có `view=pdf&file=12965&page=4` mở đúng tệp/trang.
- Chuyển trang, gõ số trang, phóng to/thu nhỏ, vừa chiều ngang, xoay, toàn màn hình, chọn nhiều tệp của cùng văn bản, tìm chữ và tải PDF. Có lớp chữ để chọn/sao chép cùng phần chữ tiếp cận bằng trình đọc màn hình. Bản scan không có lớp chữ được ghi rõ.
- Trên điện thoại, công cụ phụ được gom vào nút **Công cụ PDF**; tìm chữ có phần mở riêng. Điều khiển có vùng chạm ít nhất 44px, focus và hỗ trợ giảm chuyển động.
- Lưu trang/tệp/zoom/góc xoay theo tài khoản trên thiết bị; thẻ Đọc tiếp và liên kết đúng trang. Thay đổi metadata, trạng thái hay lưu yêu thích không tạo lại canvas/worker đang đọc.
- Tra điều có mục lục, lọc tên/số điều, mở điều cuối, đổi cỡ chữ, chép điều kèm nguồn, chép liên kết và mở đúng trang PDF từ điều hoặc trích dẫn AI.
- Thông tin văn bản có số hiệu, loại theo nguồn, cơ quan, người ký, các ngày nguồn ghi, thời điểm kiểm tra, tệp và nguồn đối chiếu. Văn bản trực tuyến được lưu có nhãn thay vì chỉ còn mã số.
- Bộ lọc tìm kiếm được giữ trong URL. Đã sửa việc giữ canvas cũ làm bỏ qua liên kết PDF mới khi chỉ thay file/page trên cùng đường dẫn văn bản, và lỗi thay nút mục lục khi trường tìm mất focus.

## Nguồn và dữ liệu

Kho lưu tăng từ 160 lên 224 hồ sơ văn bản; 19 lên 45 bản trích chữ, 2.930 lên 6.030 tiêu đề điều. Có 12 bộ sưu tập theo lĩnh vực và 162 liên kết do nguồn cung cấp trên 35 hồ sơ. Chi tiết cùng SHA-256 ở [báo cáo phạm vi](coverage-1071.md) và [manifest kiểm tra](coverage-1071.json).

Đã bổ sung các văn bản về tố tụng dân sự/hình sự/hành chính, nhà ở, kinh doanh bất động sản, bảo vệ dữ liệu cá nhân, ngân sách, thuế, môi trường, khiếu nại/tố cáo, giáo dục và các lĩnh vực khác. Đây là bản công bố gốc; danh sách có cả văn bản lịch sử và sửa đổi, không được gắn nhãn toàn bộ còn hiệu lực.

Nguồn vẫn là [Công báo điện tử Chính phủ](https://congbao.chinhphu.vn/) và endpoint công khai phục vụ website đó. Chưa có tài liệu/quyền API riêng của Cổng Pháp luật quốc gia. Phạm vi quốc gia và hiệu lực hiện tại chưa được xác minh toàn bộ; không tự hợp nhất các sửa đổi. Bộ lọc hiệu lực áp dụng tập đã đối chiếu, ghi rõ giới hạn.

Đợt mở rộng chọn được 27/30 số hiệu yêu cầu tra. Ba số hiệu chưa tìm được kết quả chính xác từ truy vấn nguồn (`26/2008/QH12`, `67/2006/QH11`, `04/2007/QH12`); không tự tạo hồ sơ thay thế. Một tệp 12/2017/QH14 vượt giới hạn trích chữ máy chủ 12 MiB. Trình đọc PDF vẫn xem được tệp này trực tiếp; không lấy việc thiếu bản trích để suy ra văn bản không tồn tại.

## PDF lớn, an toàn và vòng đời

Nguồn chính thức cho phép CORS nhưng có nơi chỉ công khai Content-Length, không công khai Content-Range. Với tệp lớn, adapter dùng HEAD và các Range đơn theo [Fetch Standard](https://fetch.spec.whatwg.org/#cors-safelisted-request-header), đưa phần dữ liệu đã kiểm tra cho `PDFDataRangeTransport`. Không đẩy PDF lớn qua giới hạn phản hồi serverless.

Chỉ nhận HTTPS ở danh sách nguồn chính thức; không gửi cookie/khóa website sang CDN. Range có giới hạn, kiểm tra 206, độ dài thực, Content-Range/ETag nếu đọc được và chữ ký `%PDF-` ở đầu. Không ghép phản hồi 200 của máy chủ bỏ qua Range; 403 được hiển thị, không vượt chặn. Giới hạn đọc 128 MiB/tệp, tải toàn bộ trong bộ nhớ 64 MiB; tệp lớn hơn vẫn đọc từng trang khi nguồn hỗ trợ Range. Tải tệp rất lớn có liên kết nguồn ở phần thông tin.

Đã mở tệp 12/2017/QH14 gồm 127 trang, 93.282.523 byte: trang đầu chỉ cần 5 phản hồi 206, tổng 1.269.979 byte trong lượt kiểm tra. Đây là số đo của lượt đó, không cam kết mọi tài liệu cần cùng lượng dữ liệu.

Mỗi lần chỉ vẽ một trang, điều chỉnh mật độ điểm ảnh và giới hạn canvas 12 triệu pixel. Giữ góc xoay vốn có của PDF; lớp chữ dùng cả UserUnit. Hủy render, yêu cầu Range, worker, observer và sự kiện khi đổi tệp/rời module. Không chạy scripting/XFA hay hành động liên kết nhúng của PDF. Trình đọc/worker/font/CMap/WASM được tải theo nhu cầu, giữ byte và license Apache-2.0 tại `vendor/pdfjs-law-6.4.299`.

Phần trích máy chủ giữ giới hạn 12 MiB/PDF , 250 trang/tệp, 6 tệp/lượt và thời gian xử lý. Không báo đủ nội dung khi bỏ qua tệp ngoài giới hạn. Phản hồi chữ vượt 4 MiB được thay bằng metadata và thông báo đọc PDF gốc; không chèn nội dung thay thế. Số hiệu riêng ở đầu PDF được đối chiếu, loại tham chiếu đến luật khác trong thân văn bản.

Ghi chú và bookmark v1 được giữ khi thêm tiến độ đọc. Bản lưu hỏng/phiên bản tương lai không bị ghi đè. Phần chữ đã mở có thể dùng qua Service Worker; không hứa toàn bộ PDF hoặc cả kho hoạt động ngoại tuyến. Không OCR/tự điền phần chữ thiếu.

## Kiểm tra

- 549 tests ứng dụng qua, 0 fail/0 skip: 130 learning, 241 all-tools, 107 security, 71 focused (49 pháp luật/transport, 12 đại học, 10 gateway).
- Chromium thật với shell website, handler thật và DB/identity/AI fixture ghi rõ: 16 theme, 3.401 kiểm tra tương phản, 375/768/1440px, DPR2, zoom200%; 0 tràn ngang, 0 lỗi JavaScript. [Kết quả](qa-1071/results.json), [tương phản](qa-1071/readability.json).
- Đã thử PDF có chữ, 93MB, nhiều tệp, số trang nhập khi đang vẽ, mục lục 689 điều/điều 689, tìm chữ, xoay/zoom/fit, lưu trang/reload, liên kết thay file/page, nguồn 503/thử lại, ghi chú/IME, bản lưu tương lai, ngoại tuyến phần chữ và điều hướng sang Đại học/Học tập.
- PDF nhỏ dùng byte thật từ nguồn, đối chiếu SHA-256 của bản ghim. PDF 93MBđọc Range thật từ nguồn trong QA; báo cáo lưu từng yêu cầu/byte, không lưu cả PDF vào Git. AI dùng provider fixture để kiểm tra trích dẫn, không gọi model tính phí hay ghi tài khoản/cron production.

Hỏi đáp AI cần đăng nhập và khóa máy chủ; bản production 1070 chưa cấu hình OpenAI. Kiểm tra trích dẫn không bảo đảm suy luận pháp lý hoặc hiệu lực hiện tại. Dependency audit production còn các cảnh báo đã tồn tại ở SimpleWebAuthn/Vercel Blob/undici/zod; không thay dependency ngoài phạm vi trình đọc. Kết quả triển khai thật được kiểm tra riêng sau push, không gọi toàn bộ CI xanh khi audit còn lỗi.

## Tái tạo

`node scripts/expand-hh-vietnam-law.js --refresh` tạo candidate, không tự xuất bản. Sau khi kiểm tra số hiệu, nguồn, bản trích và failures, chạy `node scripts/build-hh-vietnam-law.js --candidate .study-local/vietnam-law-1071/candidate`, rồi `node scripts/report-hh-vietnam-law.js`. Runtime PDF được tạo bằng `node scripts/build-law-pdf-runtime.js` từ dependency đã khóa phiên bản. Giữ nguyên byte vendor và các JSON đã ghim theo `.gitattributes`.
