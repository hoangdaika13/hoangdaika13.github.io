# Draw Studio layout v1 — QA report

Ngày kiểm tra: 2026-08-28

Route: `#/draw`

Module: `HHDrawStudio 2.2.0`

## Phạm vi nâng cấp

- Giữ nguyên engine canvas, 46 brush preset, layer, selection, animation, IndexedDB, undo/redo và export hiện có.
- Tổ chức lại workspace thành tool rail, canvas trung tâm, inspector và dock điều hướng nhanh.
- Thêm trạng thái dự án, nút lưu thật, nút đặt lại bố cục và lưu lựa chọn bố cục theo người dùng.
- Cho phép thu gọn/mở tool rail, inspector và dock mà không dựng lại toàn bộ workspace.
- Thêm điều hướng trực tiếp đến Layer, Brush, Màu, Canvas và Xuất bản.
- Sửa phím tắt để không kích hoạt khi nhập trong `input`, `textarea`, `select` hoặc `contenteditable`.
- `Ctrl/Cmd + S` lưu project; `0` vừa khung; `1` trở về 100%; giữ zoom và canvas ổn định khi panel đổi kích thước.
- Mobile dùng thanh công cụ dưới, dock compact và inspector dạng bottom sheet có cuộn nội bộ.

Không có chức năng, dữ liệu, hiệu ứng hoặc tệp nào bị loại bỏ.

## Kiểm thử tự động

- `node --check draw-studio.js`
- `node --check performance-loader.js`
- `node --check sw.js`
- `node --test tests/draw-studio.test.js`: 14/14 đạt
- `node --test`: xem kết quả tổng thể trong báo cáo commit.
- `git diff --check`

## QA trình duyệt

### Desktop — 1440 × 900

- Studio: 1132 × 812 px.
- Tool rail: 78 px; inspector: 320 px; canvas stage: 732 × 738 px.
- Không tràn ngang.
- Thu gọn inspector làm canvas stage tăng từ 732 px lên 1052 px.
- Trạng thái thu gọn tồn tại sau khi tải lại.
- Inspector cuộn nội bộ; điều hướng Màu đưa vùng cần dùng vào viewport.
- Gõ `e` trong ô tìm brush không đổi sang công cụ tẩy.
- Trạng thái lưu hiển thị “Đã tự lưu”; zoom `0` trả về 100%.

### Mobile — 390 × 844

- Không tràn ngang.
- Workspace kết thúc trước thanh điều hướng ứng dụng; tool rail và dock không bị che.
- Tool rail có bốn công cụ chính với vùng chạm đủ lớn.
- Inspector mở từ dock thành bottom sheet, nằm trên thanh điều hướng ứng dụng.
- Inspector có `scrollHeight 4639 px`, `clientHeight 656 px` và cuộn đến nhóm Màu ở `scrollTop 2573 px`.
- Chọn công cụ Tẩy đồng bộ đúng trạng thái ở canvas và thanh công cụ.
- Không có lỗi hoặc cảnh báo console trong phiên QA cuối.

## Bằng chứng

- `before-desktop.png`
- `before-mobile.png`
- `after-desktop.png`
- `after-mobile.png`

## Giới hạn đã xác minh trung thực

- Phiên này tập trung vào P0 về bố cục, cuộn, responsive, trạng thái workspace và phím tắt; không viết lại engine đã hoạt động.
- Chưa thực hiện phiên vẽ liên tục 10 phút, kiểm thử stylus vật lý hoặc benchmark GPU/FPS chuyên sâu trong môi trường thiết bị thật.
- Các nhóm công cụ chưa có engine riêng vẫn giữ nguyên trạng thái hiện hành; không tạo nút giả và không tuyên bố đã hoàn thiện chức năng chưa được kiểm thử.
