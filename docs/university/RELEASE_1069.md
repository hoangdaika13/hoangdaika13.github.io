# Đại học & Cao đẳng Việt Nam — bản 1069

Ngày 28/10/2026. Đại học được tách thành mục lớn độc lập ở sidebar, tại `/university`. Học tập giữ lớp 1–12. Bàn học đại học chuyển sang `/university/study`; URL cũ `/learn/university` chuyển tiếp và giữ nguyên tài khoản/hồ sơ, ID ghi chú, nháp và tiến độ của bản 1068.

## Chức năng

- Danh mục trường: tìm không dấu theo tên, mã và tên viết tắt; lọc bậc đào tạo và địa phương theo nguồn; phân trang 24 hồ sơ. Trường đã lưu được cách ly theo tài khoản trên thiết bị. Dữ liệu tương lai hoặc sai cấu trúc được bảo vệ, có tải bản gốc để phục hồi.
- Hồ sơ trường: nhóm ngành, các biến thể chương trình tuyển sinh, tài liệu/nguồn và năm xuất hiện. Tab Chương trình học hiển thị bảng học phần đã đọc được và hồ sơ chương trình trên cổng Bộ GD&ĐT.
- Điểm chuẩn: chọn 2020–2026, tìm ngành/mã/tổ hợp, lọc phương thức và thang điểm; giữ điều kiện phụ, ghi chú và nguồn. Tải CSV đúng dữ liệu đã lọc, giữ số thập phân và chống công thức bảng tính.
- Lịch sử bảy năm giữ riêng chương trình, phương thức, phương thức con, tổ hợp, thang điểm và đợt. Thiếu bản ghi là dấu trống; không tự quy đổi hay nối thành xu hướng.
- Các gói tải theo nhu cầu, kiểm tra SHA-256/byte, cache giới hạn và hủy fetch theo vòng đời. Service Worker hỗ trợ offline các gói đã truy cập. Bàn học cũ tiếp tục dùng IndexedDB và cơ chế đồng bộ HH School.

## Độ phủ và giới hạn

Có **959 hồ sơ**: 327 đại học/học viện/đơn vị và 632 cao đẳng/hệ cao đẳng theo danh mục nguồn. Danh sách có tên lịch sử và phân hiệu. Chưa có mẫu số quốc gia đã xác minh để khẳng định đây là toàn bộ trường đang hoạt động tại Việt Nam.

Có 12.337 nhóm mã ngành và 21.286 biến thể tên/mã chương trình tuyển sinh, ở 586 hồ sơ. Đây không phải 21.286 chương trình đào tạo duy nhất đang mở. Điểm có 119.621 bản ghi ở 309 trường, gồm 295 hồ sơ đại học và 14 hồ sơ cao đẳng; năm 2026 có 32.287 bản ghi ở 276 trường. [Bảng độ phủ](coverage-1069.md) và [ma trận từng trường](coverage-1069.json).

Nguồn tổng hợp gồm [Tuyensinh247](https://diemthi.tuyensinh247.com/danh-sach-truong-dai-hoc-cao-dang.html), [HOCMAI](https://huongnghiep.hocmai.vn/ma-truong) và [danh bạ Cao Đẳng](https://caodang.com.vn/danh-ba-truong): lần lượt 587, 529 và 414 mục trước đối chiếu. Thu thập đủ trang và kiểm tra API tôn trọng school_id/year. Không dùng nhãn 2026 trên trang để đổi năm dữ liệu cũ.

Nguồn chính thức bổ sung là [cổng kiểm định công khai Bộ GD&ĐT](https://kdcldh.moet.gov.vn/): đủ 346 hồ sơ kiểm định cơ sở và 1.829 hồ sơ chu kỳ chương trình qua 23 request phân trang. Sau nhóm ID có 224 cơ sở đối chiếu và 1.744 chương trình, thống kê riêng với tuyển sinh. Những chu kỳ lịch sử không chứng nhận tình trạng kiểm định hiện tại, bậc đào tạo hoặc điều kiện tuyển sinh. HEMIS/danh bạ quốc gia đầy đủ chưa truy cập được trong đợt này.

Hai chương trình UIT có bảng 85 mã học phần Kỹ thuật Phần mềm khóa 2025 và 91 mã Khoa học Dữ liệu khóa 2024, giữ tín chỉ từng dòng và nguồn trường. Chưa phân kỳ, xác nhận môn bắt buộc/tự chọn hoặc cộng tất cả mã thành tín chỉ tốt nghiệp. Các trường khác chưa có bảng học phần đầy đủ sẽ hiển thị rõ phần còn thiếu.

Đã loại Brighton College Vietnam (trường 3–18 tuổi) và một trường trung cấp khỏi phạm vi; sửa phân loại CĐ/College. Mã cao đẳng trùng như C21 không làm nhập nhằng Bắc Ninh và Điện Biên. Địa phương giữ theo nguồn, có thể còn tên trước sắp xếp hành chính. Có 117.970 bản ghi không ghi rõ thang điểm: giữ chưa xác định, không suy từ số điểm hoặc loại kỳ thi. Thiếu điểm không phải điểm 0 hay kết luận trường chưa công bố; cao đẳng có thể xét hồ sơ/điều kiện riêng.

Chỉ nhập metadata, số liệu, tên và liên kết; không phân phối lại bài báo, ảnh, PDF hoặc mã nguồn ngoài. [Audit request/checksum/đối chiếu](../../data/hh-university/source-audit.json), [pin nguồn Bộ](../../data/hh-university/official-reference.json), [quyết định biên tập](../../data/hh-university/curation.json).

## Pipeline và kiểm thử

`node scripts/import-hh-university.js --refresh` tạo candidate trong `.study-local/university-1069/candidate`, có cache, retry và giới hạn nguồn/dung lượng. `node scripts/import-hh-university-official.js --refresh` tạo pin tham chiếu Bộ để biên tập kiểm tra. Không tự công bố dữ liệu lấy về. Build bằng `node scripts/build-hh-university.js --candidate .study-local/university-1069/candidate`; kiểm tra mọi hash và tạo ma trận bằng `node scripts/report-hh-university.js`. Tùy chọn `--prune-generated` chỉ loại gói sinh ra không còn được tham chiếu trong thư mục trường/điểm; không xóa pin nguồn.

**500 test đạt, 0 lỗi, 0 bỏ qua**: Học tập 130, công cụ/shell 241, bảo mật đầy đủ 107, University/CORE gateway 22. Kiểm tra cú pháp và 2.862 gói dữ liệu khớp byte/SHA-256. Bộ Chromium full shell kiểm tra chọn trường/ngành/học phần, điểm 2020/2026, CSV, lịch sử, lưu/reload, cao đẳng, thiếu dữ liệu, URL cũ, giữ ghi chú, Service Worker/offline. Đủ 16 theme, 2.080 phép đo tương phản, 375/768/1440px, DPR2, zoom 200%, forced colors và keyboard focus; 0 page error. Đã sửa màu chữ nút ở ba theme sáng sau khi QA phát hiện tương phản thấp.

[Kết quả tổng hợp](qa-1069/report.json), [trình duyệt](qa-1069/results.json), [desktop](qa-1069/directory-desktop.png), [chương trình học](qa-1069/uit-curriculum.png), [điểm 2026](qa-1069/uit-scores-2026.png), [mobile](qa-1069/saved-375.png).

Version: release/cache 1069, loader 730, router 297, CORE gateway 10, HH School host 11, University assets 1. Không đổi schema hoặc ID tiến độ 1068. Deployment và luồng trên hoang8.com được xác minh sau push, báo kết quả trong chat. Lỗi CI audit dependency đã có từ bản trước; deploy thành công không có nghĩa mọi CI đều đạt.
