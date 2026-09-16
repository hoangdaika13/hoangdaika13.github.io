# HH Solar Secret v3

Solar Secret là easter egg cục bộ tại trung tâm mặt trời trên trang đăng nhập HH Galaxy. Bản phát hành này chỉ thay đổi lớp Solar Secret; form đăng nhập, 25 hành tinh, WebGL Galaxy, route và luồng xác thực được giữ nguyên.

## Hành trình bí mật

- Hai mươi stage liên tục: phản hồi con trỏ, rung mềm, nút chạy trốn, nhật thực, cảnh báo vui, xác nhận inline, UFO, đảo quỹ đạo, glitch, plasma, giữ để nạp, sao băng, hologram, bụi sao, xung năng lượng, ba biểu tượng, puzzle, chọn nhánh, kết thúc và tổng kết.
- Mini puzzle có ba quỹ đạo và ba biểu tượng Mặt trời, UFO, Cổng. Người dùng có thể kéo thả, chạm, dùng phím mũi tên hoặc chọn “Giải tự động”. Puzzle không giới hạn thời gian và chỉ mở bước tiếp theo khi đạt đúng trạng thái.
- Năm kết thúc thật: Cổng bí mật, Người giữ quỹ đạo, Tín hiệu UFO, Mặt trời ngủ và Hợp nhất tín hiệu. Nhánh Hợp nhất chỉ mở sau khi bốn nhánh đầu đã được khám phá.
- Nhật ký Mặt trời hiển thị stage cao nhất, kết thúc, số lần chơi lại, thời điểm gần nhất và huy hiệu đã mở khóa.

## Dữ liệu và quyền riêng tư

- Chỉ khóa `hh.solar-secret.progress.v3` được dùng cho stage cao nhất, danh sách kết thúc, huy hiệu, số lần chơi lại và thời điểm khám phá. Dữ liệu v2 được đọc một lần để duy trì thành tích cũ.
- Khi bộ nhớ cục bộ bị chặn, hành trình vẫn chơi được và Nhật ký hiển thị trạng thái chưa lưu.
- Không gọi API, không mở kết nối mạng và không thu thập dữ liệu từ form đăng nhập.

## Âm thanh, hiệu năng và khả năng truy cập

- Âm thanh procedural mặc định tắt. Web Audio chỉ được tạo sau khi người dùng chủ động bật, có điều chỉnh âm lượng và được giải phóng khi đóng easter egg.
- Animation/timer/âm thanh dừng khi tab bị ẩn. Listener, timer và audio node được dọn khi đóng, đăng nhập thành công hoặc `pagehide`.
- Có thao tác bàn phím, Escape trả focus về mặt trời, focus-visible, `aria-live`, fallback cho reduced motion, forced colors, tương phản cao, mobile 375px và zoom 200%.
- Không dùng thư viện, ảnh, âm thanh hay mã nguồn bên ngoài.

## Luồng kiểm thử chính

1. Mở mặt trời và đi qua stage 01–16 bằng click, Enter/Space, hover và giữ chuột.
2. Hoàn thành puzzle bằng chạm, phím mũi tên, kéo thả và nút giải tự động.
3. Khám phá bốn nhánh đầu, xác nhận nhánh Hợp nhất được mở, rồi hoàn thành stage 19–20.
4. Kiểm tra chơi lại, thử nhánh khác, dừng ở xác nhận, đóng bằng Escape và khôi phục Nhật ký sau reload.
5. Kiểm tra âm thanh luôn mặc định tắt, dừng khi tab ẩn và giải phóng khi đóng.
