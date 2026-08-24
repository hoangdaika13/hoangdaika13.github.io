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

## 5. Vertical slice v2 đã triển khai

Phiên bản web `2.0.0` là vertical slice local-first có simulation core thật, nhưng vẫn **không phải MMO, game 3D hay tuyên bố mọi loài đều chơi được**. Bundle được tải theo đúng thứ tự:

1. `hh-eonwild-content-v2.js` — dữ liệu, luật realm, taxonomy tier, gene, diet, injury và giao tiếp.
2. `hh-eonwild-simulation-v2.js` — chunk, spatial hash, Biomass Ledger, Utility AI, fixed timestep, trail, hazard, replay và worker adapter.
3. `hh-eonwild-game.js` — state schema v2, Canvas 2D, input, renderer và chín workspace.

### Content v2

- Bốn Era Realm tách biệt: `paleozoic`, `mesozoic`, `ice-age`, `modern`.
- 49 mục catalog được chia rõ: 12 Playable Flagship, 31 Simulated Wildlife và 6 Codex-only.
- 12 Flagship cố định: Tyrannosaurus, Triceratops, Argentavis, Orca, Giant Octopus, Spinosaurus, Mammuthus, Wolf, Honeybee, Electric Eel, Ankylosaurus và Blue Whale.
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

### Game workspace v2

- Chín route trực tiếp: Thế giới sống, Eon Codex, Lưới sinh thái, Eon Atlas, Thám hiểm, Dòng gene, Observer & Replay, Multiplayer Readiness và Cài đặt.
- Canvas 2D top-down có seed, bốn realm, thời tiết, ngày/đêm, vùng di cư, tài nguyên, quần thể, minimap và adaptive quality. Ecology Director tạo một simulation local giới hạn theo seed, stream chunk bằng tọa độ thế giới, chạy fixed-step và hiển thị snapshot Biomass Ledger/Utility AI thật thay cho phần trăm minh họa.
- Vòng sinh tồn gồm máu, đói, khát, stamina, trưởng thành, nhiệt độ, oxy, dinh dưỡng, chất lượng khẩu phần, miễn dịch, chấn thương, ăn/uống, giác quan, phòng vệ, làm tổ và respawn.
- Vòng đời mới tìm điểm spawn theo locomotion/habitat bằng seed: loài trên cạn không còn xuất hiện giữa đại dương, loài nước bắt đầu ở ocean/reef và save đã chết được dựng lại an toàn khi người chơi chủ động bắt đầu vòng đời mới.
- Flagship có ability riêng trên phím R; communication wheel trên C; Photo Mode trên P; điều khiển còn lại dùng WASD/phím mũi tên, Shift, E, Q, F, N, touch D-pad và gamepad.
- Lineage lưu tối đa 24 thế hệ, game replay tối đa 240 mẫu và event journal tối đa 40 mục; mọi trường được normalize trước khi render/lưu.
- Save `hh.game.eonwild.v2` tự đọc và migrate dữ liệu từ `hh.game.eonwild.v1`, nhưng vẫn chỉ nằm trên thiết bị.
- Game loop tạm dừng khi tab ẩn. Unmount hủy RAF, observer timer, event listener, ResizeObserver, worker adapter, simulation và AudioContext.
- Multiplayer Readiness fail closed: không có room code, người online, leaderboard hoặc máy chủ giả; capability audit chỉ nói điều kiện còn thiếu.

49 mục catalog không đồng nghĩa 49 implementation bespoke hoàn chỉnh. V2 định nghĩa sâu 12 Flagship ở content layer, còn renderer top-down vẫn dùng chung nhiều primitive. Mỗi Flagship chỉ được quảng bá là production-ready sau khi animation, sound, collision, AI, cân bằng và provenance của riêng loài đó qua QA.

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

### P0 — Đã hoàn thành trong v2

- Route, breadcrumb, lazy loader, Service Worker cache và layout một viewport cho chín workspace.
- Bốn Era Realm, rule isolation mặc định và Convergence opt-in có nhãn hư cấu.
- Content schema v2, validation tự chạy, ba taxonomy tier và đúng 12 Flagship.
- Save schema v2, migration từ v1, clamp dữ liệu và giới hạn lineage/replay/event journal.
- Chunk deterministic, Spatial Hash, Biomass Ledger, Utility AI tám hành động và fixed timestep 30 Hz.
- Trail, hazard, replay ring, heatmap, adaptive quality và bounded worker fallback.
- Input bàn phím/touch/gamepad, focus rõ, target 44 px, reduced motion và forced colors.
- Test no-human, realm isolation, gene bounds, apex cap, deterministic seed, cleanup và fail-closed multiplayer.

### P1 — Hoàn thiện chất lượng Flagship

- Chuyển 12 profile content thành 12 bộ animation/collision/audio/locomotion thực sự khác nhau; hiện renderer còn chia sẻ primitive top-down.
- Thêm flagship Cổ sinh để Realm Cổ sinh có avatar flagship chơi được thay vì chỉ Simulated/Codex.
- Nâng hành vi tổ, con non, đàn, lãnh thổ, pheromone và call response thành state có tác động dài hạn.
- Gắn diet, injury, gene và communication data v2 sâu hơn vào từng bước simulation thay vì chủ yếu hiển thị/truyền qua game state.
- Tạo editor provenance cho taxonomy, niên đại, habitat và nguồn; kiểm duyệt trước khi nâng tier.
- Thêm export/import save v2 có checksum, preview và rollback; không ghi đè âm thầm.
- Bổ sung test soak hàng giờ, replay regression và visual regression ở 375/768/desktop.

### P2 — Streaming, lưu trữ và công cụ sản xuất

- Chuyển save/replay lớn sang IndexedDB; localStorage chỉ giữ preference và con trỏ phiên nhỏ.
- Worker hóa simulation/chunk thật với protocol schema + sequence; hiện worker assist chỉ xử lý command giới hạn và phần còn lại dùng local fallback.
- OffscreenCanvas tùy chọn cho terrain/minimap; main thread ưu tiên input và accessibility UI.
- Chunk level-of-detail, entity pooling, AI tick thưa ngoài vùng quan tâm và navigation riêng cho đất/biển/trời.
- Observer nâng thành timeline có scrub, filter species, food-web overlay, export replay và ghost local.
- Content pack có version, manifest, hash, license, migration và giới hạn giải nén.
- PWA offline cho Codex, save và Expedition; đồng bộ tài khoản là opt-in riêng.

### P3 — Realtime tùy chọn, chưa triển khai

- Chỉ mở multiplayer sau khi có auth/signaling thật, token phòng ngắn hạn, server-authoritative simulation và reconnect/resync.
- Bắt đầu bằng shard 20–32 người; room invite-only/bạn bè/public có quyền host, player, observer rõ ràng.
- Interest management theo chunk, snapshot delta có sequence, client prediction và server reconciliation.
- Moderation, report, block, rate limit, audit event, anti-replay và chống client tampering.
- Không chia sẻ location, account ID, save hoặc telemetry ngoài scope phòng đã consent.
- WebGPU chỉ là accelerator tùy chọn sau feature detection; Canvas 2D/WebGL fallback vẫn bắt buộc.
- Chỉ gọi sản phẩm là persistent world/MMO sau load test, chaos/reconnect test, security review và kiểm soát chi phí vận hành.

## 8. Kiến trúc v2 thực tế

```text
App Shell / #/game/*
        |
Performance Loader
  ├─ hh-eonwild-content-v2.js
  ├─ hh-eonwild-simulation-v2.js
  └─ hh-eonwild-game.js + CSS
        |
Game workspace / state schema v2
  ├─ keyboard + touch + gamepad
  ├─ Canvas 2D + minimap + observer
  └─ localStorage v2 + migration v1
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
- `hh-eonwild-game.js` là adapter trình duyệt: đọc content/simulation globals, chuẩn hóa save, gắn input, render và dọn tài nguyên khi unmount.
- `performance-loader.js` bắt buộc tải content → simulation → game theo thứ tự. `sw.js` cache cả bốn asset EonWild đã version hóa.

### Budget đang được áp dụng

- Simulation: 30 fixed steps/giây, delta tối đa 0,25 giây và tối đa 8 bước catch-up mỗi tick.
- Streaming: chunk 256 đơn vị; tối đa 256 chunk và 512 entity trong một simulation.
- Mỗi chunk: tối đa 32 resource và 24 wildlife.
- Dấu vết: tối đa 4.096 footprint và 4.096 scent trong core; từng UI/session có thể đặt cap thấp hơn.
- Replay core: 900 frame; game save: 240 mẫu; heatmap: 4.096 cell.
- Canvas giới hạn DPR theo mobile/desktop; adaptive quality giảm DPR và số wildlife được vẽ mỗi frame khi FPS thấp, nhưng không xóa entity khỏi simulation.
- Khi tab ẩn, gameplay update dừng. Khi đổi route, controller, RAF, timer, ResizeObserver, Worker, simulation và audio đều được đóng.

### Giới hạn cần nói đúng

- Persistence hiện là localStorage schema v2, chưa phải IndexedDB hay cloud sync.
- Worker adapter là worker assist với command allowlist, chưa chuyển toàn bộ simulation sang Worker/OffscreenCanvas.
- Renderer hiện là Canvas 2D top-down, không có WebGPU/3D.
- Observer dùng replay local, không quan sát máy chủ hoặc người chơi khác.
- Network workspace chỉ là readiness gate; không có backend multiplayer, room hoặc online presence.

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
- Catalogue of Life và GBIF có điều khoản/giấy phép theo dataset. Không giả định mọi ảnh hoặc occurrence có cùng license; kiểm tra ở cấp record/dataset trước khi phân phối.
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
- [GBIF — Species API](https://www.gbif.org/developer/species)
- [GBIF — data use agreement](https://www.gbif.org/terms/data-user)
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
