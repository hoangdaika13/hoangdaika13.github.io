# Thiết kế đồ họa nâng cao — release 1057

Ngày: 15/10/2026. Tiếp nối `2509cde` (1056), giữ `/platform`, `/graphic-design`, 25 studio con và Workflow; không sửa auth, quyền Admin, route hay các mục khác.

## Các workflow mới

### Boolean vector có hình học thật

- Giữ tuyến hình chữ nhật vuông góc chính xác. Bổ sung hình xoay/skew, bo góc, ellipse, polygon, star và path đóng M/L/H/V/C/S/Q/T/Z, gồm lỗ và các vùng rời nhau.
- Đường cong được chia đoạn với sai số hình học tối đa 0,25 px trong tọa độ tài liệu sau transform; kết quả là path đa giác, không giả vờ giữ nguyên đường cong giải tích.
- Giới hạn 2–32 layer, 3.072 điểm đầu vào, 1.024 điểm/contour, 8.192 điểm kết quả và ngân sách kiểm tra giao cắt. Từ chối Arc, path mở/tự cắt, compound contour chạm nhau, mask, hiệu ứng, stroke-only hoặc hình quá phức tạp trước khi sửa bản gốc.
- Một thao tác undo/redo; nguồn và thông tin engine/sai số được giữ trong metadata. Không thay Boolean bằng bounding box.

### Vector Core → tài liệu chung

- Panel “Chuyển vector sang tài liệu chung”: chọn thời điểm, kiểm tra khả năng chuyển, rồi tạo frame mới có thể chỉnh sửa. Giữ nguyên frame và dự án Vector gốc; không đồng bộ ngầm hai schema.
- Chụp đúng transform/motion/morph tại thời điểm chọn, bake transform nhóm trung tính, chuyển absolute Bézier handle sang relative handle, giữ cubic đóng và baseline/rotation của text. Hình tròn/bo góc dùng cubic Bézier xấp xỉ và có cảnh báo riêng.
- Chỉ chuyển subset đã có adapter. Mask, Trim Path, scale không đều/lật, nhóm có opacity/blend, paint ngoài HEX6/none, background ngoài HEX6 và các thuộc tính vượt giới hạn bị chặn; không đổi màu hoặc bỏ thuộc tính âm thầm. Layer ẩn được đếm rõ.
- Kiểm tra lại dữ liệu khi bấm tạo; một undo xóa cả frame nhập. Lưu trả kết quả thật; lỗi lưu không xóa bản Vector và không ghi “đã lưu”. Cleanup panel/callback khi rời workspace.

### Asset gốc của 3D

- IndexedDB mới lưu nguyên byte GLB/glTF, BIN đi kèm, texture, normal map và environment LDR theo account + project. Không tự di chuyển hoặc xóa dữ liệu cũ.
- Khôi phục asset sau khi Three.js sẵn sàng; báo thiếu file/quota/không hỗ trợ thật, có nút nạp lại. Chờ transaction commit, hủy tác vụ muộn, thu hồi Blob URL và giải phóng tài nguyên GPU khi rời.
- 16 MiB/file, 64 MiB/bundle, 128 MiB/dự án. JSON scene chỉ có tham chiếu, **không phải gói portable có binary**; chưa có orphan garbage collector. Asset cũ chưa lưu bản gốc cần nhập lại.
- Loader nhận mesh tĩnh subset glTF2, không tải URL bên ngoài. Draco/KTX2/Meshopt, skin, morph/sparse accessor và required extension chưa hỗ trợ bị từ chối. Texture được khai báo trong material glTF chưa tự nạp; có thể áp dụng texture riêng bằng công cụ hiện có. Animation glTF không tự thành HH timeline.
- Inspector không còn bị dựng lại ở mỗi RAF làm mất focus; renderer settings như exposure/background/fog áp dụng thực tế. Sửa hàng grid của stage để toolbar không chiếm vùng canvas.

### Export tài liệu chung

- Chọn frame mà không thay active frame; preflight chỉ kiểm tra nội dung frame đó, ảnh gốc từ kho account. PNG/JPEG/WebP ở 0,5/1/2/3×, SVG, package và PDF nhiều trang.
- PDF là JPEG RGB trên từng trang PDF thật, kích thước giấy không đổi theo tỉ lệ raster. **Không phải PDF vector, chữ tìm kiếm, tagged accessibility hoặc in CMYK.**
- Snapshot nhất quán cho batch, kiểm tra MIME thật, 32 MP/frame, 96 MP/batch, tối đa 32 trang, cạnh 16.384 px, 64 MiB encoded output. Nền đệm không xóa nền thiết kế. Có dừng xuất, abort khi đóng, không tải file từ callback muộn.
- Queue artboard riêng vẫn tách biệt và vẫn cần encoder được cấu hình cho PDF/MP4/WAV; không quảng cáo rằng mọi native engine đã nối lossless vào Universal.

## Nguồn và giấy phép

- Thêm bản vendor `polygon-clipping` 0.15.7, không thêm npm dependency/framework/editor. Nguồn: https://github.com/mfogel/polygon-clipping/tree/v0.15.7 và artifact `dist/polygon-clipping.umd.min.js` tại tag này. Đây là thư viện mature có bản phát hành cũ; không gọi là dependency đang phát hành thường xuyên.
- Áp dụng engine union/difference/intersection/XOR; adapter hình học, flatten/parser, giới hạn, bridge và UI là mã nguyên bản của dự án. Chỉ bỏ sourceMappingURL trỏ tới file không vendor.
- SHA256 artifact đã vendor: `1bd1335a65dac024dcba9843c60160b3b53faa46967b1b3ae2a4d5ef0ff04fce`.
- Giấy phép Polygon/Splaytree MIT, robust-predicates Unlicense và notice helper Microsoft/Apache-2.0 đầy đủ tại `vendor/POLYGON-CLIPPING-NOTICES.md`.
- Giữ Three.js r184 MIT đã có. Dùng PDF.js đã có chỉ trong QA để mở/render PDF, không thêm nó vào Export runtime. Không thêm model, font hay ảnh ngoài.

## Bằng chứng và giới hạn kiểm thử

Kết quả cuối: **394/394** Graphics/media, **384/384** hồi quy Galaxy/shell/route/cache, **241/241** All Tool và **12/12** nhóm browser QA đạt. Các bộ có contract trùng nhau, không cộng thành tổng test độc lập. Runner tái lập: `scripts/qa-graphic-design-campus.js`; ảnh và kết quả QA tổng hợp trong `.study-local/graphic-design-campus-1057`, không commit dữ liệu QA.

- Node: bộ Graphics/media, hồi quy Galaxy/shell/route/cache và All Tool. Có kiểm tra cú pháp/diff. Repository không có lệnh lint/typecheck/build tổng cho frontend; không ghi những lệnh không tồn tại là đã chạy.
- Chromium thật + SwiftShader: toàn bộ 25 studio và Workflow, 1440/768/375px, CSS zoom 200%, reduced motion/forced colors, project riêng, reload/Back/Forward, tài nguyên gốc, bridge, Boolean và export.
- PDF được PDF.js mở/render lại từng trang và xác nhận số trang, kích thước, pixel màu; không chỉ kiểm tra header `%PDF`.
- 3D dùng IndexedDB thật và Three thật để nhập, lưu, đóng/mount lại model+texture+environment; so checksum nguyên byte và kiểm tra cách ly account/project. Một số race/transaction failure là doubles có kiểm soát, không đồng nghĩa kiểm thử trên GPU/thiết bị di động vật lý.
- Xác nhận bằng nút UI: Boolean ellipse trừ ellipse tạo path có lỗ thật, bridge tạo frame editable và lưu/khôi phục, Export tải PNG hợp lệ. Inspector 3D giữ đúng node focus qua nhiều frame; toolbar nằm đúng hàng. Ảnh render canvas 3D và hai trang PDF đã được xem lại. Giao diện Export ở 375px + CSS zoom200 không overflow.
- Backend/auth/provider trong runner trả trạng thái unavailable có chủ ý; không tuyên bố live collaboration WAN, backend review hoặc provider AI đã được kiểm thử. Các giới hạn release1056 về CRDT/server sharing, chuyển engine hai chiều, video/codec và simulation vẫn còn.

## Phát hành

Cache1057; loader719; script292 giữ nguyên. Studio CSS11/JS10, Universal7, 3D6, Export4, Capabilities2; Geometry1/VectorBridge1 và vendor pinned 0.15.7. Index/SW stage từ HEAD cộng riêng scope1057, giữ Facebook/auth WIP ngoài commit. Deploy chỉ xác nhận sau push và kiểm tra trạng thái thực tế.
