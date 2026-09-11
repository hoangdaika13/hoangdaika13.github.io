# HH Platform Home — Orbital Navigator v1009

## Phạm vi

- `/platform` tiếp tục là Trang chủ canonical và chạy trong App Shell hiện có.
- HH Galaxy vẫn là một mục lớn của HH Platform; release không tạo gateway hay lớp giao diện thứ hai.
- Search, bộ lọc, yêu thích, ghim, gần đây, route, auth và quyền Admin tiếp tục dùng registry cùng account scope hiện có.

## Nâng cấp

- Orbital Navigator bám trong vùng cuộn, liên kết bốn phần Command Center, danh mục, lộ trình và dữ liệu; thanh tiến độ phản ánh vị trí cuộn thật.
- `aria-current="location"` được đồng bộ sau khi layout sẵn sàng và khi cuộn/đổi kích thước, tránh chọn nhầm mục trong lần render đầu.
- Sáu hành tinh danh mục có preview tương tác: icon, màu, tên nhóm, số chức năng và ba workspace đầu đều lấy từ registry thật.
- Arrow Left/Right/Up/Down, Home và End di chuyển focus giữa các hành tinh; click vẫn lọc đúng nhóm và đưa tới catalog.
- Scene hiện có được bổ sung aurora, bụi quỹ đạo và thấu kính hấp dẫn bằng CSS procedural, không thêm canvas hoặc render loop.
- Chế độ economy/mobile loại bỏ các lớp nặng; pause, `prefers-reduced-motion`, tab ẩn và lifecycle cleanup tiếp tục dùng owner WebGL hiện có.

## Cache và tương thích

- Cache active: `hh-identity-portal-v1009`, có marker tương thích liền trước `v1008`.
- Loader: `performance-loader.js?v=671`.
- Platform Home: CSS v9, JS v10.
- Cosmos Motion: CSS v5, JS v3.

## Nguồn và giấy phép

Không có mã, ảnh, texture, shader hay tài nguyên bên thứ ba được tải hoặc sao chép trong release này. Các lớp ánh sáng mới là CSS procedural viết riêng cho repository nên không phát sinh attribution mới.

## Bằng chứng kiểm thử

- Syntax check đạt cho Platform Home, Cosmos Motion, loader và service worker.
- Nhóm test Platform Home, scroll, Cosmos Motion, stable layout, Galaxy Shell, navigation, runtime boundary, cache và release consistency đạt `52/52`.
- QA trình duyệt sạch xác nhận đúng loader v671 và Platform Home JS v10.
- Desktop `1280x720`: không overflow ngang ở document hoặc vùng cuộn, một canvas hiển thị, ba lớp chiều sâu mới hoạt động và navigator khởi tạo ở Command Center.
- Mobile hẹp `319x862` (khắt khe hơn mốc 375px): không overflow ngang; hero, CTA, bản đồ, catalog và navigator vẫn cuộn/dùng được.
- Planet preview và phím mũi tên cập nhật đúng `Web & Cộng đồng` cùng các workspace `Google · YouTube · Discord`; Home/End đi đúng hành tinh đầu/cuối.
- Click hành tinh Học tập lọc đúng sáu mục registry. Navigator tới đúng catalog, privacy và tiến độ cuộn đạt `100.00%` ở đáy.
- Pause/resume đổi đúng `aria-pressed`, nhãn truy cập và trạng thái scene. Mở `/learn` unmount Trang chủ/canvas; Back/Forward khôi phục `/platform`, bộ lọc account-scoped và một canvas duy nhất.
- Console của phiên QA sạch không ghi nhận lỗi mới.

Repository không khai báo script lint, typecheck hoặc build tổng quát trong `package.json`; vì vậy release chỉ báo cáo các kiểm tra thực sự có thể chạy ở trên.
