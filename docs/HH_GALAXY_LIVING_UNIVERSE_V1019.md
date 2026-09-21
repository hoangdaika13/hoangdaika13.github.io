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

## Vòng hoàn thiện v1020

Kiểm thử trực tiếp ở viewport 375px xác nhận không tràn ngang, danh sách thay thế hoạt động và renderer Cân bằng đạt khoảng 58,6 FPS trong phiên đo cục bộ. Nút **Điều khiển 3D** được tách thành một event owner duy nhất để chuột, cảm ứng và bàn phím không kích hoạt trùng qua các lớp điều khiển của shell.

## Vòng hoàn thiện v1021

- Nâng cấp shader hành tinh theo hướng vật liệu điện ảnh: nhiễu macro/detail, roughness/specular khác nhau theo nhóm đá, khí gas, băng và kim loại; thêm Fresnel, wrap-light và khí quyển có nhịp sáng nhẹ.
- Bổ sung quầng sáng chọn hành tinh, flare quanh lõi, bụi quỹ đạo chuyển động và vòng hành tinh quay chậm; tất cả vẫn dùng cùng renderer/lifecycle và tự giảm ở Economy.
- Hover trên hành tinh hoặc focus vào thẻ điểm đến cập nhật inspector thành trạng thái “Đang xem trước”; Enter từ vùng cảnh mở đúng route đang xem trước, không làm thay đổi selection cho đến khi người dùng chọn.
- Thêm lớp tinh vân CSS có `pointer-events: none`, tự tắt theo reduced-motion/forced-colors và không tạo overflow.
- Không dùng texture, mã nguồn hoặc dịch vụ bên ngoài; toàn bộ hình ảnh vẫn là procedural art trong repository và Three.js MIT hiện có.
