# HH University — khám phá trường và hồ sơ, release1082

Ngày 04/11/2026. Mở [Đại học & Cao đẳng](https://hoang8.com/#/university). Ba agent phụ trách ảnh, khám phá trường và hồ sơ; agent chính tích hợp, kiểm thử và phát hành. Các phần chuẩn bị còn dở trong workspace được hoàn thiện cùng bản này.

## Tìm trường

Thêm bộ lọc theo dữ liệu đã nhập: có chương trình, có điểm chuẩn, chưa có cả hai; trường có website và ảnh đã xác minh. Bộ lọc kết hợp với tên/mã/alias, bậc học, địa phương và trường đã lưu. Các số đếm lấy từ 959 hồ sơ: 586 có bản ghi chương trình, 309 có điểm, 373 chưa có cả chương trình lẫn điểm. Không suy ra trường không đào tạo hoặc không tuyển sinh từ phần dữ liệu còn thiếu.

Có sắp xếp tên/địa phương/số chương trình, dạng thẻ/danh sách, 24 hoặc 48 hồ sơ mỗi trang và nút đầu/cuối. URL giữ bộ lọc, cách sắp xếp, kiểu hiển thị, kích thước và trang; reload, quay lại từ hồ sơ và mở tìm kiếm đã lưu khôi phục đúng lựa chọn. Bản lưu cũ vẫn đọc được, các trường mở rộng chỉ thêm khi khác mặc định.

Trên điện thoại, bộ lọc và tìm kiếm đã lưu được thu gọn. Sửa lỗi các hàng tìm kiếm đã lưu bị lồng HTML khiến tên/nút Xóa chen vào nhau. Mỗi tìm kiếm có hàng và nút riêng, tên dài xuống dòng; xóa một mục vẫn giữ đúng các mục còn lại qua reload. Các thao tác đọc/lọc/đổi bố cục không thay đổi dữ liệu cá nhân.

## Hồ sơ trường

Khối Thông tin nhanh hiển thị số chương trình, bảng học phần, bản ghi điểm và nguồn từ đúng hồ sơ đã nhập. Có 7 nút năm 2020–2026, trạng thái sẵn có/thiếu dữ liệu và lối mở nhanh ngành/chương trình học/nguồn. Chuyển năm mở bảng điểm thật và trả focus về điều khiển thích hợp; các selector năm cũ vẫn giữ riêng.

Ví dụ kiểm tra trực tiếp UIT: 62 chương trình ghi nhận, 2 bảng chương trình học và 282 bản ghi điểm trong 7 năm. Hồ sơ cao đẳng thiếu dữ liệu giữ trạng thái chưa có bản ghi; không dùng điểm 0 để thay phần thiếu. Nguồn HTTPS hợp lệ được đối chiếu theo ID trường; không bổ sung học phí, xếp hạng hoặc kiểm định chưa có chứng cứ.

## Ảnh trường

Tăng từ 30 lên **57 hồ sơ có ảnh thật**, gồm 45 đại học/học viện và 12 cao đẳng; bổ sung 27 hồ sơ, trong đó 11 cao đẳng. Có 170 WebP, 12.973.012 byte. Giữ nguyên byte của 90 WebP đã phát hành trong1081. Ảnh mới có nguồn, tác giả, giấy phép và bằng chứng nhận diện; ảnh nguồn nhỏ có hai kích thước để tránh phóng lớn.

Đã xem contact sheet và các ảnh cần đối chiếu riêng. Loại một phối cảnh kiến trúc khỏi ảnh thật, thay ảnh chưa đủ thông tin tác giả hoặc chưa thể hiện khuôn viên rõ. Không có ảnh mồ côi ngoài manifest. [Báo cáo ảnh và bảng nguồn](RELEASE_1082_PHOTOS.md), [manifest](../../assets/university/campus-photos-v1.json), [baseline1081](campus-photo-baseline-1081.json).

## Kiểm chứng

- **619 kiểm thử đạt**, không lỗi/skip: 271 focused University/Multiverse/Law/MathCore/Platform/Gateway/Planet, 241 công cụ/shell, 107 security/auth. Bao gồm bộ lọc ghép, URL, sắp xếp/phân trang không sửa đầu vào, profile thực/missing, dữ liệu cá nhân, toàn bộ hash ảnh và native IndexedDB.
- Chromium thật full HH shell: **43 luồng**, **129 trạng thái**, **16 theme**, **6.389 mẫu tương phản**; không lỗi JavaScript, tràn ngang hoặc lỗi tương phản trong phạm vi audit. Có desktop1440/tablet768/mobile375, DPR2, zoom200%, bàn phím, focus, vùng chạm44px và reduced motion.
- Kiểm tra thực các bộ lọc/source/layout/48 mục/trang cuối, reload/back, lưu hai tìm kiếm và xóa riêng một mục; profile62/2/282 và chuyển năm/tab, phần thiếu của cao đẳng, nguồn và liên kết an toàn.
- Native campus QA thêm5luồng: ảnh qua loader thật, bộ lọc57 hồ sơ qua24+24+9, ảnh trang cuối, tác giả/giấy phép, lưu trường, 7 năm, mobile/zoom và khung thay thế khi HTTP404. Pillow giải mã đủ170 WebP; builder chạy lại giữ nguyên90file cũ và không sinh file mồ côi.
- Các luồng cũ về chương trình/điểm2020–2026, phân biệt phương thức/thang điểm, CSV, so sánh, nguyện vọng, tài chính, lịch, thời khóa biểu, bài tập, bản sao cloud/xung đột, future-version/quota và offline tiếp tục đạt. QA dùng handler thật với identity/DB bộ nhớ/Gemini fixture tường minh, không gọi AI trả phí hoặc ghi tài khoản production để thử.

Đây là QA có phạm vi, không phải chứng nhận WCAG toàn site. Ảnh chụp/log/profile local nằm trong `.study-local/hh-university-1082-final/`, `.study-local/hh-university-campus-1082-final/`, `.study-local/discovery-layout-1082/`; không commit dữ liệu riêng của trình duyệt.

## Tích hợp và giới hạn

Release/cache1082, loader743, router305. University main6/CSS5, discovery1, profile JS/CSS1, experience-core3, campus2; các URL trong Service Worker đồng bộ. Tải discovery sau core và trước experience-core, campus/profile trước main. Không precache toàn bộ ảnh; giữ lazy loading và ảnh responsive. Không đổi schema cá nhân, database, dependency hay lockfile.

Danh mục vẫn có959 hồ sơ tổng hợp, có thể gồm tên cũ/cơ sở/phân hiệu; chưa xác nhận toàn bộ đều đang hoạt động. Ảnh hiện phủ57/959 hồ sơ. Các khoảng trống dữ liệu ngành, học phần và năm điểm vẫn được trình bày rõ; bản này cải thiện tra cứu và hình ảnh, không tuyên bố đã bổ sung đủ nội dung cho mọi trường/ngành.

`npm audit --omit=dev` ngày04/11/2026 còn6 vấn đề có trước:5high/1low. Không công bố CI security xanh khi bước audit còn thất bại.

Chạy lại:

```powershell
node --test tests/hh-university*.test.js
# Đặt HH_QA_PLAYWRIGHT và HH_QA_CHROMIUM tới runtime đã cài.
$env:HH_QA_UNIVERSITY_WORKSPACE='1'
$env:HH_QA_UNIVERSITY_EXPERIENCE='1'
node scripts/qa-hh-university.js
node scripts/qa-hh-university-campus.js
```
