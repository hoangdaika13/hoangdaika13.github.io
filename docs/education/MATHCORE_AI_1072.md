# MATHCORE AI — release1072

Ngày bàn giao:2026-10-29, Asia/Bangkok. Điểm vào: **Học tập & Ngôn ngữ → MATHCORE AI**, `#/mathcore`.

## Những chức năng từ ảnh yêu cầu

| Yêu cầu | Phần triển khai | Phạm vi thực tế |
| --- | --- | --- |
| Giải thích lý thuyết, công thức | Kiến thức:24 chủ đề nguyên bản, điều kiện áp dụng, ví dụ, lỗi thường gặp và câu hỏi suy ngẫm | Từ nền tảng tới một số nội dung đại học nhập môn; chưa phải toàn bộ chương trình toán |
| Hướng dẫn từng bước, gợi mở tư duy | Trợ giảng có gợi ý tăng dần, ô tự làm, kiểm tra bước vừa viết; lời giải chỉ mở khi người học chọn | Bộ giải cục bộ cho phương trình đa thức theo x bậc1–2; đề khác dùng ví dụ đúng chủ đề hoặc AI |
| Trắc nghiệm theo mức độ |10 nhóm bài,3 mức số liệu,5–20 câu/lượt, chấm sau khi nộp, giải thích và thống kê theo chủ đề | Bài rèn kỹ năng tính toán; mức khó tăng số liệu, chưa tương đương ngân hàng đề thi vận dụng cao |
| Phân tích lỗi và cách khác | Đối chiếu các dòng phương trình, nhận xét dòng cần xem lại, thử nghiệm lại và phương pháp khác | Phép đối chiếu cục bộ kiểm tra các đa thức tỉ lệ; không chứng minh mọi lập luận |
| Sửa bài qua ảnh | OCR Tesseract thực sự chạy trên thiết bị; sửa/xác nhận bản chép rồi đối chiếu, đánh dấu vị trí từng dòng trên ảnh | Ưu tiên chữ in rõ; phân số xếp dọc, số mũ và chữ viết tay cần xác nhận; sửa bản chép sẽ bỏ các ô đánh dấu cũ |
| AI đọc ảnh và trợ giảng tự nhiên | Endpoint máy chủ thực dùng Responses API và Structured Outputs qua adapter hiện có; kiểm tra trích dẫn bài làm và giới hạn vùng ảnh | Cần tài khoản HH, khóa OpenAI hợp lệ và mô hình được tài khoản cấp quyền; QA dùng provider fixture rõ ràng, chưa gọi mô hình trả phí |
| Hình học3D |5 khối: hộp chữ nhật, chóp, trụ, nón, cầu; tọa độ3D, phép chiếu phối cảnh, xoay bằng chuột/chạm/phím, đổi kích thước, thiết diện và thể tích | Dựng hình bằng Canvas; mặt cắt ngang song song đáy; không phải phần mềm chứng minh hình học tổng quát |
| Đồ thị tương tác | Parser giới hạn, miền xem, tọa độ điểm, tiếp tuyến gần đúng, các đồ thị mẫu | Hỗ trợ x, toán tử và9 hàm; lượng giác radian; không vẽ tiếp tuyến khi sai phân hai phía không phù hợp |
| Mẹo Casio |6 hướng dẫn cho fx-580VN X và fx-880BTG, liên kết PDF chính thức; máy tính khoa học thực tính biểu thức với DEG/RAD | Máy tính HH không giả lập phần cứng hoặc toàn bộ ứng dụng Casio |

## Cấu trúc và vòng đời

- `hh-mathcore-content.js`: dữ liệu bài học và hướng dẫn Casio tự biên soạn.
- `hh-mathcore-core.js`: parser không dùng eval, số học có giới hạn, bộ giải/đối chiếu, sinh bài luyện, đo khối và codec dữ liệu.
- `hh-mathcore-ai.js` / `.css`:6 khu vực, ảnh bài làm, phản hồi, dữ liệu tài khoản và giao diện theo token của website.
- `hh-mathcore-graphics.js`: Canvas mật độ cao, mô hình3D, đồ thị; ResizeObserver, pointer capture và animation frame được giải phóng khi rời trang.
- `hh-mathcore-ocr.js`: tải thư viện OCR dự án theo nhu cầu; gửi byte ảnh vào worker, không fetch blob qua CSP; hủy việc đang chờ và dừng worker.
- `utils/mathcore-handler.js`: xử lý qua module API hiện có và rewrite `/api/mathcore/:resource`; không thêm serverless function riêng.

Đã gắn vào sidebar, trang chủ Platform, tìm kiếm lệnh, HH CORE, asset loader và Service Worker. Cache1072, loader733, script300, gateway12, Platform Home23; các asset MATHCORE v1.

Sổ tay/draft/lượt luyện tách theo `hh.mathcore.v1:<owner>` trên thiết bị. Ghi chú tự lưu, bài có thể lưu/bỏ lưu và xuất JSON. Ghi dữ liệu luôn đối chiếu thay đổi từ cửa sổ khác; bản dữ liệu hỏng hoặc phiên bản tương lai được bảo toàn và tải bản sao. Chưa có đồng bộ sổ tay toán giữa các thiết bị.

## AI và ảnh

`GET /api/mathcore/status` trả trạng thái cấu hình, không đọc DB và không gọi AI. `POST tutor`/`photo` yêu cầu đăng nhập, kiểm tra nguồn mutation, giới hạn theo tài khoản/IP và payload. Ảnh đầu vào trình duyệt tối đa10MB được chuyển thành JPEG tối đa1600px và1,6MB. Máy chủ xác nhận chữ ký JPEG/PNG, kích thước và base64; không nhận URL ảnh từ người dùng.

API tutor mặc định bỏ đáp số, các bước giải và cách khác khỏi phản hồi; người học phải chọn xem lời giải để yêu cầu chúng. Nhận xét bài làm phải trích nguyên văn đoạn có trong dữ liệu. Ô đánh dấu ảnh phải nằm trong tọa độ chuẩn hóa0–1; nhận xét không chắc chắn không có ô đánh dấu.

Dùng `OPENAI_API_KEY` hoặc `OPENAI_API_KEYS` hiện có. `MATHCORE_AI_MODEL` có thể chọn trong allowlist của adapter dùng chung; không thay allowlist ở release này. Adapter dùng `store:false`; ứng dụng không ghi ảnh/bài làm vào MongoDB hoặc `moduleActions`. OCR cục bộ không gửi ảnh tới máy chủ. Các phiên AI có thể chịu chính sách xử lý dữ liệu của nhà cung cấp.

## Kiểm chứng

**584 kiểm thử qua,0 lỗi,0 bỏ qua**:

| Bộ kiểm thử | Kết quả |
| --- | --- |
| HH School, có bài kiểm tra IndexedDB bằng Chromium thật |130/130 |
| All Tools, điều hướng, runtime và release |241/241 |
| Security đầy đủ |107/107 |
| MATHCORE23 + Law49 + University12 + HH CORE10 |94/94 |
| Platform Home và cuộn |12/12 |

Kiểm tra toán gồm4500 câu sinh từ các seed/mức/chủ đề để bảo đảm4 phương án khác nhau về giá trị; phương trình tạo từ nghiệm biết trước; miền xác định, trường hợp suy biến, nghiệm gần đúng, số quá nhỏ, cusp, input thực thi mã và giới hạn tài nguyên.

`scripts/qa-hh-mathcore.js`:13 nhóm thao tác qua shell thật, OCR thật và API handler thật; DB/tài khoản/provider AI được mô tả rõ là fixture. Kiểm tra16 theme,37 trạng thái bố cục ở375/768/1440px và zoom200%,1105 phép đo tương phản,0 tràn ngang,0 page error. Có kiểm tra hủy phản hồi cũ, tách tài khoản, tải bản gốc phiên bản tương lai, ảnh có vị trí lỗi và hồi quy HH School/Pháp luật/Đại học. Không gọi AI trả phí hoặc sửa dữ liệu sản xuất.

Ảnh và kết quả: [qa1072](./mathcore-qa-1072/results.json), [đo giao diện](./mathcore-qa-1072/readability.json).

## Tài liệu tham khảo

Các ghi chú và ví dụ tiếng Việt là nội dung nguyên bản. Liên kết đọc sâu: [OpenStax Algebra and Trigonometry2e](https://openstax.org/details/books/algebra-and-trigonometry-2e), [Calculus1](https://openstax.org/details/books/calculus-volume-1), [Introductory Statistics2e](https://openstax.org/details/books/introductory-statistics-2e).

Đã đối chiếu nguồn chính thức: [Casio fx-580VN X](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-vi/f/fx-580VNX_VI.pdf), [Casio fx-880BTG](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-vi/f/fx-880BTG_VI.pdf), [OpenAI Images and Vision](https://developers.openai.com/api/docs/guides/images-vision), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md). Hai PDF Casio trả HTTP200 khi kiểm tra2026-10-29; một số trang HTML hỗ trợ Casio trả503, nên giao diện dẫn đến PDF chính thức.
