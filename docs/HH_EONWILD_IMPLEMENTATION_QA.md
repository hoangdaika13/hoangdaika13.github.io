# HH EonWild — Implementation & QA report

Trạng thái ghi nhận ngày **2026-08-25** trên nhánh `main`. Báo cáo này phân biệt rõ dữ liệu tra cứu, hệ thống procedural, prototype và nội dung production; không phải chứng nhận AAA, photoreal hoặc mô phỏng hành tinh hoàn chỉnh.

## Phạm vi đã triển khai

- UI hardening cuối cascade cho font tiếng Việt, text wrapping, focus-visible, safe-area, touch target 44 px, reduced motion, mobile/4K và vùng cuộn riêng.
- Input Action System độc lập renderer cho keyboard, gamepad và touch: 15 action, preset, remap, phát hiện trùng, deadzone, buffer, persistence có giới hạn và cleanup.
- World Atlas gồm 26 khung bản đồ, 5 realm, logical planet address, floating origin, chunk priority planner và IndexedDB discovery fog.
- Species Registry gồm đúng 300 taxon Animalia nhập từ iNaturalist. Sau khi hợp nhất 3 tên khoa học trùng catalog cũ, Codex có **346 tên khoa học duy nhất**; 297 taxon mới không trùng được hiển thị trong registry mở rộng.
- Loader và Service Worker tải đúng thứ tự và precache kernel EonWild same-origin; Canvas Lite tiếp tục là fallback.
- Pause xử lý trước các action gameplay và loại bỏ buffer cùng frame. F/Q/R/Space và các nút touch không còn thay đổi game trong lúc pause.
- Atlas telemetry gọi đúng `wanted` là **atlas ưu tiên**, không giả là tile đã tải/render. Discovery fog chỉ ghi chunk người chơi thực sự đứng trong đó.
- Map `atlas-reference-only` luôn giữ route `#/game/timeline`; Quick Play không dựng sai region hoặc sai thời đại.

## Kiến trúc chính

| Thành phần | Tệp | Trạng thái |
| --- | --- | --- |
| Game shell, integration, save v4 | `hh-eonwild-game.js` | Runtime |
| Typography, HUD, responsive/accessibility | `hh-eonwild-game.css` | Runtime |
| Input Action System | `hh-eonwild-input-system.js` | Runtime, local-first |
| Planet Atlas và streaming planner | `hh-eonwild-world-atlas.js` | Planner/reference layer |
| Registry 300 taxon | `hh-eonwild-species-registry.js` | Catalog-only |
| Registry sync | `scripts/sync-eonwild-species-registry.js` | Node tool, không chạy trong browser |
| Asset provenance | `assets/eonwild/asset-manifest.v1.json` | Fail-closed validator |

`Planet → Realm → map/region → logical sector → chunk` là không gian địa chỉ và lập kế hoạch. Renderer hiện chỉ dựng active region khoảng 16 × 16 km; planner không được gọi là planet streaming đã hoàn chỉnh.

## Kiểm thử tự động

| Lệnh | Kết quả cuối |
| --- | --- |
| `npm run test:eonwild` | 174/174 đạt |
| `npm run test:security` | 14/14 đạt |
| `npm run test:security:full` | 100/100 đạt |
| `npm run audit:prod` | 0 vulnerability production |
| `npm run validate:eonwild-assets` | Đạt, có cảnh báo prototype/placeholder trung thực |
| `node --check` cho JS thay đổi | Đạt |
| `git diff --check` | Đạt; chỉ có cảnh báo line-ending LF/CRLF của Git |

Full `npm audit` vẫn báo 30 vulnerability dev-only trong toolchain Vercel: 1 low, 6 moderate, 22 high, 1 critical. Không chạy `npm audit fix --force` vì npm đề xuất nâng Vercel theo breaking change. Xem báo cáo security/provenance riêng.

## Browser QA thực tế

Môi trường: Codex in-app browser, static server local, guest session, build loader v537, game v18. Các 404 của `/_vercel/*` và `/api/health` chỉ xuất hiện trong access log của static server; console browser kết thúc với **0 warning và 0 error**.

### Responsive và scroll

World view đã được đo ở 375×812, 1366×768, 1920×1080, 2560×1440 và 3840×2160:

- Không viewport nào có horizontal document overflow.
- Luôn chỉ có một `[data-hwe-root]`.
- Mobile dùng `.hwe-main { overflow-y: auto }`; desktop world vừa đúng vùng khả dụng và không tạo page scroll ngoài ý muốn.
- Nav desktop hẹp và mobile dùng horizontal scroll thay vì bẻ hoặc cắt giữa từ.

Atlas ở 375×812:

- 26 card đều tồn tại.
- Grid một cột 311 px.
- Vùng main `clientHeight 612`, `scrollHeight 12106`, `overflow-y: auto`.
- Touch target nhỏ nhất đo được là 44 px.

Codex ở 1366×768:

- `.hwe-library`: `clientHeight 477`, `scrollHeight 1620`, `overflow-y: auto`.
- `.hwe-codex-layout` cao 480 px, không còn collapse về 0.
- Thẻ loài đầu tiên hit-test đúng vào button.
- Registry hiển thị 297 taxon mới không trùng; tìm “gấu mèo” trả đúng một kết quả và mở metadata `Procyon lotor`.

Settings ở 375×812:

- Input bindings một cột 295 px.
- Select rộng 299 px; không còn select 24–36 px.
- Main có overflow nội bộ và xem được hết nội dung dài.

### Hành vi runtime

- Chọn map active chuyển sang `#/game/world`; map reference-only và Quick Play giữ `#/game/timeline`.
- Remap `MoveForward` từ `W` sang `I` tồn tại sau đổi route; nút reset đưa về `W`.
- Khi pause, click Interact/Sense/Ability không thay đổi health, hunger, thirst, stamina, growth, oxygen, nutrition hoặc diet quality.
- QA clean-origin trước patch guard cuối đã đổi route 10 vòng và giữ một root; canvas trở về đúng số lượng theo từng view, không tăng dần. Patch cuối chỉ thay pause/Atlas routing và có regression test riêng.

### Telemetry đo thật

Một mẫu 5 giây tại 1366×768, WebGL2 Balanced, active late-Cretaceous region:

- FPS hiển thị: **36–38 FPS**.
- 38 wildlife active.
- 71 draw call.
- 146K triangle.
- khoảng 56 MiB VRAM ước tính bởi renderer.
- 92 vegetation instance tại thời điểm mẫu.

Đây là một phép đo trong browser/runtime hiện tại, không đại diện mọi thiết bị. Mục tiêu 60 FPS chưa được chứng minh và không được báo đạt.

## Chưa xác minh hoặc chưa hoàn thành

- Chưa có 20 phút playtest liên tục sau bản sửa cuối.
- Không có gamepad vật lý để xác minh rung/deadzone thực tế; contract và input tests đạt.
- Browser QA cuối chạy WebGL2; WebGPU và Canvas Lite có automated fallback tests nhưng chưa được benchmark trực quan trong ma trận cuối.
- Zoom 200% thật không được điều khiển; đã kiểm tra trước bằng viewport CSS tương đương 683×384 và có contract zoom/reflow.
- Có 0 creature model production-approved. Hai Quaternius GLB chỉ là CC0 low-poly prototype; hai loài còn lại trong vertical slice vẫn procedural placeholder.
- 300 taxon nhập mới đều catalog-only, không phải 300 NPC/model/playable.
- Atlas chưa nhập GIS/reconstruction tile được pin version/checksum; terrain gameplay vẫn procedural.
- Renderer active region vẫn khoảng 16 × 16 km; planet scale hiện là logical addressing và priority planner.

Không được nâng các tuyên bố trên thành production, photoreal, AAA, 300 NPC hoặc planet streaming hoàn chỉnh nếu chưa bổ sung asset/source/benchmark và kiểm thử tương ứng.
