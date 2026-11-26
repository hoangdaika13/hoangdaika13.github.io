# Giải Rubik v1088

Vào **Giải trí & Nội dung → Giải Rubik** hoặc mở `#/rubik`. Đường dẫn bài học và trường hợp hỗ trợ mở trực tiếp, kể cả sau khi chọn tiếp tục với tư cách khách.

| Khối hoặc câu đố | Bài có video nguồn | Video bài học MP4/VTT trên website | Trường hợp có cặp ảnh và MP4 | Mô phỏng |
|---|---:|---:|---:|---|
| 3×3 | 19 | 11 | 747 | 2D/3D, bộ giải |
| 2×2 | 3 | 0 | 133 | 2D/3D |
| 4×4 | 3 | 0 | 2 | 2D/3D |
| 5×5 | 1 | 0 | 1 | 2D/3D |
| 6×6 | 1 | 0 | 2 | 2D/3D |
| 7×7 | 1 | 0 | 2 | 2D/3D |
| Pyraminx | 1 | 0 | 6 | 2D/3D |
| Megaminx | 1 | 0 | 11 | 2D/3D |
| Skewb | 1 | 0 | 3 | 2D/3D |
| Square-1 | 1 | 0 | 5 | 2D |
| Mirror Cube | 1 | 0 | 0 | 2D/3D, viên thay đổi hình dạng |
| Clock | 1 | 0 | 4 | 2D |
| **Tổng** | **34** | **11** | **916** | |

Thư viện 3×3 có 6 ca cơ bản, 41 F2L, 10 ca 2-look OLL, 6 ca 2-look PLL, 57 OLL, 21 PLL, 40 COLL, 25 ELL, 42 CMLL, 27 Winter Variation và 472 ZBLL. ZBLL đếm các trường hợp góc chưa đúng hướng. 21 ca góc đã đúng hướng nằm trong PLL. Thư viện 2×2 có 7 Ortega OLL, 6 PBL và 40 ca cho mỗi bộ CLL, EG-1, EG-2. Phần **Tiến trình → Độ phủ nội dung** đọc lại dữ liệu thực tế của từng bộ.

916 clip công thức được sinh từ trạng thái mô hình tương ứng. Hình của khối thường dựng từ trạng thái khi mở trang. 29 ca đặc thù có hình WebP riêng đã đối chiếu với trạng thái mô hình. 11 clip bài học có phụ đề tiếng Việt, gồm cách đọc ký hiệu, các bước cơ bản và ba ví dụ 3×3 có trạng thái xáo khác nhau. Cảnh quay tay thật dùng video của tác giả qua trình phát nhúng. Các bài vẫn có nội dung tiếng Việt và bước đọc khi nguồn ngoài không phát.

Các ca 4×4–7×7, Pyraminx, Megaminx, Skewb, Square-1 và Clock hiện tập trung vào các tình huống đã xuất bản trong bảng. Mirror Cube có bài học và mô phỏng riêng, thư viện chưa có bộ công thức riêng. Luyện nhận diện, ghi nhớ và tự giải ca trên mô hình áp dụng cho các bộ khối lập phương đã có dữ liệu. Bộ giải nhập màu và chuỗi xáo hỗ trợ 3×3. Tiến trình lưu trên thiết bị theo tài khoản hoặc chế độ khách.

## Kiểm tra

- `npm run test:rubik` kiểm tra số lượng và tính phân biệt của các ca CFOP, bộ giải trạng thái hợp lệ, đầu vào sai, ảnh, clip, tiến trình, hình phạt và trung bình bấm giờ.
- Các kiểm thử shell, xác thực, bảo mật và đồng bộ phiên bản được chạy cùng bản phát hành.
- `npm run qa:rubik` dùng Playwright với `HH_QA_BASE_URL` và tùy chọn `HH_QA_CHROMIUM`. Luồng desktop và cảm ứng giả lập 375 px kiểm tra sidebar, bài học, MP4/VTT, thẻ công thức, đổi 2D/3D, bộ giải, luyện tập, bấm giờ và lưu khi tải lại.
- Chromium với zoom gốc 200% đã mở đúng bài từ link trực tiếp sau khi vào bằng khách. Khối 3×3 xáo hợp lệ được nhập qua đủ 54 ô rồi giải và đối chiếu. Square-1 đã được kiểm tra với hai ảnh và mô phỏng một lượt cắt.
