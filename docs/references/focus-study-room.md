# Phòng học tập trung — nguồn tham khảo

Ngày khảo sát: 2026-09-07.

Tính năng này được viết mới cho HH Platform. Không sao chép mã nguồn, giao diện, thương hiệu, hình ảnh hoặc âm thanh của các dự án dưới đây.

## Nguồn sản phẩm

- [LifeAt](https://lifeat.io/) — tham khảo nguyên tắc gom không gian thư giãn, timer, việc cần làm và ghi chú vào một workspace tập trung. LifeAt là sản phẩm thương mại; HH chỉ học cách tổ chức tác vụ, không dùng tài sản của họ.

## Nguồn GitHub

- [Moodist](https://github.com/remvze/moodist) — MIT. Tham khảo cách phối nhiều lớp âm thanh, preset, Pomodoro, todo và notepad trong một trải nghiệm local-first. Không lấy các tệp âm thanh bên thứ ba vì mỗi tệp có thể có giấy phép riêng.
- [Focus](https://github.com/ayoisaiah/focus) — MIT. Tham khảo chu kỳ tập trung/nghỉ có thể tùy chỉnh, thao tác tạm dừng/bỏ qua và thống kê theo lịch sử phiên.
- [Meow](https://github.com/sajdakabir/meow) — MIT. Tham khảo nhắc mắt 20–20–20, ghi chú nhanh và lịch sử phiên lưu trên thiết bị.
- [Ashdeck](https://github.com/ashdeck/ashdeck) — AGPL-3.0. Chỉ tham khảo phạm vi sản phẩm (Pomodoro, task, soundscape); không sao chép mã để tránh đưa nghĩa vụ AGPL vào repository hiện tại.

## Phần được áp dụng

- Một workspace thống nhất gồm timer, mục tiêu học, task, ghi chú, âm thanh và lịch sử.
- Timer dựa trên timestamp để giữ đúng thời gian khi reload/chuyển route.
- Chỉ tính thống kê từ phiên đã chạy hết; không sinh dữ liệu mẫu hoặc số liệu giả.
- Âm thanh mưa, nhiễu nâu và không khí quán cà phê được tạo bằng Web Audio ngay trên thiết bị, không dùng tệp âm thanh bên ngoài và không tự phát.
- Dữ liệu được lưu theo tài khoản bằng khóa `hh.focus.study-room.v1:<owner>`.
- Animation dừng/giảm theo lựa chọn người dùng và `prefers-reduced-motion`; timer không chạy render loop khi tab ẩn.
