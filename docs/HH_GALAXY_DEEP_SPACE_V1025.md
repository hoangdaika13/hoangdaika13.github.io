# HH Galaxy — Deep Space v1025

## Phạm vi

Nâng tiếp đồ họa và điều khiển Galaxy từ `cf226e0` (v1024). Không đổi đăng nhập, Solar Secret, router, auth, quyền Admin, định dạng dữ liệu hoặc chức năng nghiệp vụ. HH Platform `/platform` vẫn là shell chính; Galaxy dùng các route hiện có `/home`, `/galaxy/*`.

## Thay đổi

- Trường sao dùng một point cloud: vị trí 3D có chiều sâu, nhiều sắc sao, kích thước/độ sáng khác nhau, halo giới hạn và biến thiên rất chậm. Không tạo thêm canvas hoặc vòng lặp.
- Tinh vân dùng shader nguyên bản trên các mặt phẳng trong suốt ở những vị trí 3D khác nhau. Có phối cảnh/che khuất, không phải mô phỏng khí thể tích bằng ray marching.
- Cùng một module môi trường được tái sử dụng trên bản đồ và cả 11 workspace, đổi bảng màu theo hệ hành tinh.
- Lọc chi tiết bề mặt theo kích thước điểm ảnh, giảm nhiễu ở hành tinh nhỏ, dải khí và vết băng; giảm nhiễu bump/specular.
- Gộp các quỹ đạo thành một draw call. Games dùng một InstancedMesh cho 14 khối đá; Settings dùng một InstancedMesh cho 8 module trạm. Giữ nguyên vị trí, hình dạng và vật liệu.
- Thêm “Đặt lại góc nhìn”, giữ nguyên hệ và hành tinh đang chọn. Vô hiệu hóa khi chưa có bản đồ khả dụng hoặc đang ở chế độ danh sách.
- Kéo trên canvas đưa focus vào vùng 3D đúng; bỏ qua pointerup không có pointerdown; rời con trỏ khi tạm dừng vẫn xóa highlight; không thay thế link inspector khi người dùng đang chuyển focus lên nó.
- Sửa việc tự hạ chất lượng tạo lịch RAF trùng. Lựa chọn chất lượng mới của người dùng có hiệu lực sau tự hạ; cập nhật không liên quan không tự nâng chất lượng trở lại.
- Context loss giải phóng pointer capture. Vẫn sử dụng cơ chế pause, hidden/offscreen, reduced motion, forced colors và cleanup hiện có.

## Ngân sách

| Mức | Sao tối đa | Tinh vân |
| --- | ---: | ---: |
| Tiết kiệm | 400 | 0 |
| Cân bằng | 1400 | 2 |
| Điện ảnh | 2400 | 3 |

Geometry/material được cấp phát khi mount và giải phóng bởi renderer sở hữu cảnh. Đổi mức chất lượng không cấp phát bộ sao/tinh vân mới. Số sao trên đây là giới hạn kỹ thuật, không phải số liệu người dùng.

## Đo trước/sau

Đo trực tiếp bằng WebGL trong fixture `tests/fixtures/galaxy-graphics-qa.html?still=1`, viewport 1280×720, host 1100×560, cùng góc nhìn và mức Cân bằng. Bản trước phục vụ từ Git `cf226e0` qua `scripts/galaxy-qa-baseline.py --ref cf226e0`; bản cuối dùng origin local mới để tránh cache cũ.

| Cảnh | Draw calls trước → sau | Geometry trước → sau |
| --- | ---: | ---: |
| Bản đồ | 66 → 54 | 18 → 14 |
| AI | 11 → 10 | 5 → 6 |
| Games | 24 → 10 | 4 → 5 |
| Settings | 18 → 10 | 5 → 6 |

Geometry thêm ở workspace là tấm tinh vân dùng chung. Draw calls là chi phí gửi lệnh dựng cảnh, **không tương đương phần trăm tăng FPS**. Chưa có đo GPU time hoặc FPS bền vững trên nhiều thiết bị; không cam kết 60 FPS.

Ảnh đối chiếu cùng góc/kích thước đã lưu trong bộ artifact của tác vụ: `galaxy-1025/map-before.png`, `map-after.png`, `learning-after.png`, `mobile-after.png`. Không đưa ảnh QA vào gói tài nguyên sản xuất.

## Bằng chứng kiểm thử

- Kiểm tra cú pháp: toàn bộ JS/MJS sản xuất thay đổi; `git diff --check`.
- Bộ Galaxy + Platform single shell/home scroll/stable layout + release consistency + auth gateway: **363/363** đạt.
- Test hành vi chạy geometry/raycasting Three thật với GPU giả lập: click chọn đúng route, bỏ pointerup lẻ, drag không chọn, wheel chỉ khi opt-in, pinch mô phỏng có giới hạn, pointer capture được trả lại, reset giữ world, chất lượng thích ứng không tạo hai RAF, context loss/destroy không giữ loop.
- Test lifecycle: tạm dừng thủ công không bị media query bật lại; hidden/offscreen/forced colors không giữ RAF; observer/tài nguyên được cleanup. Test shader thực tế bằng trình duyệt riêng, không coi GPU giả lập là bằng chứng shader biên dịch.
- Trình duyệt: khách → `/platform` → sidebar HH Galaxy → chọn hành tinh → mở workspace; đi đủ 11 workspace qua thanh điều hướng, mỗi trang có một canvas Galaxy sẵn sàng, không tràn ngang ở desktop.
- Chọn Music → khám phá hệ con 3 công cụ → reset: vẫn giữ hệ Music và 3 điểm đến, camera trở về 60. Bàn phím, Escape trả `touch-action: pan-y pinch-zoom`, chế độ tạm dừng, ba mức chất lượng đã thao tác.
- Bản nháp thử AI được lưu cục bộ, giữ nguyên khi chuyển Music → Back và sau reload; không gửi provider. Back/Forward chuyển đúng route.
- Cả renderer bản đồ và workspace nhận WebGL context loss thật từ extension trình duyệt: hiện trạng thái lỗi, thử lại còn đúng một canvas; hủy còn không canvas. Rời Galaxy về Platform còn không canvas Galaxy.
- Responsive: 375×812 và 768×1024 không tràn ngang; các nút điều khiển mới trên mobile cao 44px. Cuộn trang vẫn hoạt động khi điều khiển 3D tắt.
- Fixture và console của các luồng quan sát không có lỗi shader/JavaScript mới. Local static server báo gateway AI HTTP 404 trong UI như dự kiến vì không chạy backend.

## Giới hạn và nguồn

- Chưa xác nhận cảm ứng nhiều ngón trên thiết bị thật; pinch được kiểm thử bằng chuỗi pointer event mô phỏng.
- Phím phóng to trong trình duyệt kiểm thử không đổi DPR/viewport; **chưa xác nhận zoom trình duyệt 200% thực tế**. Không tính kiểm tra viewport hẹp là phép thử thay thế tương đương.
- Reduced motion/forced colors đã có test lifecycle và contract; chưa đổi các thiết lập cấp hệ điều hành để E2E trong lần này.
- Không xác nhận đăng nhập máy chủ, provider AI, realtime hoặc Admin bằng tài khoản thật trong phép thử guest/local.
- Toàn bộ sao/tinh vân/shader mới là mã thủ tục nguyên bản của dự án. Không dùng texture/HDRI/model tải ngoài, không gọi mạng cho đồ họa, không thêm dependency.
- Tái sử dụng Three.js r184 đã lưu tại `vendor/`, giấy phép MIT tại `vendor/THREE-LICENSE.txt`. Không sao chép giao diện/tài nguyên website khác.

## Phiên bản phát hành

SW cache v1025; loader v686; Layer One JS v27; Living Universe JS v8; map renderer v8; workspace renderer v3; shared materials v3; deep space v1. Không đổi stylesheet hoặc `script.js` vì đợt này không chỉnh chúng.
