# HH Feature Universe — Release 1010

## Phạm vi

Trang đăng nhập giờ dùng cùng registry điều hướng thật của HH Platform để dựng HH Feature Universe. Ở trạng thái repository hiện tại, registry công khai có 348 chức năng thuộc 7 hệ; con số này được tính khi chạy, không được viết cứng. Nhóm và route Admin bị loại khỏi bề mặt chưa đăng nhập.

## Thay đổi chính

- Bản đồ tổng quan có 7 hành tinh hệ; chọn một hệ để xem các hành tinh chức năng thật.
- Mỗi trang chỉ dựng tối đa 18 hành tinh WebGL. Tìm kiếm, danh sách và phân trang vẫn cho phép truy cập toàn bộ registry.
- Màu, vật liệu, kích thước, độ nghiêng và tốc độ quay được tạo ổn định từ khóa chức năng, giúp các hành tinh khác nhau mà không đổi ngẫu nhiên sau khi tải lại.
- Inspector dùng tên, mô tả và route thật. Chọn chức năng trước đăng nhập lưu một route chờ đã được xác thực; đăng nhập hoặc chế độ khách tiếp tục đúng workspace trong App Shell hiện có.
- Bản đồ hỗ trợ chuột, cảm ứng, focus, phím mũi tên, Home, End và Escape. Có fallback CSS khi WebGL hoặc thiết bị không phù hợp.
- Runtime giữ đúng một `WebGLRenderer`, rebuild khi trang hành tinh đổi và giải phóng renderer, texture, animation frame, observer cùng listener khi cổng đăng nhập đóng.
- Mobile 375px dùng carousel hành tinh nhẹ. Danh sách 348 chức năng mở thành panel toàn màn hình có vùng cuộn riêng. Tablet 761–1100px xếp bản đồ phía trên form để cả điều hướng và đăng nhập đều bấm được.
- Các lớp quang học, tinh vân, aurora và bụi quỹ đạo đều là procedural CSS/Three.js, không chặn tương tác và tôn trọng reduced motion.

## Dữ liệu, quyền riêng tư và tương thích

- Không đưa mật khẩu, token, khóa API, trạng thái tài khoản hoặc dữ liệu riêng tư vào hành tinh.
- Không cho phép route ngoài website, route không có trong registry hoặc route Admin làm điểm đến sau đăng nhập.
- Không tạo localStorage mới. Route chờ dùng khóa phiên `hh.auth.pending-route` và bị tiêu thụ sau khi xác thực.
- `/platform`, đăng nhập, chế độ khách, OAuth resume, App Shell và các route cũ được giữ nguyên.

## Kiểm thử

- Syntax: `node --check` thành công cho `auth-h-galaxy.js`, `auth-living-galaxy-3d.js`, `auth-platform.js`, `auth-neon-gateway.js`, `script.js` và `sw.js`.
- Contract test tập trung: 124/124 đạt, gồm registry, auth, điều hướng, một renderer, cache/release consistency và các workspace liên quan.
- Browser QA tại 1280×720, 768×800 và 375×812: không overflow ngang; desktop/tablet có đúng một canvas và một lớp optics; mobile có carousel fallback, không canvas; chuyển breakpoint giữ đủ 7 hành tinh.
- Bố cục tương đương zoom 200% được kiểm tra tại viewport CSS 640×360: không overflow ngang, tìm kiếm/danh sách vẫn hiện và cổng đăng nhập có một vùng cuộn dọc khả dụng.
- Danh sách được xác nhận chứa đủ 348 mục; mobile có panel cao 763px và vùng nội dung cuộn; tablet dùng hai cột.
- Tìm `Text on Image Studio`, chọn hành tinh, tiếp tục bằng khách, mở workspace, quay lại và route trong App Shell đã được kiểm tra. Khi rời cổng đăng nhập, canvas và optics đều được dọn về 0.
- Console không có cảnh báo hoặc lỗi mới trong vòng responsive cuối.

Repository không có script lint, typecheck hoặc build tổng quát; vì vậy release này chỉ ghi nhận syntax check và các contract test thực sự đã chạy.

## Nguồn và giấy phép

- Không tải hoặc sao chép mã, ảnh, texture, mô hình hay âm thanh bên ngoài cho release này.
- Hiệu ứng hình ảnh mới được tạo trong repository bằng CSS và vật liệu procedural.
- Renderer dùng bản Three.js đã có sẵn trong dự án; giấy phép đi kèm tại `vendor/THREE-LICENSE.txt`.
