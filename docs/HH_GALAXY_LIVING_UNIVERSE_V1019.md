# HH Galaxy — A Living Creative Universe (v1019)

## Phạm vi

Thế giới 3D chỉ thay bản đồ `/home` của HH Galaxy trong khung HH Platform. Header, sidebar, breadcrumb, đăng nhập, Solar Secret, quyền Admin và các workspace hiện có không bị thay thế.

Danh sách hệ lấy từ `HHGalaxyLayerOne.routeManifest`; các trạm/công cụ lấy từ `HHGalaxyShell.routeManifest`. Mục Admin bị loại khỏi bản đồ công khai. Không có hành tinh, số người dùng, tiến độ hay trạng thái nhà cung cấp được tạo giả.

## Tương tác và dữ liệu

- Chọn hành tinh chỉ mở bảng thông tin; người dùng phải bấm **Mở workspace**.
- Kéo, wheel và pinch chỉ điều khiển camera sau khi bật **Điều khiển 3D**; `Escape` thoát ngay.
- Bản đồ và danh sách dùng cùng một catalog. Danh sách vẫn hoạt động khi WebGL lỗi hoặc forced-colors đang bật.
- Góc nhìn, hệ đang xem, lựa chọn, mức đồ họa và trạng thái tạm dừng lưu dưới khóa account-scoped `hh.galaxy.cosmic-studio.v1:*:hh.galaxy.universe.v1`.
- Yêu thích, ghim và gần đây tái sử dụng kho hiện có của Galaxy/HH Platform.

## Renderer và hiệu năng

Chỉ có một `WebGLRenderer`, một canvas và một RAF thuộc vòng đời của atlas. Renderer được tải động khi bản đồ cần hiển thị, dừng khi tab/cảnh bị ẩn và giải phóng geometry, material, texture cùng WebGL context khi unmount. Ba mức chất lượng giới hạn DPR, sao, khí quyển và bụi quỹ đạo; thiết bị hạn chế hoặc bật tiết kiệm dữ liệu tự dùng mức Tiết kiệm.

## Nguồn và giấy phép

Toàn bộ mặt trời plasma, hành tinh, khí quyển, vành đai, quỹ đạo, sao, tinh vân và sao băng được dựng bằng shader/geometry thủ tục viết cho dự án; không có ảnh, texture hoặc mã tải từ website bên ngoài.

Renderer dùng bản Three.js đã có trong repository. Three.js được phát hành theo giấy phép MIT; bản quyền và toàn văn giấy phép nằm tại `vendor/THREE-LICENSE.txt`.
