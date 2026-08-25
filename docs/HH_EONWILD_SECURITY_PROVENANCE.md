# HH EonWild — Security & Provenance

Trạng thái ghi nhận ngày **2026-08-25**. Tài liệu này mô tả đúng những gì đang có trong repository; không phải chứng nhận bảo mật, khoa học, chất lượng AAA hay photoreal.

## 1. Tóm tắt kiểm tra

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| `npm run test:security` | 14/14 test đạt |
| `npm audit --omit=dev --audit-level=low` | 0 lỗ hổng production được npm báo cáo |
| `npm audit --audit-level=low` | Không đạt: 30 lỗ hổng trong dependency phát triển, gồm 1 low, 6 moderate, 22 high và 1 critical |
| `npm run validate:eonwild-assets` | Manifest hợp lệ; 6 asset, 4 environment asset, 2 creature prototype, 0 creature production và 4 creature contract còn placeholder |

Các cảnh báo `npm audit` đầy đủ hiện nằm trong toolchain phát triển do Vercel kéo theo. Chúng không xuất hiện khi audit chỉ production, nhưng vẫn phải được quản lý trước khi coi môi trường build/dev là đã sạch. Không chạy `npm audit fix --force` tùy tiện vì npm báo thay đổi breaking.

## 2. Asset, nguồn và giấy phép hiện có

Nguồn kiểm chứng chính nằm tại:

- `assets/eonwild/asset-manifest.v1.json`
- `assets/eonwild/THIRD_PARTY_NOTICES.md`
- `assets/eonwild/environment/polyhaven-provenance.v1.json`
- `assets/eonwild/creatures/quaternius-provenance.v1.json`
- `scripts/validate-eonwild-assets.js`

### Environment

Bốn asset môi trường được self-host ở mức 1K, tổng cộng **10.471.123 byte**:

- Fern 02 — Poly Haven — CC0-1.0.
- Rock Moss Set 01 — Poly Haven — CC0-1.0.
- Quiver Tree 02 — Poly Haven — CC0-1.0.
- Kloofendal Partly Cloudy Pure Sky HDRI — Poly Haven — CC0-1.0.

Manifest lưu trang nguồn, tác giả, URL giấy phép, tệp nguồn, MD5 nguồn, SHA-256 đầu ra, kích thước byte và lịch sử xử lý. Các file runtime nằm cùng origin; game không cần tải trực tiếp asset Poly Haven khi mở route.

### Creature

Hai GLB hoạt hình hiện có là prototype low-poly từ gói Quaternius CC0:

- Tyrannosaurus prototype.
- Triceratops prototype.

Mỗi model chỉ có một LOD, màu phẳng và sáu clip `attack`, `death`, `idle`, `jump`, `run`, `walk`. Validator vẫn ghi nhận cảnh báo skin-root. Chúng **không phải model production**, không có bộ PBR/LOD/animation hoàn chỉnh và không đại diện cho tái dựng khoa học đã duyệt.

Spinosaurus và Pteranodon vẫn chỉ có procedural placeholder. Creature contract của Tyrannosaurus và Triceratops cũng tiếp tục mang trạng thái placeholder dù đã có GLB prototype để thử pipeline. Không có model động vật production nào được phê duyệt trong manifest hiện tại.

Babylon.js và Babylon.js Loaders 9.22.1 được self-host theo Apache-2.0; hash và tệp giấy phép được ghi trong manifest. Không có asset nào trong manifest hiện tại được khai báo hoặc có provenance như asset rip từ The Isle, ARK hay game thương mại.

## 3. Registry 300 taxon

`hh-eonwild-species-registry.js` chứa đúng **300 taxon Animalia hiện đại, không trùng ID, taxon ID hoặc tên khoa học**, chia thành:

- 55 động vật có vú.
- 55 chim.
- 30 bò sát.
- 25 lưỡng cư.
- 45 cá vây tia.
- 25 thân mềm.
- 40 côn trùng.
- 15 hình nhện.
- 10 giáp xác Malacostraca.

Dữ liệu được tạo từ iNaturalist public API qua `scripts/sync-eonwild-species-registry.js`. Script dùng HTTPS, User-Agent riêng, timeout 20 giây, khoảng cách tối thiểu một giây giữa request và giới hạn phản hồi thực tế 8 MiB. Registry chỉ nhập taxonomy và số quan sát tổng hợp; không nhập ảnh, âm thanh hay model iNaturalist.

Mọi taxon nhập mới đều có trạng thái:

- `tier: catalog-only`.
- `simulationAllowed: false`.
- `model.productionApproved: false`.
- Không có URL model, tác giả model, giấy phép model hoặc SHA-256 model.

Do đó 300 taxon này là dữ liệu tra cứu, **không phải 300 loài playable, 300 NPC hoặc 300 model 3D**. Diet, morphology, tốc độ, tuổi thọ, sinh sản, quan hệ săn mồi và tình trạng bảo tồn vẫn cần duyệt theo từng loài. Chỉ 10 taxon có tên Việt ưu tiên từ nguồn; 290 taxon còn lại hiển thị tên khoa học thay thế và được gắn cờ cần duyệt tiếng Việt.

Các số `targetSpecies: 400` và `maximumSpecies: 500` là mục tiêu/cap kiến trúc, không phải số loài đã hoàn thiện. Eon Codex có thể cộng registry mới với catalog cũ, nhưng tổng số mục hiển thị không đồng nghĩa tổng số loài production duy nhất.

Nguồn taxonomy hiện tại là iNaturalist, không thay thế tài liệu khoa học chuyên ngành cho ecology, sinh lý hoặc tái dựng hình thái từng loài. Khi nâng taxon lên simulated/playable phải bổ sung nguồn khoa học riêng và provenance/model license đầy đủ.

## 4. World Atlas và nguồn khoa học

World Atlas hiện có **26 mục bản đồ trong 5 realm**. Source Registry tham chiếu:

- International Commission on Stratigraphy — mốc niên đại địa chất.
- EarthByte/GPlates — tham khảo paleogeography và plate reconstruction.
- Natural Earth — tham khảo địa lý hiện đại.
- NOAA ETOPO 2022 — tham khảo relief và bathymetry hiện đại.

Các URL này là **nguồn tham khảo**, với `assetImported: false`. Repository chưa nhập tile GIS, raster độ cao hay reconstruction dataset được pin version/checksum từ bốn nguồn trên. Map cổ chỉ là chỉ mục niên đại/vùng sinh thái; địa hình gameplay của vùng active vẫn procedural. Eon Convergence luôn được ghi rõ là sandbox hư cấu.

Planet scale hiện là lớp địa chỉ logic, floating origin và streaming planner. Renderer không dựng toàn hành tinh cùng lúc; vùng gameplay đang hoạt động vẫn là khu vực khoảng 16 × 16 km. Không được mô tả Atlas hiện tại là bản sao chính xác của Trái Đất xưa hoặc nay.

## 5. CSP, secret và dữ liệu cục bộ

Không tìm thấy API key, bearer token, private key, MongoDB URI hay client secret thật trong các file EonWild mới bằng các mẫu secret phổ biến. Registry và Atlas chạy từ asset JavaScript self-host; iNaturalist chỉ được gọi bởi script đồng bộ Node, không phải từ browser khi chơi.

CSP deployment hiện có các bảo vệ chính như `object-src 'none'`, `base-uri 'self'` và `frame-ancestors 'none'`. Tuy vậy chính sách toàn nền tảng vẫn rộng ở `connect-src https: wss:`, `img-src/media-src https:`, `frame-src https:` và `style-src 'unsafe-inline'`. Vì vậy không được coi CSP hiện tại là allowlist tối thiểu hoặc là bằng chứng không thể exfiltrate nếu một lỗi XSS khác xuất hiện.

Input profile và save được giới hạn kích thước, chuẩn hóa trước khi lưu và không được dùng để chứa credential. Local state không phải kho secret. Multiplayer vẫn khóa; không có token phòng, người online, leaderboard hoặc server-authoritative state giả.

Service Worker v890 precache các module EonWild cùng origin phục vụ Canvas Lite và kernel dữ liệu/mô phỏng. Cinematic Pack tùy chọn dùng pipeline riêng, yêu cầu manifest, provenance và SHA-256; một gói đã tải không tự động biến asset thành production-approved.

## 6. Những gì chưa production

Không được tuyên bố HH EonWild hiện tại là photoreal, AAA hoặc production-ready vì:

- Có 0 creature model production-approved.
- 300 taxon mới đều catalog-only; chưa là NPC hoặc playable.
- Chưa có 300–500 model, rig và animation riêng theo loài.
- Atlas chưa chứa dataset GIS/tile tái dựng được pin và kiểm chứng.
- Planet scale mới là kiến trúc logic; renderer chỉ dựng vùng active hữu hạn.
- Weather, vegetation, water, AI và world streaming hiện là hệ thống procedural/vertical-slice, chưa phải mô phỏng hành tinh đã được khoa học xác nhận.
- Audit dependency phát triển chưa sạch.
- Test tự động đạt không thay thế penetration test, scientific review, benchmark đa thiết bị, playtest dài hoặc kiểm định đồ họa.

Chỉ nâng một asset hoặc taxon lên production/simulated/playable sau khi source, tác giả, giấy phép, checksum, scientific review, model/rig/animation, runtime budget và kiểm thử tương ứng đều được xác minh.
