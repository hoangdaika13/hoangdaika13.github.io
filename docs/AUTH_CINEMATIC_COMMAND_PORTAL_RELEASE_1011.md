# HH Cinematic Command Portal — Release 1011

## Phạm vi

Release 1011 nâng HH Feature Universe ở trang đăng nhập thành một cổng điều hướng 3D có thể thao tác, vẫn lấy dữ liệu trực tiếp từ registry công khai của HH Platform. Tại thời điểm kiểm thử, registry cung cấp 348 chức năng thuộc 7 hệ; route Admin tiếp tục bị loại khỏi bề mặt chưa đăng nhập.

## Nâng cấp chính

- Thanh điều khiển mới cho phép chọn trực tiếp ba mức chất lượng: Điện ảnh, Cân bằng và Tĩnh. Việc đổi mức chất lượng rebuild scene theo đúng ngân sách render nhưng luôn giữ đúng một WebGL renderer.
- Parallax được điều khiển độc lập với mức chất lượng và được lưu bằng khóa `hh.auth.parallax.v1`. Chế độ giảm chuyển động của hệ điều hành vẫn được ưu tiên.
- Camera vũ trụ hỗ trợ kéo để đổi góc nhìn, cuộn để zoom và nút Căn giữa. Góc quay và zoom được chặn trong biên an toàn để không làm mất hành tinh hoặc vùng đăng nhập.
- Scene Điện ảnh có thêm hố đen xa, thấu kính hấp dẫn, vệ tinh, bụi quỹ đạo và vành Sao Thổ nhiều lớp; tất cả được tạo procedural bằng Three.js/CSS, không thêm canvas thứ hai.
- Hành tinh đang được chọn giảm tốc quỹ đạo, camera hướng nhẹ về mục tiêu và inspector vẫn đứng yên để đọc/bấm chính xác.
- Khi chọn chức năng con, form đăng nhập hiển thị thẻ điểm đến với hệ, tên và route thật. Người dùng có thể xóa điểm đến; đăng nhập/khách sau đó trở lại Trang chủ HH Platform.
- Nút Gần đây chỉ xuất hiện khi kho `hh.app-shell.recent` có route thật khớp registry. Không dựng lịch sử hoặc số liệu mẫu.
- Nhãn trạng thái WebGL phản ánh đúng `3D CINEMATIC`, `3D BALANCED` hoặc `3D STATIC` sau mỗi lần đổi chất lượng.

## Dữ liệu, vòng đời và khả năng truy cập

- Chỉ đọc danh sách gần đây và route chờ không nhạy cảm; runtime Galaxy không lưu mật khẩu, token hay khóa API.
- Camera, parallax và chất lượng đều có trạng thái bàn phím/ARIA rõ ràng. Tìm kiếm, danh sách, phân trang và điều hướng hành tinh bằng phím tiếp tục hoạt động.
- Renderer, camera surface, animation frame, observer, listener, texture và geometry được dọn khi cổng đăng nhập đóng.
- Mobile 375px dùng carousel CSS và không dựng WebGL. Tablet có một vùng cuộn dọc cho form; không tạo hai thanh cuộn hoặc overflow ngang.

## Bằng chứng kiểm thử

- `node --check` đạt cho các runtime xác thực, Galaxy 3D và service worker liên quan.
- Bộ contract/regression tập trung: 126/126 bài đạt, gồm auth, registry, route resume, App Shell, one-renderer, release/cache consistency và các workspace liên quan.
- Browser QA ở 1280×800: một canvas, một camera surface, 0px overflow ngang; Điện ảnh/Cân bằng/Tĩnh rebuild đúng và không nhân renderer.
- Kéo camera thay đổi telemetry trong biên (`yaw -0.325`, `pitch 0.115` ở lần kiểm thử); cuộn thay đổi zoom từ `1.000` thành `1.065`; Căn giữa trả cả ba giá trị về `0.000 / 0.000 / 1.000`.
- Tablet 768×800: một canvas, vùng đăng nhập cuộn từ 0 tới 253px, không overflow ngang.
- Mobile 375×812: 0 canvas, carousel rộng 536px trong khung 365px có scroll-snap, toàn trang vẫn 0px overflow ngang.
- Bố cục tương đương zoom 200% tại viewport CSS 640×400: form cuộn đủ 441px tới cuối, 0px overflow ngang.
- Đã kiểm thử tìm kiếm, danh sách thật, chọn/xóa điểm đến, vào HH Galaxy bằng chế độ khách, Forward khôi phục workspace, quay về `/platform` và dọn canvas/camera surface về 0.
- Console không ghi nhận warning hoặc error trong vòng QA.

Repository không có script lint, typecheck hoặc build tổng quát; release chỉ ghi nhận những kiểm tra thực sự đã chạy.

## Nguồn và giấy phép

- Không tải hoặc sao chép mã, ảnh, texture, mô hình, nhạc hay âm thanh bên ngoài cho release này.
- Toàn bộ chi tiết mới được tạo procedural từ code trong repository.
- Renderer tiếp tục dùng Three.js đã có sẵn; giấy phép nằm tại `vendor/THREE-LICENSE.txt`.
