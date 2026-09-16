# HH Login — Solar Secret Galaxy Resonance v4

## Phạm vi

Release v1018 chỉ mở rộng easter egg **Đừng bấm** và phản ứng hình ảnh tạm thời của 25 hành tinh đăng nhập. Form đăng nhập, route, auth flow, khóa dữ liệu, nội dung và hành động thật của hành tinh không thay đổi.

## Kiến trúc

- `auth-solar-secret.js` phát ba event cục bộ trên bề mặt Galaxy: `hh:solar-resonance-stage`, `hh:solar-resonance-preview` và `hh:solar-resonance-reset`.
- `auth-living-galaxy-3d.js` là chủ sở hữu duy nhất của renderer WebGL và render loop. Không có canvas hoặc WebGL context mới.
- Mỗi hành tinh phản ứng từ dữ liệu thật đang có: thứ tự khoảng cách, trọng lượng, tốc độ quỹ đạo, màu và mức hiệu năng.
- CSS chỉ cung cấp lớp trang trí không bắt sự kiện và fallback ánh sáng cho mobile/WebGL không khả dụng. CSS không ghi đè transform định vị hành tinh.

## Phản ứng theo hành trình

- Stage 01–05: corona, sóng vàng, rung mềm, nhật thực tuần tự và phản xạ plasma đỏ ở vành ngoài.
- Stage 06–10: hãm quỹ đạo, flyby UFO, đảo chiều theo vòng, glitch viền ngắn và plasma ba nhóm màu.
- Stage 11–15: nạp tia năng lượng theo thao tác giữ, mưa sao băng bằng hệ thống hạt có sẵn, scan hologram, bụi sao gần và xung hấp dẫn theo khoảng cách/trọng lượng.
- Stage 16–17: ba cụm chòm sao và phản hồi puzzle theo số vị trí đúng; tự giải dùng chuyển cảnh ngắn.
- Stage 18: hover/focus chỉ xem trước năm nhánh, không ghi tiến trình hoặc mở khóa.
- Stage 19–20: mỗi kết thúc có color grade, tốc độ, khí quyển và quỹ đạo riêng; tổng kết giữ afterglow nhẹ.

## Bảo toàn trạng thái

Controller chụp trạng thái lựa chọn, focus, motion/performance và các biến CSS tạm trước khi mở. Đóng, reset, đăng nhập thành công hoặc rời trang sẽ phát reset, xóa class/data tạm và khôi phục giá trị style trước đó. Controller không gọi API lựa chọn hành tinh, không sửa `aria-selected`, `tabindex`, route hoặc dữ liệu nguồn.

## Hiệu năng và truy cập

- Điện ảnh dùng đầy đủ ánh sáng, plasma và mưa sao băng có giới hạn.
- Cân bằng giảm biên độ nghiêng/dịch và số hạt.
- Tĩnh/reduced motion giữ phản hồi màu, bỏ dịch chuyển và hoạt ảnh mạnh.
- Mobile dùng CSS fallback ánh sáng cho các hành tinh nhìn thấy; panel vẫn là bottom sheet và không tạo overflow ngang.
- Forced colors ẩn trang trí nhưng giữ nguyên control/focus.

## Nguồn và giấy phép

Không thêm mã, hình ảnh, âm thanh hoặc tài nguyên bên ngoài. Toàn bộ hiệu ứng dùng shader, geometry, particle, CSS và Web Audio thủ tục đã có trong repository.
