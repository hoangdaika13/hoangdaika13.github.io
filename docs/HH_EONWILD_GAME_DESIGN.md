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

## 5. Vertical slice hiện tại

Phiên bản web `1.0.0` là một vertical slice local-first, không phải MMO hoàn chỉnh:

- 49 loài đại diện trải trên bốn nhóm thời đại: Cổ sinh, Trung sinh, Tân sinh và hiện đại.
- Tám biome procedural: đại dương, rạn biển, đầm lầy, rừng, đồng cỏ, hoang mạc, tundra và núi lửa.
- Sáu workspace trực tiếp: Thế giới sống, Eon Codex, Lưới sinh thái, Eon Atlas, Thám hiểm và Cài đặt.
- Canvas 2D top-down với seed tái tạo, chu kỳ ngày/đêm, thời tiết, vùng di cư, tài nguyên và quần thể predator/prey đơn giản.
- Vòng sinh tồn thật gồm máu, đói, khát, stamina, trưởng thành, ăn/uống, giác quan, phòng vệ, tạo tổ, respawn và năm expedition.
- Điều khiển bằng WASD/phím mũi tên, Shift, E, Q, F, N, touch D-pad và gamepad.
- Save schema `hh.game.eonwild.v1` được chuẩn hóa và giới hạn trước khi sử dụng.
- Animation/game loop tạm dừng khi tab ẩn; unmount hủy RAF, listener và ResizeObserver.

Các loài trong slice hiện là avatar có thể chọn trên cùng một mô hình gameplay hệ thống. Điều đó **không có nghĩa 49 loài đã có behavior/animation bespoke ở chất lượng Playable Flagship**. Dữ liệu khối lượng, tốc độ, niên đại và mô tả hiện chỉ phục vụ prototype; phải được biên tập khoa học trước khi dùng như nội dung giáo dục chính thức.

`Eon Convergence` là sandbox giả tưởng cho việc gặp loài khác thời đại. Chế độ khoa học mặc định trong bản trưởng thành phải tách Era Realm theo niên đại và ghi rõ mọi ngoại lệ.

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

## 7. Lộ trình P0–P3

### P0 — Hoàn thiện vertical slice

- Hoàn tất route, lazy loader, cache và layout một viewport trên desktop/mobile.
- Tách realm theo era; chỉ bật mixed-era khi người chơi chủ động chọn Convergence.
- Chuẩn hóa save migration, giới hạn dữ liệu, export/import và phục hồi bản trước.
- Spatial hash cho AI/tài nguyên thay cho sắp xếp toàn bộ entity mỗi tương tác.
- Fixed timestep cho simulation; render có interpolation và giới hạn delta khi tab quay lại.
- Trạng thái pause/resume rõ, focus không mất, touch target tối thiểu 44 px và reduced motion.
- Bộ test taxonomy no-human, seed deterministic, vitals bounded, lifecycle cleanup và không có network giả.

### P1 — Chiều sâu sinh thái

- Chọn 8–12 Playable Flagship đất–biển–trời, mỗi loài có locomotion và giác quan riêng.
- `Biomass Ledger` theo dõi năng lượng từ thực vật → con mồi → thú săn mồi → xác hữu cơ.
- AI theo state machine/utility AI: kiếm ăn, trốn, săn, nghỉ, giao phối, bảo vệ tổ và di cư.
- Mùa, cháy tự nhiên, lũ, hạn, bão, nhiệt độ và bệnh ảnh hưởng khác nhau theo biome.
- Tổ, gene, con non, đàn, lãnh thổ, pheromone và tín hiệu âm thanh không lời.
- Pipeline taxonomy có nguồn từ Catalogue of Life/GBIF, provenance từng field và hàng chờ biên tập.
- Chuyển save/project lớn sang IndexedDB; localStorage chỉ giữ preference nhỏ.

### P2 — Thế giới lớn và công cụ sáng tạo

- World streaming theo chunk, level-of-detail, pooled entity, navigation theo tầng đất/biển/trời.
- OffscreenCanvas trong Worker cho terrain, minimap hoặc simulation phù hợp; main thread ưu tiên input và UI.
- Era Realm, Sanctuary, Observer, Expedition, replay/ghost và photo mode hoàn chỉnh.
- Content pack có version cho biome, species, season và expedition; ký manifest, kiểm tra schema và license.
- PWA offline cho Codex, save và Expedition local; đồng bộ tùy chọn chỉ khi người dùng bật.
- Công cụ nội bộ để xem food web, budget AI, đường di cư, provenance và regression replay.

### P3 — Realtime tùy chọn và quy mô lớn

- Multiplayer chỉ phát hành khi có signaling/auth thật, server-authoritative simulation và reconnect/resync.
- Phòng invite-only, bạn bè hoặc public; vai trò host không được quyền sửa score/sinh khối trực tiếp.
- Interest management theo chunk, snapshot delta, prediction có reconciliation và giới hạn tần suất message.
- Moderation, report, block, rate limit, audit event, chống replay và chống client tampering.
- WebGPU chỉ là accelerator tùy chọn cho compute/render nặng sau feature detection; Canvas 2D/WebGL fallback vẫn bắt buộc.
- Kiểm thử tải, chaos/reconnect, bảo mật và chi phí vận hành trước khi gọi là persistent world hay MMO.

## 8. Kiến trúc đề xuất

```text
App Shell / route
        |
EonWild workspace UI
        |
Input adapter ── keyboard / touch / gamepad
        |
Deterministic simulation core
  ├─ vitals + lifecycle
  ├─ ecology + biomass
  ├─ terrain + climate
  └─ AI + migration
        |
Render adapter ── Canvas 2D fallback / optional GPU path
        |
Versioned persistence ── preferences / IndexedDB saves / replay
```

Các hàm core như `normalizeState`, `stepVitals`, `terrainAt` và `createWorld` phải giữ pure/deterministic để test và replay cùng seed. DOM, audio, persistence và network nằm ở adapter riêng. Worker nhận message có schema, sequence number và giới hạn kích thước; không nhận code hoặc object tùy ý để thực thi.

Performance budget ban đầu:

- 60 FPS mục tiêu desktop, 30–60 FPS thích nghi mobile; gameplay không phụ thuộc frame rate.
- Giới hạn DPR, blur, particle và wildlife theo thiết bị.
- Chỉ update entity trong vùng quan tâm; AI xa dùng tick thưa hoặc thống kê quần thể.
- Không sort toàn bộ quần thể/tài nguyên mỗi frame; dùng spatial index và nearest-neighbor có giới hạn.
- Dừng RAF/audio/worker khi tab ẩn; giải phóng observer, timer và listener khi đổi route.
- Đo long task, memory, frame time và entity budget bằng công cụ dev nội bộ, không gửi dữ liệu riêng tư mặc định.

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
