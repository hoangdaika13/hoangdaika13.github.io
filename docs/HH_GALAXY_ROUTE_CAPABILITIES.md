# HH Galaxy domain views — routes và capability contract

`galaxy-domain-views.js` là lớp trình bày/adaptor dùng chung cho Creator Pipeline, Automation Builder, Project Hub và Ambient Room. Hai màn hình có lifecycle riêng được tách thành `galaxy-community-showcase.js` và `galaxy-web-desktop.js`. Các lớp này không thay thế engine đang hoạt động, không đổi schema cũ và không tạo dữ liệu giả để lấp giao diện.

`galaxy-planet-hubs.js` sở hữu lớp trung chuyển cho chín hành tinh và hai khu vực tiện ích. Trên Galaxy Map, chỉ control có `data-gha-entry="hh-core"` đi tới `/home/dashboard`. Các hành tinh đi tới `/galaxy/*`, hiển thị hub độc lập rồi mới mở route engine thật; deep-link legacy vẫn được giữ nguyên.

| Hành tinh | Hub route | Engine chính |
|---|---|---|
| AI Universe | `/galaxy/ai` | `/chat-ai`, `/create/ai-center` |
| Music Planet | `/galaxy/music` | `/music/ambient`, `/music-ai`, `/music` |
| Video Planet | `/galaxy/video` | `/davinci-resolve`, `/youtube`, `/cinema` |
| Creator Studio | `/galaxy/creator` | `/create/workflow` |
| Games World | `/galaxy/games` | `/play`, `/game`, `/comic-reader` |
| Dev Planet | `/galaxy/dev` | `/dev-tools` |
| Learning Star | `/galaxy/learning` | `/learn`, `/english`, `/japanese`, `/chinese`, `/phat-phap` |
| Community | `/galaxy/community` | `/communication/*` |
| Tools Galaxy | `/galaxy/tools` | Project, Automation, Desktop và `/universe` |
| Analytics / Cài đặt | `/galaxy/analytics`, `/galaxy/settings` | `/analytics`, `/settings` |

## API

```js
window.HHGalaxyDomainViews.mount(root, {
  route: "/create/workflow",
  navigate: (route) => { location.hash = `#${route}`; },
  openEngine: ({ id, route, host }) => mountExistingEngine(id, route, host),
  apiBase: window.HH_REALTIME_URL,
  capabilities: { cloud: false, automation: true },
  data: { projects: [], automations: [], automationRuns: [], communityItems: [] }
});

window.HHGalaxyDomainViews.unmount(root);
window.HHGalaxyDomainViews.canHandle("/music/ambient");
window.HHGalaxyDomainViews.canHandle("/music", { includeAliases: false }); // false
window.HHGalaxyDomainViews.getState(root);

window.HHGalaxyCommunityShowcase.mount(root, {
  route: "/communication/community",
  apiBase: window.HH_REALTIME_URL,
  navigate: (route) => { location.hash = `#${route}`; }
});

window.HHGalaxyWebDesktop.mount(root, {
  route: "/system/desktop",
  navigate: (route) => { location.hash = `#${route}`; }
});
```

Mỗi module công khai `mount()`, `unmount()`, `canHandle()` và `getState()`. Mỗi root chỉ có một instance; mount lần nữa sẽ cleanup instance cũ trước.

## Route map

| Màn hình | Canonical route | Alias adapter | Engine/đích chính |
|---|---|---|---|
| Creator Pipeline | `/create/workflow` | `/create`, `/galaxy/creator-pipeline`, `/galaxy/creator` | Creative OS và các tool `/create/*`, `/media-design/*`, `/music-ai/*`, `/davinci-resolve/*` |
| Automation Builder | `/work/automation-lab` | `/galaxy/automation-builder` | Work Center Automation Lab; AI Automation giữ workspace riêng |
| Project Hub & Media Vault | `/work/projects-tasks` | `/galaxy/project-hub` | Work Center, Universal Project và Media & Design |
| Community Showcase | `/communication/community` | `/galaxy/community-showcase`; `/galaxy/community` là Planet Hub | Module Community chuyên trách và backend Social/Realtime |
| Ambient Room | `/music/ambient` | `/music`, `/galaxy/ambient-room`, `/galaxy/music` | Web Audio cục bộ; Music Planet cho dự án âm nhạc |
| HH Web Desktop | `/system/desktop` | `/galaxy/web-desktop` | Module Desktop chuyên trách; launcher opt-in, không mount lặp engine tính năng |

Alias chỉ giúp `HHGalaxyDomainViews.canHandle()` nhận route cũ/thử nghiệm. Router chỉ mount Community Showcase chuyên trách tại `/communication/community` và Web Desktop chuyên trách tại `/system/desktop`; mỗi module này cố ý từ chối alias để không che Planet Hub hoặc engine con. Các route engine như `/create/ai-automation` và `/music-ai/ambient-room` cố ý không phải alias.

### Tránh vòng lặp canonical route

Hai view dùng chính route của engine hiện hữu: Automation và Projects. Vì router đã mount Galaxy view tại route đó, CTA chính không được gán lại cùng hash. Các nút này dùng `data-gdv-engine` và gọi `options.openEngine()`:

| Engine ID | Canonical route đang hiển thị | Fallback nếu không truyền `openEngine` |
|---|---|---|
| `automation` | `/work/automation-lab` | `/work/workflow-automation` |
| `projects` | `/work/projects-tasks` | `/work/project-center` |

Router tích hợp nên truyền callback như sau:

```js
openEngine({ id, route, host }) {
  window.HHGalaxyDomainViews.unmount(host);
  if (id === "automation") return window.HHWorkCenter?.mount(host, { view: "automation-lab" });
  if (id === "projects") return window.HHWorkCenter?.mount(host, { view: "projects-tasks" });
  return false;
}
```

Callback trả `false` nếu không xử lý; adapter sẽ điều hướng tới route legacy thật trong cột fallback. Nút nav của view đang mở được `disabled` để không tự mount lại route hiện tại.

Sau khi takeover thành công, router phải giữ hàm cleanup của engine vừa mount và
gọi hàm đó **trước khi** detach host, đổi route hoặc tắt Galaxy Shell. Quy tắc này
ngăn timer/listener của Work Center hay Community tiếp tục chạy trên DOM đã rời cây.

## Trạng thái capability

Mỗi capability chỉ dùng một trong các trạng thái sau:

- `loading`: đang hỏi API trình duyệt hoặc provider.
- `ready`: trình duyệt/provider/engine đã được xác nhận sẵn sàng.
- `empty`: adapter hoạt động nhưng không có dữ liệu thực để hiển thị.
- `offline`: thiết bị ngoại tuyến.
- `permission-required`: được dành cho adapter tích hợp cần quyền người dùng.
- `configuration-required`: chưa có backend, OAuth hoặc provider được xác nhận.
- `unsupported`: trình duyệt không cung cấp API cần thiết.
- `degraded`: hoạt động giới hạn hoặc provider không trả đủ trường.
- `error`: thao tác thực tế đã lỗi.
- `idle`: capability chưa được người dùng chủ động bật.

Không được đổi `configuration-required`, `empty` hoặc `offline` thành `ready` chỉ để giao diện trông đầy đủ.

## Nguồn dữ liệu

Domain adapter chỉ đọc các nguồn cục bộ sau:

- `hh.creative-os.v1`
- `hh-work-center-v2`
- `hh-project-center`

Adapter không ghi lại hoặc migrate ba key trên. Preset Ambient Room, mức mix và thời lượng Pomodoro dùng `hh.galaxy.domain-views.v1`. Web Desktop chuyên trách lưu opt-in/layout vào `hh.galaxy.web-desktop.v1` và ghi chú vào `hh.galaxy.web-desktop.note.v1`.

Project data có thể truyền qua `options.data`. Community Showcase chỉ chuyển sang `ready` sau khi adapter/backend trả payload hợp lệ; `cached` chỉ dùng khi engine Community có `lastSync` và `remotePosts` thực. Nếu thiếu API thì hiển thị `configuration-required`. Lượt thích, follower, leaderboard và số người online không được nội suy hoặc tạo mặc định.

Cloud chỉ được báo `ready` khi integration layer truyền `capabilities.cloud: true` (sau OAuth/provider health check). Dung lượng browser lấy trực tiếp từ `navigator.storage.estimate()`; nếu không có quota thì hiển thị `degraded`, không tạo phần trăm minh họa.

## Ambient Room và Web Audio

`AudioContext` chỉ được tạo sau click vào **Bật âm thanh**. Ambient Room dùng signal procedural trong trình duyệt:

- noise buffer cho mưa, gió và lửa nhỏ;
- oscillator nhẹ cho focus tone;
- `GainNode` thật cho từng slider;
- `AnalyserNode` thật cho waveform.
- phát sự kiện `hh:media-playback` với `{ active, source: "galaxy-ambient-room" }` để Galaxy Shell tạm dừng hiệu ứng nền nặng.

Không tải hoặc phát file âm thanh chưa rõ giấy phép. Nếu khởi tạo/resume lỗi, các node đã tạo được dừng và capability chuyển thành `error`. Khi unmount, mọi source dừng, node được disconnect, animation frame bị hủy, `AudioContext.close()` được gọi và media event chuyển về `active: false`.

Pomodoro dựa trên `Date.now()`/thời điểm kết thúc, không trừ thời gian theo FPS. Vì vậy khi tab ẩn rồi quay lại, thời gian được hiệu chỉnh theo đồng hồ thực.

## Web Desktop Resource Governor

HH Web Desktop mặc định **tắt**. Người dùng phải chọn **Bật Web Desktop**; preference này mới được lưu. Màn hình System chỉ dùng các bằng chứng mà trình duyệt cung cấp như heap JavaScript của tab, storage của origin, connection estimate, battery và Service Worker; không gắn nhãn chúng là CPU/RAM toàn máy.

Resource Governor áp dụng:

- tối đa ba launcher window cùng lúc;
- launcher là preview nhẹ, không mount engine tính năng;
- chỉ window foreground hiển thị trạng thái foreground;
- preview animation tạm dừng khi tab ẩn;
- không tự phát audio/video;
- nút **Đi tới ứng dụng** mới điều hướng đến workspace gốc;
- **Tắt Desktop** đóng launcher và khôi phục trạng thái opt-in về false.

## Lifecycle, accessibility và responsive

- Listener được ghi trong cleanup stack và gỡ khi unmount.
- Timer, RAF, AudioContext và DOM thuộc instance được giải phóng.
- Live region chỉ đọc hành động rời rạc, không đọc lại toàn view.
- Các control có focus ring, tên truy cập và state `aria-pressed`/`aria-current`.
- CSS scope lần lượt trong `[data-gdv-root]`, `[data-gcs-root]` và `[data-gwd-root]`; không sở hữu global `body`, `button`, `input`, `main` hoặc `canvas`.
- Layout chuyển từ multi-column sang một cột ở tablet/mobile; touch controls giữ chiều cao tối thiểu phù hợp.
- Route có `data-galaxy-immersive="true"` sở hữu toàn bộ viewport và thanh điều hướng riêng; dock mobile cũ chỉ bị ẩn trong thời gian route này hoạt động để không che composer hoặc cửa sổ, rồi tự hiện lại ở route thường.
- `prefers-reduced-motion` và forced-colors đều có fallback.

## Nguyên tắc trung thực

Không tạo dữ liệu giả, số người dùng giả, phần trăm tiến độ giả, cloud connection giả, trạng thái online giả hoặc execution log giả. Khi nguồn chưa có dữ liệu, màn hình phải hiện empty/configuration/offline state và cung cấp CTA tới đúng engine hoặc màn hình cấu hình.
