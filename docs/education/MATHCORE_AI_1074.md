# MATHCORE AI — Gemini1074

Ngày 2026-10-29. Điểm vào: **Học tập & Ngôn ngữ → MATHCORE AI**, `#/mathcore`.

## Cách sử dụng

Đăng nhập, chọn **Gemini** trong ô Trợ giảng AI, nhập đề rồi nhấn **Hỏi Gemini**. Ứng dụng mở từng gợi ý; nút **Em đã thử — xem lời giải** lấy lời giải đầy đủ, các bước và cách khác. Người học có thể gửi bước đang làm để Gemini nhận xét và lưu lời giải vào Sổ tay.

Ở **Sửa bài qua ảnh**, chọn ảnh hoặc chụp ảnh, cắt/xoay nếu cần rồi nhấn **Gemini nhận xét ảnh**. Gemini chép nội dung nhìn thấy, nêu chỗ chưa rõ và nhận xét từng dòng có trích dẫn; vị trí không chắc sẽ không được vẽ. Nút **Quét trên thiết bị** tiếp tục dùng Tesseract cục bộ.

Có thể chọn OpenAI khi máy chủ đã cấu hình nhà cung cấp đó. Chuyển lựa chọn trong lúc đang xử lý sẽ hủy việc nhận kết quả cũ. Khi mở tiếp lời giải hoặc hỏi về một bước của bài đã có, ứng dụng giữ đúng nhà cung cấp và đề gốc, kể cả khi ô nhập đã thay đổi.

## Kết nối trên máy chủ

- Dùng lại `GEMINI_API_KEYS`, `GEMINI_API_KEY` hoặc `GOOGLE_AI_API_KEY` của website. Không có ô nhập khóa trên trình duyệt và không truyền khóa xuống client.
- Ưu tiên model theo `MATHCORE_GEMINI_MODEL` → `GEMINI_MODEL` → `gemini-3.8-flash`. Không thay model của Chat AI hoặc các module khác. Google công bố Gemini3.8 Flash hỗ trợ đầu vào chữ/ảnh và đầu ra có cấu trúc trong [tài liệu model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
- Gọi [GenerateContent REST API](https://ai.google.dev/api/generate-content) với khóa trong header, ảnh inline và [JSON Schema](https://ai.google.dev/gemini-api/docs/structured-output). Không bật công cụ tìm kiếm, thực thi mã hoặc tải tệp lên File API.
- Tối đa hai khóa mỗi yêu cầu, cùng một model/nhà cung cấp và một thời hạn23giây. Khóa bị giới hạn hoặc lỗi quyền được đưa vào thời gian chờ bằng key pool hiện có. Hết khóa khả dụng sẽ báo lỗi rõ ràng; không tự gửi đề sang OpenAI.
- Giữ đăng nhập, kiểm tra origin và giới hạn chung12yêu cầu/tài khoản/10phút,30yêu cầu/IP/10phút. Backend kiểm tra lại trích dẫn từ bài làm, định dạng lời giải và tọa độ đánh dấu ảnh. Phản hồi thiếu, bị chặn hoặc sai định dạng không được trình bày như lời giải hợp lệ.
- Ở luồng gợi ý, backend giữ lại lời giải/đáp số cho đến khi `reveal:true`. Ứng dụng không ghi ảnh/đề/lời giải AI vào MongoDB; bài được người dùng lưu nằm trong bộ nhớ của tài khoản trên thiết bị. Dữ liệu gửi Gemini chịu chính sách xử lý của nhà cung cấp.

Đã xác nhận API trạng thái công khai của Chat AI trên hoang8.com báo Gemini được cấu hình trước khi triển khai1074. Trạng thái có khóa không xác nhận hạn mức, thanh toán hoặc quyền dùng từng model. Không đọc hay trích xuất khóa production.

## Dữ liệu và bộ nhớ đệm

Schema tăng lên3 để giữ nguồn Gemini cho bài đã lưu. Codec nhận dữ liệu1/2/3 và giữ nguyên ghi chú, phiên luyện, câu sai và lời giải cũ. Đã chạy codec thực của1073 để xác nhận tab cũ bảo vệ dữ liệu3 thay vì ghi đè và đổi nhãn Gemini thành công cụ cục bộ.

Core và UI tăng lên asset v3. Content/CSS giữ v2; engine/practice/image/graphics/OCR giữ v1. Release/cache1074, loader735, shell300. Các nâng cấp toán và luyện tập của [1073](./MATHCORE_AI_1073.md) được giữ nguyên.

## Kiểm thử

**611 kiểm thử qua,0 lỗi,0 bỏ qua:** Learning130 (có IndexedDB trong Chromium thật), All Tools241, Security đầy đủ107, MATHCORE/HH CORE/Pháp luật/Đại học/Trang chủ133. MATHCORE có50 bài kiểm thử, trong đó15 bài mới cho Gemini.

Gemini được kiểm tra bằng HTTP fixture của Google đi qua adapter và handler thực: đề chữ, ảnh inline, schema, che/mở đáp án, trích dẫn giả, tọa độ sai, xác thực, giới hạn, luân chuyển khóa, cooldown, lỗi mạng, output bị cắt và không lộ khóa trong lỗi. Fixture không gọi mô hình trả phí.

Chromium thật hoàn thành **20 nhóm thao tác**,16theme,43trạng thái giao diện, **1459 phép đo tương phản**,0lỗi tương phản,0tràn ngang,0page error. Đã kiểm tra375/768/1440px, zoom200%, Gemini riêng, OpenAI được chọn rõ ràng, hủy kết quả cũ, sổ tay giữ nhãn Gemini, nhận xét ảnh, khách chưa đăng nhập và OCR Tesseract thực.

Kết quả: [20nhóm thao tác](./mathcore-qa-1074/results.json), [đo giao diện](./mathcore-qa-1074/readability.json). Ảnh [đề chữ](./mathcore-qa-1074/gemini-tutor-fixture.png), [ảnh bài làm](./mathcore-qa-1074/gemini-photo-fixture.png), [điện thoại](./mathcore-qa-1074/gemini-mobile-fixture.png) sử dụng tài khoản và nội dung AI fixture, không phải lời giải từ Gemini thật.

Giới hạn xác minh: chưa có phiên đăng nhập production cho QA nên chưa kiểm tra lời giải từ mô hình Gemini thật. Sau khi push, kiểm tra thêm trạng thái API và giao diện production; trạng thái khóa và kiểm thử fixture không được xem là bằng chứng mô hình đã giải thành công một đề thật.
