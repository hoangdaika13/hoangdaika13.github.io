# HH Galaxy — Astral Atlas, release 1055

Ngày kiểm thử: 14/10/2026. Tiếp tục từ `40070ca`; giữ HH Platform `/platform`, Galaxy `/home` và 11 route `/galaxy/*` hiện có. Không đổi đăng nhập, quyền Admin, các engine nghiệp vụ hoặc định dạng dữ liệu.

## Giao diện và đồ họa

- Atlas midnight/lavender với mint và ánh đồng: typography rõ hơn, toolbar gọn, tab Galaxy có trạng thái đang mở, khung bản đồ và inspector có chiều sâu. Trang vẫn cuộn trong vùng hiện có; không khóa body hoặc thêm overlay.
- Hai số đếm lấy từ registry đã lọc quyền: **11 hệ hành tinh, 30 công cụ con** ở registry hiện tại, không phải số liệu hoạt động giả. Chân dung và accent inspector đổi theo hành tinh; công cụ con kế thừa chất liệu của hệ cha.
- Trường sao 3D có dải nghiêng và lớp halo chiều sâu; tinh vân có sợi sáng/vùng bụi tối. Sử dụng cùng một point cloud và ba tấm tinh vân sẵn có, không phải mô phỏng khí thể tích.
- Năm họ bề mặt được tinh chỉnh: đại dương, khí, băng, đá và công nghệ; ánh sáng đêm mát, highlight ấm và viền khí quyển mảnh. Toàn bộ là tranh thủ tục, không phải ảnh chụp hay mô hình thiên văn chính xác.
- Không thêm canvas, RAF, mesh, pass, texture tải ngoài, thư viện hoặc lời gọi dịch vụ. Các mức sao/tinh vân, DPR và cơ chế dừng khi ẩn/tạm dừng giữ nguyên.

## Lỗi tùy chọn được sửa khi kiểm thử

Cosmic Studio gắn `data-gcs-view` trên app nhưng delegated click dùng `closest('[data-gcs-view]')`, nên click thông thường có thể bị hiểu thành đổi chế độ xem và ghi lại snapshot tùy chọn cũ. Điều này xóa yêu thích vừa lưu từ atlas.

Chỉ nút `button[data-gcs-view]` nằm trong toolbar được đổi chế độ; trước thao tác hợp lệ luôn đọc lại tùy chọn mới nhất trong đúng storage hiện có. Không đổi key, scope tài khoản hoặc tự migrate dữ liệu. Bốn test DOM hành vi mới đều thất bại với mã HEAD cũ và đạt với bản sửa. Trình duyệt còn kiểm tra trực tiếp giá trị lưu, reload và đổi list/map.

Sửa thêm race có sẵn khi chuyển workspace trước debounce 400ms: controller cũ từng chụp trường của trang mới vào key bản nháp trang cũ. `render()` giờ capture trước khi thay DOM, giữ nguyên định dạng/key sessionStorage. Test chạy render thật với controller xác nhận capture trước replacement và destroy không ghi đè; bỏ riêng dòng sửa thì test thất bại.

## Kiểm thử và giới hạn

- Syntax: các JS/MJS runtime, fixture và runner thay đổi; `git diff --check`.
- **368/368** test Galaxy, route, shell, scroll, lifecycle, input và release/cache đạt. **241/241** test All Tool đạt khi kiểm tra hồi quy. Hai bộ có một số contract dùng chung; không cộng thành số test độc lập.
- Bộ `platform-home.test.js` riêng có lỗi harness `window is not defined` và các kỳ vọng registry cũ. Đã tái hiện bằng nguyên nguồn HEAD; `script.js` và test đó không thay đổi. Lỗi có sẵn được ghi riêng, không xác nhận suite này đạt.
- Runner `scripts/qa-galaxy-atlas.js`: Chromium/WebGL thực qua SwiftShader, module và CSP sản xuất, không GPU giả lập bằng mock. Fixture boot chuyển ra module cục bộ để đáp ứng CSP, không nới CSP của website. Auth, API và realtime là response double “chưa cấu hình”; riêng URL socket trong preview dùng nhánh URL sản xuất đã được allowlist, không kết nối dịch vụ thật.
- So sánh trước/sau dùng baseline Git cố định `40070ca5519cb0cbf79173c98f0cdb8880cbd679` ở endpoint loopback `/before/` (có thể chỉ định `HH_QA_BASE_REF`), cùng camera, viewport, chất lượng Cân bằng và chuyển động dừng. Không thay checkout hoặc tài nguyên cũ. Ảnh/log QA nằm trong `.study-local/galaxy-atlas-1055`, không commit dữ liệu QA.
- **7/7 nhóm kiểm thử trình duyệt đạt**; bản nháp AI được nhập–lưu–chuyển route trong cùng lượt xử lý, đi qua các workspace, reload rồi mở lại nội dung đã lưu để đối chiếu chính xác. Không gửi prompt tới provider.
- Browser UI: khách → sidebar Galaxy → hệ/công cụ; chọn/preview, tìm kiếm và trạng thái trống, yêu thích lưu–reload, chế độ danh sách, camera reset, bàn phím, tạm dừng và reduced motion; desktop 1440px, tablet 768px, mobile 375px, CSS zoom 200% và forced colors; 11 workspace, bản nháp AI, reload/Back/Forward và cleanup khi về Platform.
- Chưa kiểm tra đăng nhập máy chủ/thiết bị mic/camera, mạng WAN, AI trả phí, cảm ứng nhiều ngón thực tế hoặc zoom cấp trình duyệt. Không cam kết FPS trên thiết bị khác hay tuân thủ WCAG toàn diện. Không tự phát media hoặc gửi bản nháp tới provider.

### Ngân sách đồ họa quan sát

| Cảnh | Draw call trước → sau | Geometry trước → sau |
|---|---:|---:|
| Bản đồ | 54 → 54 | 14 → 14 |
| AI | 10 → 10 | 6 → 6 |
| Games | 10 → 10 | 5 → 5 |
| Settings | 10 → 10 | 6 → 6 |

Cả 11 workspace được đối chiếu trong runner. Đây là bộ đếm dựng cảnh, không phải phép đo GPU time, RAM hay bằng chứng tăng FPS. Phần shader thêm công thức tạo hình/màu nhưng không tăng số lần lấy mẫu noise hiện có.

## Phát hành và quyền sử dụng

SW cache1055; loader717; Living Universe CSS4/JS9; Stable Chrome CSS5; Cosmic Studio JS5; Layer One JS28; map renderer9; workspace renderer4; vật liệu4; deep-space2. `script.js` vẫn291. Các thay đổi Facebook/auth đang làm dở không nằm trong phát hành này; index/SW được stage từ HEAD cộng riêng hunk Galaxy.

Mã đồ họa/CSS mới là mã nguyên bản; không sao chép website, tải model, HDRI hoặc media ngoài. Tái sử dụng Three.js r184 đã có, giấy phép MIT tại `vendor/THREE-LICENSE.txt`. Không thêm dependency hoặc tài nguyên cần ghi công mới. Trạng thái deployment được kiểm tra sau push, không xác nhận trước trong tài liệu.
