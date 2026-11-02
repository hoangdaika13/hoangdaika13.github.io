# HH Multiverse — ảnh thực tế, bản 1081

Thêm 50 ảnh chụp riêng biệt từ NASA Image and Video Library, gồm 35 ảnh thiên nhiên/Trái Đất và 15 ảnh cực quang, Mặt Trăng, Trái Đất từ không gian và hành trình phóng tàu. Giữ nguyên 24 tranh AI và 1.000 cảnh đồ họa trước đó.

Mỗi ảnh có ba bản WebP 320×180, 640×360 và 1280×720. Tổng 150 tệp: 5.297.840 byte. Ảnh được thu nhỏ và cắt khung 16:9 theo vị trí đã xem xét; không chỉnh sửa bằng AI, không ghép cảnh và không nâng kích thước nguồn thấp. Mỗi bản có SHA256, kích thước và số byte trong [manifest ảnh thực tế](../assets/multiverse/photos-manifest-v1.json).

## Nguồn và quyền sử dụng

Đã kiểm tra [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) và [tài liệu NASA Images API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) ngày 02/11/2026. NASA cho phép dùng nội dung của cơ quan cho mục đích thông tin theo các điều kiện công bố, cần ghi nhận nguồn và không ngụ ý NASA bảo trợ. Không coi mọi ảnh NASA đăng tải là CC0 hoặc tự động áp dụng cùng quyền cho nội dung bên thứ ba.

Bộ này chỉ chọn hồ sơ NASA/JSC và NASA/KSC. Trình đóng gói kiểm tra trường tác giả, nguồn và quyền trong metadata chính thức; loại nguồn ESA, Getty, Reuters hoặc thông báo bản quyền bên thứ ba chưa được xác minh. Không lấy ảnh minh họa, mô phỏng hay infographic. Mỗi ảnh giữ mã NASA, tên ảnh nguồn, tác giả hoặc đơn vị cung cấp đúng hồ sơ, ngày chụp, liên kết hồ sơ, ảnh nguồn, metadata và chính sách sử dụng. Không xuất bản ảnh nguồn cục bộ hoặc đường dẫn máy phát triển.

## Trải nghiệm

- Trang đầu có sáu ảnh thực tế tiêu biểu; bộ tranh tưởng tượng và ảnh thật có nhãn nguồn riêng.
- Phòng ảnh ưu tiên bộ ảnh thực tế mới, có bộ lọc riêng, nhóm Thiên nhiên/Vũ trụ và mười chủ đề ảnh.
- Tìm kiếm, phân trang, lưu yêu thích, xem ảnh lớn, điều hướng bàn phím và tải WebP tiếp tục dùng cơ chế hiện có.
- Trình xem hiển thị tác giả, nguồn NASA, chính sách sử dụng và việc cắt khung. Liên kết nguồn mở theo thao tác người dùng.
- Ảnh là tư liệu tham khảo; không thay ảnh thế giới theo giả định, không làm bằng chứng cho snapshot và không sửa dữ liệu mô phỏng.
- Ảnh tải từ tài nguyên cùng website theo nhu cầu; trình duyệt không tự truy vấn NASA khi vào module.

## Dựng lại và kiểm thử

Danh sách tuyển chọn: [scripts/multiverse-photo-sources.json](../scripts/multiverse-photo-sources.json). Chạy `python scripts/build-multiverse-photos.py` với Pillow sẵn có; script tải qua HTTPS từ danh sách máy chủ NASA giới hạn, dùng bộ đệm trong `.study-local/`, xuất WebP, manifest và `hh-multiverse-photos.js`. Không cần khóa API.

`tests/hh-multiverse-photos.test.js` kiểm tra 50 nguồn khác nhau, bản quyền/nguồn, toàn bộ 150 SHA256 và kích thước thật trong bitstream WebP, nhóm/lọc/tìm kiếm, URL giới hạn và attribution trong trình xem. Native Chromium QA có kiểm tra nhóm 35/15 ảnh, chủ đề, ghi nguồn, tải tệp và bố cục 375px. Ảnh liên hệ và ảnh gốc đã được xem để sửa crop trước khi đóng gói.
