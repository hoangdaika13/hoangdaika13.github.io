# MATHCORE AI — nâng cấp1073

Ngày2026-10-29, Asia/Bangkok. Điểm vào giữ nguyên: **Học tập & Ngôn ngữ → MATHCORE AI**, `#/mathcore`.

## Thay đổi có thể sử dụng ngay

| Khu vực | Kết quả |
| --- | --- |
| Trợ giảng cục bộ | Thêm hệ tuyến tính hai ẩn, bất phương trình bậc1–2, đạo hàm và tích phân đa thức đến bậc6. Chọn dạng toán, nhập cận tích phân, thử đề mẫu và mở từng gợi ý trước khi xem lời giải. |
| Kiểm tra bài làm | Bổ sung đối chiếu tập nghiệm giữa các dòng bất phương trình; nhận ra đổi chiều sai khi chia số âm. Phạm vi đối chiếu được nêu rõ thay vì đoán mọi lập luận đều đúng. |
| Bài luyện |14 nhóm ×3 mức yêu cầu =42 kiểu bài; mức độ đổi kỹ năng cần dùng. Ví dụ: phương trình trực tiếp → xử lý ngoặc → ẩn ở hai vế; xác suất một lần → không hoàn lại → biến cố đối. |
| Tiếp tục bài | Giữ nguyên câu hỏi, lựa chọn, vị trí và trạng thái nộp sau khi đổi trang hoặc tải lại. Không chấm lại một phiên đã nộp. |
| Sổ câu sai | Lưu đề, đáp án đã chọn, giải thích và trạng thái ôn. Có thể làm lại tối đa20 câu còn vướng mỗi lượt; câu làm lại đúng được đánh dấu đã ôn. |
| Lời giải đã lưu | Lưu đầy đủ gợi ý, điều kiện, các bước và cách khác. Có đường dẫn mở lại bài từ Sổ tay. Bài chỉ có đáp số từ phiên bản trước vẫn đọc được. |
| Sửa bài qua ảnh | Xoay90°, kéo chọn vùng cắt hoặc điều chỉnh bằng thanh trượt, áp dụng và hoàn tác tối đa3 bước. Ảnh được xử lý trên thiết bị; sửa ảnh sẽ xóa nhận xét/vị trí cũ. OCR chỉ chạy sau khi xác nhận vùng cắt. |

Các khu vực Kiến thức24 chủ đề, hình học3D, đồ thị, Casio và ghi chú tiếp tục hoạt động. Giao diện sử dụng token màu chung, điều khiển44px, bàn phím và chế độ giảm chuyển động.

## Giới hạn được thể hiện trong sản phẩm

- Bộ giải là tập thuật toán có giới hạn, chưa phải một hệ đại số máy tính tổng quát. Hệ cần tuyến tính theo x,y; bất phương trình xử lý trên ℝ đến bậc2; giải tích nhận đa thức theo x đến bậc6, mẫu chỉ là hằng số khác0.
- Cận tích phân nằm trong−100 đến100; số liệu quá nhỏ, quá lớn hoặc hệ gần suy biến bị từ chối để tránh kết luận bằng phép tính thiếu tin cậy. Số làm tròn có dấu≈; nguyên hàm giữ hệ số phân số khi thích hợp.
- Ôn câu sai và tiếp tục bài dùng dữ liệu của tài khoản trên thiết bị, chưa đồng bộ giữa thiết bị. Giữ tối đa500 lượt trả lời,120 câu sai và100 bài đã lưu.
- OCR vẫn phù hợp nhất với chữ in rõ. Cắt/xoay giúp chuẩn bị ảnh; người học cần xác nhận ký hiệu, số mũ và phân số đọc được.
- AI trực tuyến tiếp tục dùng cấu hình máy chủ hiện có. Bản nâng cấp không tự thêm khóa, không thay mô hình dùng chung và không gọi AI trả phí trong QA.

## Dữ liệu và triển khai

Schema dữ liệu tăng từ1 lên2, giữ namespace `hh.mathcore.v1:<owner>` để đọc và chuyển tiếp dữ liệu cũ. Codec mới nhận phiên bản1/2 và xuất phiên bản2. Phiên bản cũ có kiểm tra schema nghiêm ngặt nên sẽ bảo vệ bản dữ liệu mới thay vì ghi đè và làm mất phiên luyện/câu sai. Đã đối chiếu hành vi này bằng codec của commit trước.

Phiên luyện có ID riêng, ID câu hỏi có chủ đề/mức/seed. Các đáp án và câu hỏi được kiểm tra định dạng khi tải. Dữ liệu hỏng hoặc phiên bản tương lai tiếp tục có chế độ bảo toàn bản gốc. Khi localStorage không khả dụng, ứng dụng nói rõ và cho phép xuất dữ liệu của phiên đang mở.

Module mới:

- `hh-mathcore-engine.js`: thuật toán, gợi ý và lời giải có điều kiện.
- `hh-mathcore-practice.js`:42 kiểu bài nguyên bản, lựa chọn phân biệt về giá trị và seed tái lập.
- `hh-mathcore-image.js`: chuyển vùng chọn sang điểm ảnh gốc, cắt/xoay Canvas không tải URL ảnh bên ngoài.

Core, content, UI và CSS tăng lên asset v2; engine/practice/image v1. Cache1073, loader734; shell script300 giữ nguyên vì không thay router.

## Kiểm thử

**596 kiểm thử qua,0 lỗi,0 bỏ qua**: Learning130, All Tools241, Security107, nhóm MATHCORE/HH CORE/Law/University/Platform Home118. Trong đó MATHCORE có35 bài kiểm thử.

Các phép kiểm tra độc lập gồm121 hệ phương trình với nghiệm biết trước, tập nghiệm bất phương trình trên lưới số qua nhiều dấu/hệ số, đạo hàm/tích phân đối chiếu,7350 câu từ42 kiểu bài so với công thức/thử nghiệm độc lập và6300 câu kiểm tra lựa chọn phân biệt/tái lập. Có các trường hợp nghiệm kép, vô nghiệm/vô số nghiệm,0^0, mẫu chứa ẩn, dữ liệu cực nhỏ, cận đảo và schema tương lai.

Chromium thật chạy **17 nhóm thao tác**,16 theme,40 trạng thái giao diện, **1326 phép đo tương phản**,0 tràn ngang và0 page error. Đã thử375/768/1440px, zoom200%, lưu/tải lại phiên, ôn và giải quyết câu sai, mở lời giải lưu, xoay/cắt/hoàn tác ảnh, kéo chọn vùng ở375px và OCR Tesseract thật sau khi cắt. DB/tài khoản/provider AI là fixture được ghi rõ; mã UI, handler, worker và ảnh bài thử thực sự chạy.

Kết quả và ảnh: [QA1073](./mathcore-qa-1073/results.json), [đo giao diện](./mathcore-qa-1073/readability.json). Kiến trúc và nguồn tham khảo của phần nền: [bàn giao1072](./MATHCORE_AI_1072.md).
