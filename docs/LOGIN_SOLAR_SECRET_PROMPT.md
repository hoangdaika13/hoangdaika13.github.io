# Prompt nâng cấp HH Solar Secret

Bạn là Principal Product Designer, Senior Frontend Engineer và QA Engineer. Hãy nâng cấp **duy nhất** tương tác tại trung tâm mặt trời trên trang đăng nhập HH Galaxy của hoang8.com.

## Phạm vi bắt buộc

- HH Platform, HH Galaxy, form đăng nhập, route, planet và phân quyền phải giữ nguyên.
- Không thay đổi nội dung, bố cục hoặc hành vi của các chức năng khác.
- Tương tác phải là một lớp easter egg độc lập, không gửi dữ liệu, không gọi API và không phát âm thanh tự động.
- Hiệu ứng trang trí dùng `pointer-events: none`; chỉ hit-target, nút và các nút xác nhận nhận tương tác.
- Hỗ trợ bàn phím, focus-visible, `Escape`, mobile, forced-colors và `prefers-reduced-motion`.

## Kịch bản 12 stage

1. Click vùng trung tâm mặt trời để hiện nút **ĐỪNG BẤM**.
2. Lần bấm đầu: nút rung nhẹ.
3. Lần bấm thứ hai: nút chạy trốn một đoạn ngắn nhưng vẫn nằm trong vùng an toàn.
4. Lần bấm thứ ba: phủ sắc đỏ cảnh báo nhẹ, không che form đăng nhập.
5. Lần bấm thứ tư: hiện xác nhận inline “Bạn thực sự muốn tiếp tục?” với **Tiếp tục** và **Dừng lại**.
6. Sau khi xác nhận: UFO bay ngang vùng vũ trụ.
7. Đảo chiều quỹ đạo trang trí.
8. Tạo một nhịp nhiễu màu ngắn.
9. Mở dải plasma cầu vồng.
10. Phát một vụ nổ sao nhỏ, không gây chớp mạnh.
11. Hiện tín hiệu đã giải mã.
12. Mở cổng bí mật và thông báo đây chỉ là easter egg, không có phần thưởng hoặc dữ liệu ẩn.

## Gợi ý nâng cấp an toàn

- Dùng state machine cục bộ, trạng thái bắt đầu lại khi đóng panel hoặc reload.
- Không dùng `alert`, `prompt`, `confirm`, không khóa body và không tạo overlay vô hình.
- Với reduced motion, bỏ rung, chạy trốn, UFO và chớp màu nhưng vẫn cho phép hoàn thành bằng bàn phím.
- Khi đăng nhập thành công hoặc `pagehide`, dọn listener, lớp hiệu ứng và trạng thái cảnh báo.
- Kiểm thử click mặt trời → 12 stage → dừng → đóng → mở lại; kiểm tra form đăng nhập, Back/Forward, 375px, zoom 200%, console và overflow ngang.
