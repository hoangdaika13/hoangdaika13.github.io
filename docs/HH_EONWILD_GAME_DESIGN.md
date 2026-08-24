# HH EonWild · Trái Đất Muôn Thời

## 1. Tuyên ngôn sản phẩm

**HH EonWild** là game sinh tồn động vật nguyên bản của HH Platform. Người chơi sống qua một vòng đời trong hệ sinh thái tự vận hành, từ tìm nước và thức ăn đến trưởng thành, phòng vệ, di cư và duy trì dòng gene. Thế giới chỉ có tự nhiên và động vật từ các thời đại của Trái Đất; **không có con người**.

Mục tiêu dài hạn không phải là nhồi mọi loài vào cùng một bản đồ. Sản phẩm phải tạo được cảm giác mỗi loài có một cách cảm nhận, di chuyển, kiếm ăn và tồn tại khác nhau, đồng thời giữ dữ liệu khoa học có nguồn và hiệu năng phù hợp thiết bị web.

Tên, mã nguồn, giao diện, bản đồ, sinh vật, biểu tượng, âm thanh, cốt truyện và hệ thống kỹ năng của HH EonWild phải được sản xuất nguyên bản hoặc dùng tài nguyên có giấy phép tương thích. “The Isle” chỉ là đối tượng nghiên cứu vòng lặp thể loại, không phải template để sao chép.

## 2. Nguyên tắc không có con người

Quy tắc này là invariant của dữ liệu và gameplay, không chỉ là câu quảng cáo:

- Không có avatar, NPC, bộ xương, giọng nói, phe phái hoặc taxonomy thuộc chi `Homo`.
- Không có thành phố, vũ khí, xe, công trình hoặc phế tích do con người tạo trong thế giới chơi.
- Giao diện “người quan sát” nằm ngoài thế giới hư cấu; nó không biến thành nhân vật trong hệ sinh thái.
- Pipeline nhập taxonomy phải chặn `Homo`, `Homo sapiens`, `human`, `người` và danh sách đồng nghĩa được version hóa.
- Mục dữ liệu bị nghi ngờ phải vào hàng chờ kiểm duyệt, không tự xuất hiện trong Codex hay quần thể AI.
- Test build phải kiểm tra toàn bộ trường định danh/tên của species. Việc thêm một loài vi phạm làm build thất bại.

Không nên dùng mô tả “toàn bộ mọi loài đã từng sống” cho một bản phát hành. Đây là mục tiêu catalog dài hạn không thể được bảo đảm đầy đủ vì taxonomy liên tục thay đổi và hồ sơ hóa thạch không hoàn chỉnh.

## 3. Học gì từ game sinh tồn động vật, không sao chép gì

Trang Steam và các DevBlog chính thức của The Isle cho thấy chiều sâu của thể loại đến từ nhiều hệ thống liên kết: đói, khát, thể lực, trưởng thành, khẩu phần, vùng di cư, làm tổ, AI và áp lực thú săn mồi/con mồi. Những vòng phản hồi này là bài học thiết kế ở mức khái niệm chung.

HH EonWild áp dụng bài học theo cách riêng:

| Bài học thể loại | Cách diễn giải nguyên bản của HH EonWild |
|---|---|
| Sinh tồn cần mục tiêu ngắn hạn rõ | Nước, khẩu phần, nơi trú và vùng di cư xuất hiện như tín hiệu sinh thái, không phải waypoint nhiệm vụ tuyến tính. |
| Trưởng thành tạo giá trị cho một mạng sống | Vòng đời mở dần giác quan, khả năng sinh thái và checkpoint dòng gene. |
| Predator/prey tạo căng thẳng tự nhiên | `Ecology Director` cân bằng sinh khối, nơi trú, mật độ quần thể và xác hữu cơ. |
| Di cư làm thế giới chuyển động | Mùa, thủy văn, nhiệt độ và nguồn thức ăn thay đổi đường di cư theo seed. |
| Loài khác nhau phải chơi khác nhau | Đất–biển–trời cùng giác quan nhiệt, điện trường, áp suất, pheromone, từ trường và định vị âm. |
| Nesting kết nối nhiều vòng đời | Tổ là checkpoint dòng gene và hành vi bảo vệ con non, không phải bản sao màn hình hay luật sinh sản của sản phẩm khác. |

Không được lấy hoặc mô phỏng sát mã nguồn, asset, animation, UI, map, âm thanh, lore, tên kỹ năng, thông số cân bằng hay cách trình bày nhận diện của The Isle. Không reverse-engineer, giải nén hoặc thu thập tài nguyên từ game. Hướng dẫn của U.S. Copyright Office phân biệt ý tưởng/phương pháp chơi với phần biểu đạt có thể được bảo hộ; vì vậy HH EonWild chỉ dùng nguyên lý thể loại ở mức trừu tượng và tự tạo toàn bộ phần biểu đạt cụ thể.

## 4. Ba tầng taxonomy

Một nền tảng lớn cần phân biệt “có trong dữ liệu” với “chơi được ở chất lượng sản phẩm”:

1. **Playable Flagship** — số lượng giới hạn, có locomotion, animation, giác quan, khẩu phần, vòng đời, AI và âm thanh riêng; được QA hoàn chỉnh.
2. **Simulated Wildlife** — loài vận hành trong quần thể AI và lưới thức ăn nhưng chưa có toàn bộ cơ chế điều khiển dành cho người chơi.
3. **Eon Codex** — catalog tra cứu có nguồn, niên đại, phân bố, taxonomy, tình trạng bảo tồn và lịch sử chỉnh sửa; không mặc định trở thành entity trong game.

Chỉ thăng một mục từ Codex lên Simulated Wildlife hoặc Playable Flagship khi có provenance dữ liệu, budget hiệu năng, asset hợp lệ và bộ test hành vi.

## 5. Vertical slice v2 + nền tảng 3D v3 đã triển khai

Content và simulation `2.0.0` vẫn là lõi sinh thái local-first. Game shell `3.0.0` bổ sung renderer 3D tùy chọn nhưng vẫn **không phải MMO, không có model động vật production và không tuyên bố mọi loài đều chơi được**. Bundle được tải theo đúng thứ tự:

1. `hh-eonwild-content-v2.js` — dữ liệu, luật realm, taxonomy tier, gene, diet, injury và giao tiếp.
2. `hh-eonwild-simulation-v2.js` — chunk, spatial hash, Biomass Ledger, Utility AI, fixed timestep, trail, hazard, replay và worker adapter.
3. `hh-eonwild-3d-core.js` — Time Slice, địa chỉ world/chunk, Species Cartridge và renderer Babylon chung.
4. `hh-eonwild-renderer-3d.js` — adapter lifecycle/LOD và bốn proxy 3D chuyên biệt của vertical slice.
5. `hh-eonwild-game.js` — state schema v3, điều phối Babylon/Canvas Lite, input và chín workspace.

### Snapshot triển khai v3 — đọc theo trạng thái, không theo tham vọng

| Hạng mục | Đã có trong repository | Chưa được tuyên bố hoàn tất |
|---|---|---|
| Renderer | Babylon.js `9.22.1` được vendored và tải lazy cùng origin. Engine thử WebGPU trước, nếu khởi tạo thất bại thì tạo WebGL2/WebGL1; Canvas 2D Lite vẫn là đường lui cuối. | WebGPU không phải điều kiện gameplay và không được dùng để suy diễn thiết bị “mạnh”. Không có renderer độc quyền WebGPU. |
| Vertical slice 3D | Bốn proxy procedural chuyên biệt: Tyrannosaurus, Triceratops, Spinosaurus và Pteranodon; terrain, nước, camera góc nhìn thứ ba, ngày/đêm, fog và weather hook đều dùng primitive do dự án tạo. | Chưa có animal GLB production, bộ texture/animation/audio/collision hoàn chỉnh hoặc chất lượng hình ảnh dùng để quảng bá final. |
| Species Cartridge | Có đúng **25 cartridge metadata**: 4 `vertical-slice`, 9 `content-ready` và 12 `roadmap`. Cartridge lưu Time Slice, region, locomotion rig, giác quan, scale, signature, animation-state target và hit-zone target. | `content-ready` hoặc `roadmap` không đồng nghĩa có model, animation hay avatar chơi được. Chỉ bốn cartridge `vertical-slice` có proxy chuyên biệt ở foundation hiện tại. |
| Streaming và chất lượng | World logic rộng 4.096 m; core, adapter và manifest cùng dùng chunk 256 m, giới hạn tối đa 96 resident chunk/tile, có LOD/skirt và queue dựng hữu hạn. Core có preset `static` → `cinematic`; adapter có governor p95 theo cửa sổ 2 giây và hysteresis. | Chunk ID production vẫn cần migration version trước khi physics/navigation và asset pipeline phụ thuộc lâu dài. Adaptive quality chỉ thay render proxy/DPR/LOD, không được xóa ecology entity. |
| Save | Schema `hh.game.eonwild.v3` migrate v1/v2, normalize giới hạn, lưu world address/renderer/quality/game mode; export có checksum và import tạo rollback local trước khi thay save. | Chưa có IndexedDB cho replay lớn, cloud sync hoặc account persistence. |
| Asset provenance | `assets/eonwild/asset-manifest.v1.json` khai báo policy no-human, license/scientific-source/hash/LOD/confidence bắt buộc; Babylon có Apache-2.0 license và third-party notices trong repository. | Manifest hiện có `assets: []` và `productionModelsReady: false`; vì vậy provenance pipeline đã có contract nhưng chưa có animal asset production nào được duyệt. |
| Physics, navigation, network | Proxy hiện di chuyển kinematic từ simulation snapshot; Multiplayer Readiness chỉ hiển thị capability/gate còn thiếu. | **Rapier, Recast, navmesh, authoritative multiplayer server, room/presence và reconciliation vẫn là roadmap**; không module nào được tuyên bố đã tích hợp. |

### Content v2

- Bốn Era Realm tách biệt: `paleozoic`, `mesozoic`, `ice-age`, `modern`.
- 49 mục catalog được chia rõ: 13 Playable Flagship, 30 Simulated Wildlife và 6 Codex-only.
- 13 Flagship cố định: Tyrannosaurus, Triceratops, Argentavis, Orca, Giant Octopus, Spinosaurus, Mammuthus, Wolf, Honeybee, Electric Eel, Ankylosaurus, Blue Whale và Pteranodon.
- Mỗi Flagship có signature và locomotion special riêng; content validator chặn ID trùng, signature trùng và cơ chế locomotion trùng.
- 24 biome, 17 biến động tự nhiên, 6 profile khẩu phần, 7 dạng chấn thương, 10 gene có biên min/max và 12 tín hiệu giao tiếp.
- `Era Realm` là mặc định. Loài khác thời đại chỉ được chấp nhận khi bật `Eon Convergence`; Codex-only không bao giờ được spawn kể cả trong Convergence.
- Catalog có validator chạy ngay khi module khởi tạo; build test yêu cầu `CONTENT_VALIDATION.valid === true`.

### Simulation v2

- Chunk 256 đơn vị tái tạo theo `seed + realm + tọa độ`, giới hạn 256 chunk, 512 entity, 32 tài nguyên và 24 wildlife mỗi chunk.
- Wildlife sinh từ chunk chỉ lấy Playable Flagship hoặc Simulated Wildlife đúng realm; Codex-only không được spawn. Realm Cổ sinh hiện dùng sáu loài Simulated Wildlife và chưa có avatar Flagship riêng cho người chơi.
- Spatial Hash hỗ trợ truy vấn lân cận thay vì quét toàn bộ entity.
- Biomass Ledger có carrying capacity theo biome, tổng population cap và apex cap theo location; spawn vượt budget bị từ chối.
- Utility AI chấm đúng tám hành động: `hunt`, `flee`, `drink`, `feed`, `rest`, `migrate`, `mate`, `guardNest`. Hunt chỉ hồi đói khi tiếp cận và gây sát thương con mồi thật; mate cần cá thể tương thích và capacity còn chỗ để tạo offspring; guardNest chỉ tác động khi có tổ và mối đe dọa gần.
- Fixed timestep mặc định 30 Hz, giới hạn delta và số bước catch-up để tránh tab quay lại làm nghẽn main thread.
- Footprint/Scent Trail có giới hạn bộ nhớ, phân rã theo thời gian và scent trôi theo gió.
- Hazard System có thủy triều, lũ, cháy tự nhiên và núi lửa; cường độ, bán kính, thời gian và số event đều bị clamp.
- Replay dùng ring buffer tối đa 900 frame; Heatmap tối đa 4.096 cell. Game adapter chỉ giữ tối đa 240 replay sample và 256 heatmap cell trong save local để Observer mở lại được mà không phình dữ liệu.
- Worker adapter chỉ chạy command hỗ trợ. Nếu Worker không tồn tại hoặc khởi tạo thất bại, nó chuyển sang local command set giới hạn; không màn đen và không giả WebGPU.

### Game workspace v3

- Chín route trực tiếp: Thế giới sống, Eon Codex, Lưới sinh thái, Eon Atlas, Thám hiểm, Dòng gene, Observer & Replay, Multiplayer Readiness và Cài đặt.
- Renderer mặc định `auto`: chỉ tải Babylon `9.22.1` cùng origin khi bắt đầu hoặc bật 3D. Engine khởi tạo theo thứ tự WebGPU → WebGL2/WebGL1; lỗi khởi tạo quay về Canvas 2D Lite. Canvas Lite vẫn có seed, bốn realm, thời tiết, ngày/đêm, vùng di cư, tài nguyên, quần thể, minimap và adaptive quality. Fallback sau context/device loss ở runtime vẫn cần được harden thành một nhánh idempotent duy nhất trước khi gọi là production-resilient.
- 3D foundation stream terrain theo chunk/LOD và đồng bộ player cùng wildlife từ simulation hiện hữu; nó không tạo một ecology thứ hai. Bốn proxy Tyrannosaurus, Triceratops, Spinosaurus và Pteranodon có hình khối riêng; các cartridge còn lại chỉ có primitive/prototype chung hoặc metadata roadmap và được dán nhãn đúng mức hoàn thiện.
- Mỗi world address gồm Realm → Time Slice → region → chunk → seed. Metadata và hàm validation Time Slice đã có; lọc toàn bộ population/proxy theo address vẫn đang được hoàn thiện, nên v3 foundation chưa tuyên bố isolation địa tầng end-to-end. Eon Convergence vẫn là opt-in hư cấu duy nhất cho phép trộn thời đại.
- Ecology Director tạo một simulation local giới hạn theo seed, stream chunk bằng tọa độ thế giới, chạy fixed-step và hiển thị snapshot Biomass Ledger/Utility AI thật thay cho phần trăm minh họa.
- Vòng sinh tồn gồm máu, đói, khát, stamina, trưởng thành, nhiệt độ, oxy, dinh dưỡng, chất lượng khẩu phần, miễn dịch, chấn thương, ăn/uống, giác quan, phòng vệ, làm tổ và respawn.
- Vòng đời mới tìm điểm spawn theo locomotion/habitat bằng seed: loài trên cạn không còn xuất hiện giữa đại dương, loài nước bắt đầu ở ocean/reef và save đã chết được dựng lại an toàn khi người chơi chủ động bắt đầu vòng đời mới.
- Flagship có ability riêng trên phím R; communication wheel trên C; Photo Mode trên P; điều khiển còn lại dùng WASD/phím mũi tên, Shift, E, Q, F, N, touch D-pad và gamepad.
- Lineage lưu tối đa 24 thế hệ, game replay tối đa 240 mẫu và event journal tối đa 40 mục; mọi trường được normalize trước khi render/lưu.
- Save `hh.game.eonwild.v3` tự đọc và migrate v1/v2, thêm world address, renderer/quality và game mode. Export có checksum; import lưu một bản rollback trước khi thay đổi và vẫn chỉ nằm trên thiết bị.
- Game loop tạm dừng khi tab ẩn. Unmount hủy RAF, observer timer, event listener, ResizeObserver, worker adapter, simulation và AudioContext.
- Multiplayer Readiness fail closed: không có room code, người online, leaderboard hoặc máy chủ giả; capability audit chỉ nói điều kiện còn thiếu.

49 mục catalog không đồng nghĩa 49 implementation bespoke hoàn chỉnh. Content định nghĩa sâu 13 Flagship, nhưng 3D hiện chỉ là procedural prototype và mới có bốn proxy chuyên biệt. 25 Species Cartridge gồm 4 vertical-slice, 9 content-ready và 12 roadmap; đó là metadata sản xuất, **không phải 25 model hoàn thiện**. Mỗi Flagship chỉ được quảng bá là production-ready sau khi GLB, animation, sound, collision, AI, cân bằng và provenance của riêng loài đó qua QA.

## 6. Trụ cột trải nghiệm dài hạn

### Wild Survival

Một mạng sống dài với tài nguyên hữu hạn, tổn thương, bệnh, khí hậu, tuổi già, sinh sản và di cư. Mất cá thể có trọng lượng nhưng không dùng cơ chế trả tiền để cứu mạng.

### Expedition 30 phút

Phiên chơi có mục tiêu sinh thái ngắn, seed tái tạo và kết quả rõ ràng. Đây là lối vào phù hợp người mới và thiết bị yếu.

### Sanctuary

Nhịp chậm, nguy cơ thấp, tập trung khám phá hành vi, chụp ảnh và Codex. Không biến thành chế độ “bất tử” nếu điều đó phá hành vi của quần thể; áp lực được giảm có chủ đích.

### Era Realm

Mỗi realm giữ đúng cửa sổ địa chất, khí hậu, thực vật và nhóm động vật tương ứng. Dữ liệu chưa chắc chắn phải hiển thị mức tin cậy.

### Eon Convergence

Sandbox tùy chọn, được dán nhãn hư cấu, cho phép các thời đại giao nhau. Không dùng kết quả từ chế độ này như thông tin cổ sinh học.

### Observer

Camera quan sát lưới thức ăn, sinh khối, di cư, sinh sản và tuyệt chủng cục bộ mà không tạo một “con người vô hình” trong lore.

## 7. Lộ trình P0–P3 sau v2

Trạng thái dưới đây phân biệt rõ phần đã có trong code với phần còn là kế hoạch.

### P0 — Đã hoàn thành trong v2/v3 foundation

- Route, breadcrumb, lazy loader, Service Worker cache và layout một viewport cho chín workspace.
- Bốn Era Realm, rule isolation mặc định và Convergence opt-in có nhãn hư cấu.
- Content schema v2, validation tự chạy, ba taxonomy tier và đúng 13 Flagship.
- Save schema v3, migration từ v1/v2, checksum/rollback import, clamp dữ liệu và giới hạn lineage/replay/event journal.
- Chunk deterministic, Spatial Hash, Biomass Ledger, Utility AI tám hành động và fixed timestep 30 Hz.
- Trail, hazard, replay ring, heatmap, adaptive quality và bounded worker fallback.
- Input bàn phím/touch/gamepad, focus rõ, target 44 px, reduced motion và forced colors.
- Test no-human, realm isolation, gene bounds, apex cap, deterministic seed, cleanup và fail-closed multiplayer.
- Renderer Babylon 9.22.1 same-origin tùy chọn, WebGPU → WebGL fallback, Canvas Lite, Time Slice/world-address metadata, chunk LOD, adaptive quality, Photo capture render-target và save v3 rollback.

### P1 — Hoàn thiện chất lượng Flagship

- Chuyển 13 profile Flagship thành 13 bộ **GLB production** có LOD, texture, animation, collision, audio và locomotion thực sự khác nhau; hiện 3D mới có bốn proxy procedural chuyên biệt và các cartridge còn lại dùng primitive/metadata.
- Thêm flagship Cổ sinh để Realm Cổ sinh có avatar flagship chơi được thay vì chỉ Simulated/Codex.
- Nâng hành vi tổ, con non, đàn, lãnh thổ, pheromone và call response thành state có tác động dài hạn.
- Gắn diet, injury, gene và communication data v2 sâu hơn vào từng bước simulation thay vì chủ yếu hiển thị/truyền qua game state.
- Tạo editor provenance cho taxonomy, niên đại, habitat và nguồn; kiểm duyệt trước khi nâng tier.
- Bổ sung test soak hàng giờ, replay regression và visual regression ở 375/768/desktop.

### P2 — Streaming, lưu trữ và công cụ sản xuất

- Chuyển save/replay lớn sang IndexedDB; localStorage chỉ giữ preference và con trỏ phiên nhỏ.
- Worker hóa simulation/chunk thật với protocol schema + sequence; hiện worker assist chỉ xử lý command giới hạn và phần còn lại dùng local fallback.
- OffscreenCanvas tùy chọn cho terrain/minimap; main thread ưu tiên input và accessibility UI.
- Version hóa world/chunk contract 256 m và thêm migration rõ ràng trước khi physics, navigation hoặc save production phụ thuộc vào chunk ID.
- Chunk level-of-detail, entity pooling, AI tick thưa ngoài vùng quan tâm và navigation riêng cho đất/biển/trời.
- Đánh giá rồi mới tích hợp Rapier cho physics bubble và Recast cho navigation mesh theo capability/budget. Hiện không bundle Rapier, không bundle Recast và không có navmesh runtime.
- Observer nâng thành timeline có scrub, filter species, food-web overlay, export replay và ghost local.
- Content pack có version, manifest, hash, license, migration và giới hạn giải nén.
- PWA offline cho Codex, save và Expedition; đồng bộ tài khoản là opt-in riêng.

### P3 — Realtime authoritative tùy chọn, chưa triển khai

- Chỉ mở multiplayer sau khi có auth/signaling thật, token phòng ngắn hạn, **server-authoritative simulation** và reconnect/resync; client v3 hiện không có authority server để xác nhận state.
- Bắt đầu bằng shard 20–32 người; room invite-only/bạn bè/public có quyền host, player, observer rõ ràng.
- Interest management theo chunk, snapshot delta có sequence, client prediction và server reconciliation.
- Moderation, report, block, rate limit, audit event, anti-replay và chống client tampering.
- Không chia sẻ location, account ID, save hoặc telemetry ngoài scope phòng đã consent.
- WebGPU chỉ là accelerator tùy chọn sau feature detection; Canvas 2D/WebGL fallback vẫn bắt buộc.
- Chỉ gọi sản phẩm là persistent world/MMO sau load test, chaos/reconnect test, security review và kiểm soát chi phí vận hành.

## 8. Kiến trúc v3 thực tế

```text
App Shell / #/game/*
        |
Performance Loader
  ├─ hh-eonwild-content-v2.js
  ├─ hh-eonwild-simulation-v2.js
  ├─ hh-eonwild-3d-core.js
  ├─ hh-eonwild-renderer-3d.js
  └─ hh-eonwild-game.js + CSS
        |
Vendored runtime + provenance
  ├─ vendor/babylon-9.22.1.js + Apache-2.0 notices
  └─ assets/eonwild/asset-manifest.v1.json
        |
Game workspace / state schema v3
  ├─ keyboard + touch + gamepad
  ├─ Babylon 3D optional + Canvas 2D Lite + minimap + observer
  └─ localStorage v3 + migration v1/v2 + checksum/rollback
        |
Simulation v2 (pure/bounded core)
  ├─ deterministic chunks + Spatial Hash
  ├─ Biomass Ledger + Utility AI
  ├─ fixed 30 Hz + conditions + hazards
  └─ trails + heatmap + replay ring
        |
Worker adapter
  ├─ supported command → dedicated Worker when available
  └─ unsupported/unavailable → bounded local fallback
```

### Biên module

- `hh-eonwild-content-v2.js` không cần DOM và xuất object đã freeze. Các hàm realm/gene/diet/injury/communication là pure, nên có thể dùng trong test, worker hoặc công cụ biên tập.
- `hh-eonwild-simulation-v2.js` không mount giao diện và không gọi network. Seed, chunk, utility score và fixed-step có thể tái tạo độc lập.
- `hh-eonwild-3d-core.js` chứa metadata Time Slice/Species Cartridge và runtime Babylon dùng chung; `hh-eonwild-renderer-3d.js` tăng độ sâu cho bốn proxy nhưng không thay simulation.
- `assets/eonwild/asset-manifest.v1.json` là cổng provenance cho asset production. Trạng thái `assets: []` và `productionModelsReady: false` là chủ đích trung thực, không phải dữ liệu bị thiếu được phép bỏ qua.
- `hh-eonwild-game.js` là adapter trình duyệt: đọc content/simulation/renderer globals, chuẩn hóa save, gắn input, render và dọn tài nguyên khi unmount.
- `performance-loader.js` bắt buộc tải content → simulation → 3D core → 3D adapter → game theo thứ tự. `sw.js` version hóa các module; runtime Babylon lớn chỉ được request/cache sau lần người chơi thực sự bật 3D.

### Budget đang được áp dụng

- Simulation: 30 fixed steps/giây, delta tối đa 0,25 giây và tối đa 8 bước catch-up mỗi tick.
- Simulation streaming: chunk 256 m; tối đa 256 chunk và 512 entity trong một simulation.
- Babylon core, adapter và asset manifest cùng dùng chunk 256 m; tối đa 96 resident chunk/tile và queue pending tối đa 128.
- Mỗi chunk: tối đa 32 resource và 24 wildlife.
- Dấu vết: tối đa 4.096 footprint và 4.096 scent trong core; từng UI/session có thể đặt cap thấp hơn.
- Replay core: 900 frame; game save: 240 mẫu. Heatmap core tối đa 4.096 cell, còn save/UI giữ tối đa 256 cell.
- Canvas giới hạn DPR theo mobile/desktop; adaptive quality giảm DPR và số wildlife được vẽ mỗi frame khi FPS thấp, nhưng không xóa entity khỏi simulation.
- Khi tab ẩn, gameplay update dừng. Khi đổi route, controller, RAF, timer, ResizeObserver, Worker, simulation và audio đều được đóng.

### Giới hạn cần nói đúng

- Persistence hiện là localStorage schema v3 có migration v1/v2, checksum import và một rollback slot; chưa phải IndexedDB hay cloud sync.
- Worker adapter là worker assist với command allowlist, chưa chuyển toàn bộ simulation sang Worker/OffscreenCanvas.
- Renderer 3D hiện chỉ dùng terrain/proxy procedural. Không có animal GLB/texture/animation production; không tích hợp Rapier, Recast hoặc navmesh. WebGPU là tùy chọn; WebGL và Canvas Lite vẫn là fallback.
- 25 Species Cartridge chỉ là các mức metadata `vertical-slice`/`content-ready`/`roadmap`; chỉ bốn loài có proxy procedural chuyên biệt và không loài nào có manifest asset production đã duyệt.
- World address/Time Slice đã có schema và validation, nhưng lọc population/proxy end-to-end theo address vẫn cần hoàn thiện trước khi tuyên bố cách ly địa tầng hoàn toàn.
- Observer dùng replay local, không quan sát máy chủ hoặc người chơi khác.
- Network workspace chỉ là readiness gate; không có authoritative multiplayer backend, room, online presence, prediction/reconciliation hoặc server persistence.

## 9. An toàn, bảo mật và riêng tư

- Client không chứa token, secret, khóa dịch vụ hay credential database.
- Không dùng `eval`, `new Function`, script từ content pack hoặc HTML chưa escape.
- Seed, save, tên pack và metadata phải được chuẩn hóa, giới hạn độ dài/số lượng và migrate theo schema.
- Content pack public cần chữ ký/manifest, hash asset, loại MIME cho phép và kiểm tra decompression bomb.
- CSP hạn chế script/connect/media; asset bên thứ ba cần allowlist và Subresource Integrity khi phù hợp.
- Save cục bộ không được tuyên bố là đồng bộ cloud. Đồng bộ chỉ bật sau consent, mã hóa đường truyền và cơ chế xóa/export.
- Multiplayer tương lai xác thực từng room/action, dùng server-authoritative score/state, rate limit và giới hạn payload WebSocket.
- Không hiển thị người online, leaderboard, phòng hoặc cá thể giả khi chưa có backend xác thực.
- Không đưa vị trí thật, ID tài khoản hoặc dữ liệu thiết bị vào world seed.

## 10. Dữ liệu, bản quyền và giấy phép

- Dữ liệu taxonomy lấy từ nguồn chính thức phải lưu `source`, `sourceId`, `license`, `retrievedAt`, `editorStatus` và version.
- Catalogue of Life Base Release nên là backbone taxonomy; Extended Release chỉ dùng tìm ứng viên vì ưu tiên độ phủ. Pin release key/DOI, accepted ID, synonym và source dataset.
- Paleobiology Database cung cấp bằng chứng occurrence theo thời gian/không gian, collection, địa tầng và môi trường; occurrence không được suy diễn thẳng thành mật độ, tốc độ, hành vi, màu hoặc quan hệ săn mồi.
- GBIF dùng để resolve taxonomy/phân bố hiện đại. Licence thuộc từng dataset và media có licence riêng; không giả định mọi ảnh hoặc occurrence có cùng licence.
- Pipeline sản xuất là snapshot → normalize ID → provenance/licence theo trường → confidence gate → review → datapack versioned. Game không gọi các API khoa học ở runtime.

Trạng thái provenance trong repository v3:

- Manifest `hh-eonwild-asset-manifest` version 1 đặt `humanContentAllowed: false`, `unknownLicenseAllowed: false`, `externalRuntimeAssetsAllowed: false` và yêu cầu nguồn khoa học cùng mức tin cậy reconstruction.
- Babylon.js `9.22.1` được vendored với Apache-2.0 license và third-party notices riêng; loader production mặc định dùng URL cùng origin.
- Mỗi asset tương lai phải có ít nhất ID, source URL, tác giả, license, nguồn khoa học, era/Time Slice, scale thật, model version, LOD, texture budget, SHA-256, lịch sử chỉnh sửa và reconstruction confidence.
- Mảng `assets` hiện rỗng và `productionModelsReady` là `false`. Bốn animal proxy procedural không được ghi thành GLB production hoặc dùng để chứng minh pipeline asset đã hoàn tất.

| Nguồn | Vai trò trong datapack | Xử lý licence/attribution | Không được suy diễn |
|---|---|---|---|
| Catalogue of Life Base Release | Backbone accepted taxon, synonym và stable ID | Pin release key + DOI; giữ citation và licence nguồn thành phần | Không coi catalog là hoàn chỉnh hoặc tự động nâng loài thành playable |
| Paleobiology Database v1.2 | Occurrence hóa thạch, địa tầng, niên đại, vị trí và môi trường | Lưu reference, provenance và licence của snapshot/bản ghi; không nhầm licence mã API với dữ liệu | Không suy ra mật độ quần thể, tốc độ, hành vi, màu hoặc quan hệ săn mồi từ occurrence |
| GBIF Species/Occurrence | Resolve tên hiện đại và hỗ trợ phân bố/habitat | Giữ `datasetKey`, licence CC0/CC BY/CC BY-NC và attribution; media có licence riêng | Không dùng search result biến đổi theo thời gian như một snapshot có DOI |

Budget mở rộng hợp lý là 16–24 Playable Flagship qua nhiều release, 150–300 Simulated Wildlife trước khi tăng tới 500–1.000, và 10.000–50.000 taxon Codex index offline theo release. Chỉ tier Flagship mới hứa locomotion, animation, âm thanh, sinh sản, diet, injury và giác quan bespoke; catalog không tự spawn.
- Tên khoa học và dữ kiện không cho phép sao chép nguyên bộ mô tả, ảnh minh họa hoặc cấu trúc database có bảo hộ/điều khoản riêng.
- Asset chỉ được nhận nếu do HH tự tạo, commissioned với chuyển giao quyền, public domain, hoặc có license thương mại tương thích và attribution đầy đủ.
- Không lấy ảnh từ Google Images, video YouTube, mod, wiki hoặc game khác chỉ vì chúng có thể tải được.
- EULA/điều khoản của The Isle và Steam phải được tôn trọng; nghiên cứu chỉ dựa trên tài liệu công khai, không trích xuất client/game asset.
- “The Isle” không xuất hiện trong tên route, marketing, logo, store metadata hoặc UI người dùng của HH EonWild.

## 11. Nguồn nghiên cứu chính thức

Truy cập và kiểm tra ngày 24-08-2026; đường dẫn hoặc nội dung sản phẩm bên ngoài có thể thay đổi:

- [The Isle — trang sản phẩm chính thức trên Steam](https://store.steampowered.com/app/376210/The_Isle/)
- [The Isle — Steam Community Announcements chính thức](https://store.steampowered.com/oldnews/?appgroupname=The+Isle&appids=376210&feed=steam_community_announcements&headlines=1)
- [DevBlog/changelog chính thức — stress test, quality-of-life và diet/migration](https://store.steampowered.com/news/posts/?appgroupname=The+Isle&appids=376210&enddate=1722470987&feed=steam_community_announcements)
- [DevBlog chính thức — migration, diet, nesting và cấu hình AI](https://store.steampowered.com/news/posts/?appgroupname=The+Isle&appids=376210&enddate=1740766575&feed=steam_community_announcements)
- [The Isle — app EULA trên Steam](https://store.steampowered.com/eula/376210_eula_0?eulaLang=english)
- [U.S. Copyright Office — Games](https://www.copyright.gov/register/tx-games.html)
- [U.S. Copyright Office — Circular 61: Copyright Registration of Computer Programs](https://www.copyright.gov/circs/circ61.pdf)
- [Catalogue of Life — data download](https://www.catalogueoflife.org/data/download)
- [Paleobiology Database — Data Service v1.2](https://paleobiodb.org/data1.2/)
- [GBIF — Species API](https://techdocs.gbif.org/en/openapi/v1/species)
- [GBIF — data use agreement](https://www.gbif.org/terms/data-user)
- [Babylon.js — package và giấy phép](https://www.npmjs.com/package/babylonjs)
- [W3C — WebGPU specification](https://www.w3.org/TR/webgpu/)
- [MDN — OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [MDN — WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [MDN — IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

Các nguồn trên dùng để định hướng thể loại, tiêu chuẩn kỹ thuật và provenance. Chúng không cấp quyền sao chép nội dung hay tài sản của sản phẩm khác.

## 12. Definition of Done cho mỗi loài

Một loài chỉ được đánh dấu Playable Flagship khi:

- Taxonomy, thời đại, habitat, diet và provenance được biên tập/duyệt.
- Không vi phạm no-human rule và không tạo mixed-era ngoài Convergence.
- Có locomotion, collision, stamina, ăn/uống, giác quan, phòng vệ, âm thanh và vòng đời riêng.
- AI cùng loài và AI đối thủ phản ứng hợp lý; không spawn vô hạn hoặc phá Biomass Ledger.
- Có input bàn phím, touch, gamepad; focus và thông tin không phụ thuộc duy nhất vào màu/âm thanh.
- Giữ frame budget trên desktop/mobile mục tiêu và dọn sạch resource khi unmount.
- Save/replay deterministic qua migration schema được hỗ trợ.
- Asset/license/attribution hoàn tất và không chứa nội dung lấy từ game khác.
- Test unit, simulation soak, visual regression và accessibility đều qua.
