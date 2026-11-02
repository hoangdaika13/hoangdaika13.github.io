# HH MULTIVERSE / GLITCHVERSE — release 1078

Ngày: 02/11/2026. Mở tại `https://hoang8.com/#/multiverse` sau khi vào HH Platform.

## Phần đã triển khai

Module mới nằm trong HH Platform hiện tại, dùng đăng nhập, hash router, bộ tải theo route, Gemini và MongoDB có sẵn. Không tạo website hoặc hệ thống tài khoản riêng.

| Luồng | Hành vi thực tế |
| --- | --- |
| Tạo thực tại | Giả định, 5 chế độ, mức sáng tạo, quy mô, năm, chủ đề, ngôn ngữ khởi tạo, trọng tâm và quy tắc riêng. Chọn rõ Offline hoặc Gemini. |
| Reality Browser | Tab, địa chỉ `sim://`, lùi/tiến, bookmark và lịch sử. Không điều hướng ra Internet thật bằng thanh địa chỉ mô phỏng. |
| 8 ứng dụng | News, Social, Search, Market, Encyclopedia, Map, Trends, Archives đều đọc cùng snapshot. Bản đồ, giá trị chỉ số, tin tức và nơi sản xuất vật phẩm phản ánh cùng dữ kiện. |
| Du hành thời gian | 6 mốc định sẵn và số ngày tùy chọn; tạo sự kiện trung gian và snapshot mới. Thanh kéo chỉ chọn các mốc đã thực sự lưu. Đi tiếp từ quá khứ tự tạo nhánh. |
| Hiệu ứng bướm | Xem trước trọng số của 7 nhóm quyết định và causal graph. Apply kiểm tra lại ngữ cảnh, tính lại trọng số và tạo nhánh; không ghi ngay khi preview. |
| Nhánh | Cây phân nhánh, mở, đổi tên, sao chép, xóa nhánh lá có xác nhận, so sánh chỉ số và sự kiện, trở về nhánh gốc/mốc trước phân nhánh. |
| Nhân vật | Hồ sơ, quan hệ, địa điểm, mục tiêu và ký ức sự kiện theo mốc đang xem. Chat offline hoặc Gemini; lịch sử chat lọc đúng nhân vật, nhánh và các snapshot tổ tiên. |
| Thư viện riêng | Tìm, lọc, sắp xếp, đổi tên, sao chép, xuất JSON, nhập thành ID riêng và xóa có xác nhận. Import giữ hội thoại/ghi chú; bản sao thông thường bắt đầu hội thoại riêng. |
| Tiện ích | DNA của thế giới, nhật ký riêng, Time Capsule, Atlas 2D theo các thế giới thực sự đã lưu, xuất truyện Markdown/TXT, phím Alt+I/T/B/N/L trong module. |
| Lưu thiết bị | IndexedDB tách theo tài khoản. Chỉ báo lưu bền vững sau transaction hoàn tất. CAS chặn ghi đè từ tab cũ; lỗi quota giữ bản trong phiên và hướng dẫn xuất JSON. |
| Đồng bộ | Đăng nhập rồi chủ động PUT/GET bản MongoDB. Revision chặn ghi đè bản mới; khi tải về có lựa chọn giữ cả hai hoặc thay bản thiết bị sau khi xuất bản cũ. |
| Chia sẻ | Ảnh chụp frozen, unlisted hoặc public chờ duyệt. Bỏ chat, ghi chú, capsule và lịch sử duyệt riêng. Trang đọc không sửa bản gốc; clone tùy quyền chủ sở hữu. Private thu hồi truy cập. |
| Quản trị | Hàng đợi public và báo cáo; admin/moderator hoặc chủ sở hữu nền tảng đã được backend xác thực duyệt đúng revision. Support/analyst không có quyền duyệt. |
| Đồ họa | Cổng Three.js nguyên bản theo nhu cầu, shader/vòng quỹ đạo/hạt; fallback CSS 2D, thumbnail SVG thủ tục, giao diện cosmic cyan/violet. |

Mọi trang tin, tổ chức, nhân vật và giao dịch là hư cấu. Market dùng tín dụng mô phỏng, không tích hợp thanh toán. Chỉ số được ghi rõ là mô hình đồ chơi, không phải dữ liệu hoặc dự báo khoa học.

## AI và mô phỏng

**Đường gọi Gemini thật đã được nối trên máy chủ:** tạo blueprint theo JSON schema và hội thoại nhân vật theo ngữ cảnh được lọc. Tái sử dụng `mathcore-gemini` và key pool; không đưa key vào JavaScript trình duyệt. Hộp xem trước cho người dùng kiểm tra ngữ cảnh trước khi gửi chat Gemini. Kiểm tra schema, ID và nguồn sự kiện trước khi lưu; lỗi, timeout hoặc hủy không biến thành kết quả thành công.

Kiểm thử release dùng phản hồi Gemini giả lập được gắn nhãn rõ trong harness, không gọi model trả phí và không tạo tài khoản/dữ liệu production. Việc provider được cấu hình không chứng minh model đang phản hồi. Endpoint status chỉ báo cấu hình, không tự nhận đã thực hiện inference.

**Các phần offline:** generator theo từ khóa/seed/quy tắc, sự kiện timeline, điểm tác động, dữ liệu Internet, tìm kiếm từ khóa, câu trả lời nhân vật theo mẫu và thumbnail/portal thủ tục. Chế độ và trọng tâm ảnh hưởng quy tắc/chỉ số khởi đầu; Chaos nhân đôi tác động biến cố. Custom rules được giữ như ràng buộc nội dung, không được diễn dịch thành chương trình vật lý. Nhãn ngôn ngữ trong form chỉ cam kết ngôn ngữ nội dung khởi tạo; một số diễn giải và thao tác hệ thống tiếp tục dùng tiếng Việt.

Không có dịch vụ tạo ảnh AI trong release này. Atlas là 2D; cổng trang chủ là 3D, không phải một thế giới 3D có vật lý.

## Tích hợp vào nền tảng

- Mục lớn `HH MULTIVERSE`, module `GLITCHVERSE`, tìm kiếm sidebar/command search và danh mục Platform lấy từ registry hiện hữu.
- AI Universe trong HH Galaxy có lối vào GLITCHVERSE. Không thêm hoặc thay đổi các hành tinh gốc và không thay đổi ranh giới đăng nhập HH CORE.
- Các route: `#/multiverse`, `/create`, `/explore`, `/my-universes`, `/atlas`, `/moderation`, `/universe/:id/:pane`, `/shared/:token` đều nằm dưới prefix `#/multiverse`.
- Các pane của một thế giới: `overview`, `internet`, `timeline`, `butterfly`, `branches`, `characters`, `dna`, `journal`, `settings`.
- CSS chỉ áp dụng trong module. Tải Three khi có nhu cầu; dừng khi ẩn/offscreen, tôn trọng giảm chuyển động. Unmount hủy request, vòng lặp, observer/listener và đóng IDB; GPU resources được dispose.
- Service Worker release 1078; loader 739, router 301, gateway 13, Planet Hubs 3, Platform Home 24. Không precache cổng 3D cho các module khác. API/private response không vào shell cache. Offline chỉ cam kết các tài nguyên đã ghé và dữ liệu thiết bị đã lưu.

## Dữ liệu, giới hạn và cấu hình

Không di chuyển hoặc sửa collection cũ. MongoDB tự tạo collection và index của module ở lần truy cập đầu tiên; không cần chạy migration phá hủy dữ liệu.

| Kho | Nội dung / bảo vệ |
| --- | --- |
| IDB `hh.multiverse.v1` / store `universes` | Khóa ghép owner/id, owner namespace `hh.multiverse.workspace.v1:<account>`, local revision và cloud revision riêng. Guest không đọc kho tài khoản khác. |
| `multiverse_worlds` | Chủ sở hữu + ID; dữ liệu riêng và revision. Xóa tạo tombstone, không cho client cũ hồi sinh cùng ID. |
| `multiverse_shares` | Ảnh chụp đã bỏ dữ liệu riêng, token ngẫu nhiên, quyền clone, revision nội dung và trạng thái duyệt. |
| `multiverse_reports` | Báo cáo có đăng nhập, hạn mức, thời điểm. |
| `rateLimits` hiện có | Giới hạn yêu cầu AI, đọc, ghi, chia sẻ, review và báo cáo. |

Index: owner/deleted/updatedAt cho thế giới; token unique sparse và visibility/status/updatedAt cho share; createdAt cho report. Cần MongoDB credential có quyền tạo index.

Biến máy chủ hiện có: `MONGODB_URI`, cấu hình database của platform, auth và allowed origins; Gemini dùng `GEMINI_API_KEYS` / `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY`. `GEMINI_MODEL` là cấu hình model hiện có; `MULTIVERSE_GEMINI_MODEL` là override tùy chọn, để trống sẽ kế thừa cấu hình chung. Không điền key vào client hoặc commit `.env`.

Giới hạn ứng dụng: 20 thế giới mỗi kho tài khoản; 750.000 byte JSON chuẩn hóa/thế giới; 48 snapshot, 12 nhánh, 180 sự kiện, 40 lượt chat, 80 ghi chú, 30 capsule; 8 tab, 60 địa chỉ/tab, 60 bookmark và 100 lịch sử duyệt. Mỗi lần du hành tối đa 365.000 ngày; lịch mô phỏng là năm 365 ngày. Hạn mức đếm thư viện không phải cơ chế billing; không triển khai giao dịch đa tài liệu cho giới hạn 20 bản máy chủ.

Một phiên bản hoặc bản lưu hỏng chưa hiểu sẽ được giữ để xuất bản gốc; không tự chuyển đổi hoặc âm thầm ghi đè. Xóa local và xóa cloud là hai thao tác được mô tả riêng. Đồng bộ thủ công, không phải realtime merge. Không hỗ trợ khôi phục cloud tombstone cùng ID; tạo bản sao ID mới khi cần tiếp tục.

API dùng rewrite vào function sẵn có `api/modules/[moduleId]/actions.js`; không thêm serverless function mới:

| Resource `/api/multiverse/` | Phương thức |
| --- | --- |
| `status`, `explore`, `shared?token=…` | GET; public có giới hạn; shared chỉ nhận ảnh được phép truy cập |
| `generate`, `character` | POST, đăng nhập, rate limit, schema và abort/timeout |
| `worlds[?id=…]` | GET/PUT/DELETE, owner scope và revision |
| `publish` | POST, owner scope, source revision, private/unlisted/public |
| `moderation` | GET/PATCH, quyền duyệt và revision |
| `report` | POST, đăng nhập và rate limit |

## Chạy và kiểm thử

Node theo `package.json`: >=22.13 và <25. Cài dependency bằng `npm ci`. Repo là static app + Vercel functions, không có script lint/typecheck/build frontend riêng.

```powershell
npm start
# mở URL do vercel dev trả về, đăng nhập/guest rồi vào #/multiverse
npm run test:multiverse
npm run test:all-tools
npm run test:security:full
npm run test:learning
```

Full-shell QA cần Playwright đã cài và Chromium tương thích:

```powershell
$env:HH_QA_PLAYWRIGHT = 'đường dẫn tới module playwright hoặc playwright-core'
$env:HH_QA_CHROMIUM = 'đường dẫn tuyệt đối tới chrome.exe'
npm run test:multiverse
npm run qa:multiverse
```

Native store test được skip có chủ đích nếu chưa khai báo Playwright. Harness dựng static server local, dùng CSP production, thực thi handler thật với identity, database bộ nhớ và model fixture tường minh. Các API khác trả trạng thái thiếu dịch vụ; không có production write hoặc paid AI call.

Kết quả trước bàn giao:

- 42/42 test Multiverse, gồm native IndexedDB: serialization/import, luật/giới hạn, snapshot/fork/delete, causal graph, ký ức, XSS, market, browser, CAS nhiều tab, lỗi quota, owner/auth/CSRF, cloud revision/tombstone, share frozen, moderation, provider schema và private key trong header.
- 241/241 All Tool/platform contracts; 107/107 security/auth contracts.
- HH School: 129 pass, 1 skip có chủ đích; không có failure.
- 175/175 test hồi quy University/Law/MathCore/Platform/Gateway/Planet Hubs.
- Syntax check các runtime mới và các file shell đã sửa; `git diff --check` không có lỗi whitespace.
- Full HH shell trên Chromium: tạo → 8 app → timeline → preview/apply → compare → chat → journal/capsule → export/import/reload → sync/share/clone → hủy/xác nhận xóa → Gemini fixture/error/cancel/offline fallback → cổng 3D → các module cũ → offline reload.
- 52 trạng thái, 16 theme, desktop 1440px/tablet 768px/mobile 375px, DPR2, zoom200%, reduced motion/forced colors/keyboard. 1.987 mẫu tương phản chữ tự động đạt ngưỡng trong các trạng thái đã đo; không tràn ngang toàn trang, không page error. Đây là QA có phạm vi, không phải chứng nhận WCAG toàn site.

Ảnh và log local đặt trong `.study-local/hh-multiverse-1078/`: `home-desktop.png`, `portal-3d.png`, `world-overview.png`, `internet-map.png`, `timeline.png`, `butterfly-preview.png`, `branches.png`, `characters.png`, `world-375.png`, `zoom200.png`, `library.png`, `readability.json`, `results.json`. Không commit profile trình duyệt, bản xuất riêng hoặc log local.

`npm audit --omit=dev` hiện ghi nhận 5 high và 1 low ở dependency hiện hữu (`@simplewebauthn/server`, chuỗi `@vercel/blob`/`undici`/`zod`); không thêm hoặc đổi dependency trong release này. Security workflow có thể dừng ở audit có sẵn dù contract tests pass; không ghi nhận CI xanh khi audit còn fail.

Production dùng cấu hình Git → Vercel hiện có của repository. Push main kích hoạt build/deploy; kiểm tra commit deployment, asset version và `/api/multiverse/status`. Không có cấu hình Sites/Cloudflare mới. Không gọi Gemini có phí hoặc ghi database production chỉ để nghiệm thu.

## Danh sách file

Mới:

- `hh-multiverse-model.js`, `hh-multiverse-engine.js`, `hh-multiverse-internet.js`: schema và một nguồn trạng thái dùng chung.
- `hh-multiverse-store.js`: IDB, partition, CAS và phục hồi quota.
- `hh-multiverse.js`, `hh-multiverse-views.js`, `hh-multiverse.css`: mount/lifecycle, views và thiết kế.
- `hh-multiverse-portal.mjs`: cổng Three theo nhu cầu.
- `utils/multiverse-ai.js`, `utils/multiverse-handler.js`: AI/schema, owner storage, share/moderation.
- `tests/hh-multiverse.test.js`, `tests/hh-multiverse-api.test.js`, `tests/hh-multiverse-store-browser.test.js`.
- `scripts/qa-hh-multiverse.js`, `scripts/qa-hh-multiverse-fixture.js`.
- Tài liệu release này.

Sửa: `script.js`, `performance-loader.js`, `hh-core-gateway.js`, `platform-home.js`, `galaxy-planet-hubs.js`, `api/modules/[moduleId]/actions.js`, `vercel.json`, `index.html`, `sw.js`, `.env.example`, `package.json`, `tests/platform-home.test.js`.

## Giới hạn và hướng phát triển

Generator offline là bộ tạo nội dung theo nhóm giả định và seed, chưa hiểu mọi giả định như một mô hình ngôn ngữ. Timeline và Butterfly dùng quy tắc cố định được công khai trong engine, không phải mô phỏng xã hội/vật lý tổng quát. Search là tìm từ khóa trong kho của thế giới, không phải web search hoặc semantic retrieval.

Trí nhớ nhân vật bị giới hạn theo dữ liệu đưa vào prompt, nhưng LLM vẫn có thể suy diễn sai; kiểm tra event ID không chứng minh mọi câu đều đúng với lore. Chat không trực tiếp sửa lịch sử. Nhãn nguồn trong JSON không phải chữ ký chứng thực nhà cung cấp.

Public feed bắt đầu trống cho tới khi có ảnh được chủ động gửi và duyệt. Kiểm tra email/key-like string chỉ là lớp lọc cơ bản; moderation do người duyệt thực hiện, chưa có hệ thống phân loại nội dung tự động toàn diện. Không bật search engine index cho API share. Unlisted token là quyền truy cập dạng bearer; người có liên kết có thể đọc, nên chủ sở hữu cần thu hồi khi không muốn chia sẻ nữa. Tắt clone chỉ bỏ công cụ sao chép của ứng dụng, không ngăn người xem ghi lại dữ liệu đã được hiển thị.

Các bước nâng cấp tiếp theo: engine sự kiện theo policy có nhiều thế hệ hơn; retrieval/ngữ nghĩa được kiểm định; bản dịch hệ thống đầy đủ; cloud diff/merge; migration qua schema mới; undo nhiều bước; moderation mở rộng; atlas 3D và tạo ảnh theo opt-in/quota khi có provider phù hợp. Các mục này chưa được đánh dấu là đã làm.
