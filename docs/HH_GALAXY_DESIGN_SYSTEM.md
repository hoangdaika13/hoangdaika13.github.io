# HH Galaxy Design System v1

## Mục đích

HH Galaxy là lớp nhận diện và bố cục dùng chung cho HH Platform. Foundation này
không thay router, không dựng lại workspace và không can thiệp vào state của các
feature. Nó tăng cường `#appShell` hiện hữu bằng token semantic, layout profile và
các thuộc tính mô tả vùng giao diện.

Nguyên tắc quan trọng nhất:

- Giữ nguyên route, event handler, DOM và dữ liệu của feature.
- Không hiển thị dữ liệu giả hoặc suy diễn trạng thái nhà cung cấp.
- Mỗi feature tiếp tục sở hữu loading, quyền, cấu hình, lỗi và cleanup của nó.
- Persistent chrome chỉ có một effect owner CSS; không có canvas, WebGL hay RAF
  cạnh tranh với YouTube, video, game hoặc renderer của feature.
- Shell cũ vẫn là đường rollback cho đến khi người dùng cho phép gỡ bỏ.

## Tệp và trách nhiệm

| Tệp | Trách nhiệm |
| --- | --- |
| `galaxy-design-system.css` | Token semantic, typography, control, panel, focus và trạng thái cơ sở |
| `galaxy-shell.css` | Persistent chrome, bảy layout profile, effect owner và responsive |
| `galaxy-shell.js` | Feature flag, route manifest và lifecycle enhancer |
| `tests/galaxy-shell-contract.test.js` | Contract chống hồi quy cho API, route, CSS và tính trung thực dữ liệu |

Mọi selector sản phẩm trong hai tệp CSS đều nằm dưới `[data-galaxy-shell]`.
Không đặt luật tổng quát lên `body`, `button`, `main`, `canvas` hoặc feature root.

## Token semantic

Feature mới nên dùng alias theo nghĩa:

```css
.my-feature[data-galaxy-panel] {
  color: var(--galaxy-color-text);
  background: var(--galaxy-color-surface);
  border-color: var(--galaxy-color-border);
}
```

Không dùng trực tiếp mã màu nếu cùng ý nghĩa đã có token. Các nhóm token:

- Canvas/surface: `--galaxy-color-canvas`, `--galaxy-color-surface`,
  `--galaxy-color-surface-raised`, `--galaxy-color-surface-interactive`.
- Content: `--galaxy-color-text`, `--galaxy-color-text-secondary`,
  `--galaxy-color-text-muted`.
- Interaction: `--galaxy-color-accent`, `--galaxy-color-focus`.
- State: `--galaxy-color-positive`, `--galaxy-color-caution`,
  `--galaxy-color-negative`.
- Shape/motion: `--galaxy-radius-*`, `--galaxy-duration-*`,
  `--galaxy-ease-standard`.

Font body là `Inter Variable`, sau đó `Be Vietnam Pro`, `Segoe UI` và sans-serif.
Việc nạp font thuộc asset shell; foundation chỉ khai báo stack ổn định.

## Layout profile

`HHGalaxyShell.syncRoute()` tự ánh xạ route sang một trong bảy profile:

| Profile | Dùng cho |
| --- | --- |
| `atlas` | Galaxy Map, AI Universe, Vũ trụ, EonWild |
| `standard` | Hub và trang danh mục |
| `dashboard` | Widget, analytics và admin |
| `three-column` | Library + content + inspector |
| `workbench` | Editor, automation và studio |
| `media-dock` | Nhạc, phim, YouTube và global player |
| `desktop` | Chế độ desktop đa cửa sổ tùy chọn |

Các biến layout chuẩn là `--header-h`, `--sidebar-w`, `--rail-w`,
`--library-w`, `--inspector-w`, `--dock-h` và `--layout-gap`.

Responsive:

- Từ 1440px: đầy đủ sidebar và inspector.
- 1180–1439px: inspector có thể hoạt động như drawer.
- 768–1179px: sidebar gọn 224px, có thể thu thành rail 72px bằng điều khiển hiện hữu; grid tối đa hai cột.
- Dưới 768px: một cột, inspector dạng bottom sheet, tôn trọng safe area.

## JavaScript API

API toàn cục bất biến là `window.HHGalaxyShell`:

```js
HHGalaxyShell.mount({ enabled: true });
HHGalaxyShell.syncRoute("/chat-ai");
const snapshot = HHGalaxyShell.getState();
HHGalaxyShell.unmount();
```

- `mount()` gắn thuộc tính vào shell/header/sidebar/main hiện hữu, tạo tối đa một
  effect owner và đăng ký listener có cleanup.
- `unmount()` gỡ listener, gỡ effect owner do enhancer tạo và khôi phục chính xác
  mọi thuộc tính đã tồn tại trước khi mount.
- `syncRoute()` chuẩn hóa route, chọn owner dài nhất và chỉ cập nhật metadata.
- `getState()` trả snapshot read-only, không trả DOM node.
- `routeManifest` là mảng deep-frozen. Trường `capabilities` mô tả nhu cầu của
  route, không tuyên bố provider đã sẵn sàng.

Các sự kiện chỉ mang metadata không nhạy cảm:

- `hh:galaxy-shell-mounted`
- `hh:galaxy-shell-route`
- `hh:galaxy-shell-unmounted`

Player ngoài shell có thể phát `hh:media-playback` với `{ active: boolean }`.
Shell sẽ hạ opacity và tạm dừng animation nền; nó không chạm vào media element.

## Feature flag và rollout

Khóa local-first có version:

```text
hh.galaxy-shell.v1
```

Giá trị chính thức:

```json
{ "version": 1, "enabled": true }
```

Rollout được thực hiện bằng `HHGalaxyShell.setEnabled(true)`. Nếu chưa bật cờ,
`mount()` trả `false` và không sửa DOM. Có thể chạy canary theo thiết bị/tài khoản
ở lớp orchestration, nhưng không được ngầm đổi cờ dựa trên dữ liệu giả.

## Capability truth

Mỗi module phải tự thể hiện một trong các trạng thái thật:

1. `loading`
2. `ready`
3. `empty`
4. `offline`
5. `permission-required`
6. `configuration-required`
7. `degraded`
8. `error`

`capabilities` trong route manifest chỉ giúp shell biết loại công cụ; nó không
được dùng để vẽ chấm xanh, số người online, dung lượng cloud, entitlement hoặc
tiến độ thực thi. Chỉ API/provider chịu trách nhiệm mới được công bố các giá trị
đó.

## Accessibility và hiệu năng

- Existing landmarks (`header`, `nav`, `main`) được giữ nguyên.
- Không đổi focus và không tạo live region mới khi sync route.
- Control foundation có vùng bấm tối thiểu 44×44px và focus-visible rõ.
- `prefers-reduced-motion` tắt drift/breathe; forced-colors bỏ nền trang trí.
- `visibilitychange` dừng hiệu ứng khi tab ẩn.
- Khi audio/video thật đang phát, effect owner chuyển sang paused.
- Foundation không khởi tạo timer, worker, AudioContext, canvas hay WebGL.

## Rollback / quay lại shell cũ

Không xóa bất kỳ theme hay shell cũ nào trong giai đoạn foundation.

```js
HHGalaxyShell.setEnabled(false);
```

Lệnh trên lưu cờ tắt, gọi `unmount()` và phát sự kiện để router dọn adapter/engine
takeover rồi render lại ngay route hiện tại bằng giao diện cũ. Toàn bộ thuộc tính
do enhancer thêm được khôi phục về trạng thái trước mount; route, dữ liệu feature,
player và storage không thay đổi. Nếu JavaScript chưa tải, có thể xóa riêng khóa
`hh.galaxy-shell.v1`; tuyệt đối không xóa các khóa `hh.*` khác.

## Checklist tích hợp feature

1. Chọn route canonical hiện có; alias không được làm mất deep link cũ.
2. Chọn đúng layout profile thay vì chép một grid sang mọi màn hình.
3. Dùng token semantic và scope CSS dưới feature root nằm trong Galaxy Shell.
4. Giữ mount/unmount riêng, hủy listener/worker/timer/render loop khi rời route.
5. Hiển thị capability state thật; không dùng demo metric ở production.
6. Kiểm tra keyboard, zoom 200%, 375px, reduced motion và không overflow ngang.
7. Chạy `node --test tests/galaxy-shell-contract.test.js` trước khi tích hợp shell.

## Layer One functional workspaces (v970)

`galaxy-layer-one.js` giữ một shell ổn định và gắn workspace theo route, không
đụng vào lớp HH Platform. AI dùng `GET /api/ai` để probe provider và `POST
/api/ai` với `toolId=ai-chat` khi người dùng chủ động gửi; nếu backend hoặc đăng
nhập chưa sẵn sàng, UI fail closed và vẫn cho lưu prompt cục bộ. Handoff từ Home
dùng khóa phiên `hh.galaxy.ai.handoff.v1`, có TTL 15 phút, được đọc một lần và
luôn đưa vào textarea (không tự gửi).

Music/Video giữ một media node trong `data-hgl1-stable-media-host`; bộ hòa giải
DOM không tháo node đang phát khỏi document, vì việc tháo rồi gắn lại iframe có
thể làm mất browsing context. Game canvas, Home delegate và Creator delegate
cũng được giữ như persistent island khi cùng route. Tệp cục bộ dùng object URL và được pause/revoke khi
rời route hoặc unmount. Video YouTube chỉ nhận URL `youtube.com`/`youtu.be`,
chỉ tạo iframe sau submit, dùng `youtube-nocookie.com`, `autoplay=0` và không
polling trạng thái.

Games có canvas Orbit Collector tối giản, điều khiển WASD/mũi tên/gamepad và
không báo điểm/người chơi ngoài phiên. Dev lưu snippet và chỉ kiểm tra tĩnh;
không thực thi code, đồng thời từ chối các chữ ký credential phổ biến trước khi
ghi localStorage. Community lưu bản nháp gồm tiêu đề, nội dung và privacy
local-first; Socket.IO chỉ kết nối cùng origin hoặc origin được caller allowlist
rõ ràng, không gửi browser credential sang origin khác, và chỉ giữ một socket
trong vòng đời route. Mọi trạng thái chưa cấu hình đều hiển thị rõ.

Settings dùng `settingsDraft` để preview tức thời; chỉ `Lưu thay đổi` ghi
localStorage, `Hủy` khôi phục bản lưu và `Khôi phục mặc định` chỉ thay đổi draft.
Backup được parse/validate trước, hiển thị preview, cho chọn merge/replace và
chỉ ghi sau xác nhận. Consent Analytics của thiết bị không thể bị bật/tắt bởi
tệp backup; event từ backup không được nhập khi thiết bị chưa consent. Analytics
có bộ lọc hôm nay/7 ngày/30 ngày/tất cả; phạm vi đang chọn cũng được áp dụng vào
tệp JSON/CSV và không event nào được xuất khi consent đã tắt.
