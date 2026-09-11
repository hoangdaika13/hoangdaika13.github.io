# HH Platform Home — Cinematic Living Cosmos v1008

## Phạm vi

- `/platform` tiếp tục là Trang chủ canonical của HH Platform và vẫn chạy bên trong App Shell hiện có.
- HH Galaxy vẫn là một mục lớn trong catalog, không có gateway hoặc lớp giao diện thứ hai.
- `platform-home.js` sở hữu nội dung, điều hướng, bộ lọc và lifecycle của Trang chủ.
- `home-cosmos-motion.js` là owner duy nhất của một canvas WebGL, một RAF, GPU resources, ResizeObserver, IntersectionObserver và các listener chuyển động.

## Nâng cấp

- Trường sao procedural có bốn lớp độ sâu, cụm sao bất quy tắc và sáu nhiệt độ màu.
- CSS first paint có dải Ngân Hà, bốn lớp tinh vân, bụi tối, tia sáng, vignette và foreground nhẹ; mọi lớp trang trí đều không nhận pointer event.
- Portal danh mục dùng bề mặt hành tinh, ánh sáng khí quyển và rim light riêng trong khi vùng bấm và chữ đứng yên.
- Hero ngắn hơn trên desktop; typography, độ tương phản và vùng bấm được tăng trên toàn Trang chủ.
- Bộ lọc khả năng phân biệt cục bộ/trình duyệt, dịch vụ mạng, provider và quyền Admin từ registry thật.
- Search, bộ lọc, chế độ yêu thích và trạng thái tạm dừng chuyển động được lưu theo account scope hiện có.
- CTA tiếp tục mở recent workspace thật nếu có; nếu chưa có dữ liệu thì đưa đến Command Center.

## Hiệu năng và fallback

- Tĩnh/Save Data: không tạo particle buffer và không chạy RAF.
- Tiết kiệm: 620 particle, 24 FPS, DPR 1 và giảm lớp CSS.
- Cân bằng: 2.100 particle, tối đa 30 FPS, DPR 1,35.
- Điện ảnh: 3.000 particle, tối đa 50 FPS, DPR 1,5.
- Canvas chỉ hiện sau frame WebGL đầu tiên. Shader/context lỗi dùng CSS fallback; context restore không reload trang.
- RAF dừng khi Trang chủ ngoài viewport, tab bị ẩn, người dùng tạm dừng hoặc route unmount.
- Unmount hủy RAF, listener, observer, shader, program, buffer và WebGL context.

## Nguồn và giấy phép

Không có mã, ảnh, texture, video, shader hoặc asset bên thứ ba được sao chép hay tải vào release này. Toàn bộ scene mới là CSS và WebGL procedural viết riêng cho repository, vì vậy không phát sinh yêu cầu attribution mới. Bảng màu và nguyên tắc ánh sáng chỉ dùng kiến thức thiết kế phổ quát.

## Kiểm thử

QA trực tiếp được chạy bằng Chromium/Edge 152 trên bản local tại `/platform`:

- Mobile `375x812`, tablet `768x900`, laptop `1280x800` và desktop `1440x900` đều không có overflow ngang; vùng cuộn Trang chủ đi tới footer thật.
- Hero desktop/laptop chiếm khoảng `72%` chiều cao viewport. CTA chính và nút tạm dừng có vùng bấm tối thiểu `44px`; mobile giữ CTA trong phần nội dung đầu và dùng composition nhẹ hơn.
- Mỗi viewport chỉ có một canvas đang hiển thị. Canvas nền App Shell vẫn tồn tại nhưng `display:none`; mọi lớp scene đang hiển thị đều có `pointer-events:none`.
- CTA khám phá cuộn và focus đúng catalog. Search có empty/reset thật; bộ lọc nhóm và khả năng kết hợp đúng trên 34 mục registry.
- Yêu thích, ghim, query, nhóm, khả năng và trạng thái pause giữ đúng sau reload trong kho guest tách biệt; dữ liệu QA đã được hoàn tác sau kiểm thử.
- Recent CTA mở `/learn`; Back/Forward giữ App Shell, unmount Trang chủ trong khoảng 200ms và cleanup canvas trước khi workspace hoàn tất.
- WebGL context loss chuyển sang CSS fallback mà không mất nội dung; restore trở lại WebGL trong khoảng 300ms. `prefers-reduced-motion` dùng tier `static`, 0 canvas hiển thị và không có render loop.
- Zoom 200% được mô phỏng bằng visual viewport `360x225` trên layout CSS `720x450`: không có overflow ngang và các control/catalog vẫn tồn tại, dùng được bằng cuộn.
- Syntax check đạt. Nhóm test Platform Home, scroll, cosmos motion, Galaxy Shell, navigation, runtime boundary, service worker/cache và release consistency đạt `52/52`.

Không có JavaScript exception hoặc HTTP `4xx/5xx` từ asset của release. Khi chạy qua static server local vẫn có lỗi tích hợp có sẵn từ `/api/auth/providers`, `/api/votes` bị CORS và realtime `127.0.0.1:4000` chưa chạy; các lỗi này không phát sinh từ Trang chủ v1008 và không được che hoặc sửa ngoài phạm vi. Repository không khai báo script lint, typecheck hoặc build tổng quát trong `package.json`.

Release không thay đổi dữ liệu workspace, schema xác thực, quyền Admin hoặc API/provider.
