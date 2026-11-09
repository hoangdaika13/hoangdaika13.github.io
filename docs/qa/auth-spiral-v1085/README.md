# Trang đăng nhập thiên hà trên hoang8.com

Bản v1085, kiểm thử ngày 09/11/2026.

[Ảnh đăng nhập trên máy tính](desktop-login.png) · [Bản đồ trên điện thoại 375 px](mobile-orbits.png) · [Thẻ Sao Thổ trên điện thoại](mobile-saturn.png) · [Video thao tác trực tiếp, 25 giây](kham-pha-sao-tho.mp4)

## Kết quả

| Tình huống | Đã xác nhận |
| --- | --- |
| Chuột và bàn phím | Kéo xoay, di chuyển tâm, thu phóng, giãn toàn thiên hà hoặc riêng một hệ. Thả chuột sau khi kéo vẫn giữ bản đồ. Enter mở thẻ và Esc đưa tiêu điểm về hành tinh. |
| Chọn hành tinh | Bấm trực tiếp cả tám hành tinh Hệ Mặt Trời sau khi giãn tối đa và căn vừa hệ. Đã mở đủ bảy hành tinh TRAPPIST-1 trên desktop. Tên, ảnh, ba số đo và nguồn khớp với mục đã chọn. |
| Điện thoại | Chromium ở 375 × 812 CSS px nhận vuốt, chụm hai ngón và chạm từng hành tinh. Thẻ mở từ dưới. Nút **Về đăng nhập** thu gọn cảnh và đưa tiêu điểm tới ô còn thiếu, hoặc tới nút gửi khi đã điền đủ. |
| Phóng đại | Chrome ở mức thu phóng thực 200%, vùng hiển thị 712 × 402 CSS px. Có thể cuộn tới nguồn, đóng thẻ, trở về toàn cảnh và vào bằng chế độ khách. Trang và thẻ đều vừa chiều ngang. |
| Giảm chuyển động và ảnh tĩnh | Vẫn xoay, giãn, chọn hành tinh bằng bản đồ hoặc danh sách, đọc thẻ và tiếp tục đăng nhập. Kiểm tra mất và khôi phục WebGL, giải phóng ngữ cảnh GPU sau khi vào trang, thử lại khi tải dữ liệu lỗi. |
| Biểu mẫu và điều hướng | Dữ liệu đã nhập giữ nguyên sau khi xem hành tinh. Đã thử đăng nhập email, đăng ký, xác minh email, khôi phục mật khẩu, lối Google, chế độ khách và bản đồ 25 lĩnh vực **Khám phá HH**. |

174 kiểm thử tự động về đăng nhập, bảo mật, bản đồ và vỏ ứng dụng đã đạt. 15 kiểm thử dịch vụ thời gian thực đã đạt. Cả hai cây phụ thuộc production đều vượt qua `npm audit --omit=dev`.

Có thể chạy lại các kiểm thử của bản đồ bằng `npm run test:auth`. Để chạy chuỗi thao tác trên Chromium, khởi động máy chủ phát triển rồi chạy `npm run qa:auth-spiral` với Playwright. `HH_QA_BASE_URL` chọn địa chỉ máy chủ. `HH_QA_PLAYWRIGHT` và `HH_QA_CHROMIUM` cho phép dùng bản cài sẵn.

## Dữ liệu và phạm vi

Khoảng cách, kích thước và tốc độ trên bản đồ được điều chỉnh để các quỹ đạo dễ phân biệt. Mỗi thẻ dẫn tới hồ sơ NASA của hành tinh và nguồn số liệu. Hình TRAPPIST-1 là tranh minh họa. [NASA Solar System](https://science.nasa.gov/solar-system/planets/) · [JPL Planetary Physical Parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) · [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/overview/TRAPPIST-1)

Các luồng cần tài khoản, OTP hoặc chuyển hướng Google dùng máy chủ kiểm thử và phản hồi mô phỏng. Phần kiểm tra điện thoại dùng cảm ứng giả lập trong Chromium. Ảnh và video do trình duyệt ghi trực tiếp.
