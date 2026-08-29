# HH Universe v4

## Phạm vi phát hành

Phiên bản v4 giữ tên **Vũ trụ / HH Universe** và route chuẩn `#/universe/*`, đồng thời thay workspace Hệ Mặt Trời bằng trải nghiệm 3D chạy trực tiếp trong HH Platform. Mọi route `#/cosmic-observatory/*` cũ tiếp tục được chuyển tương thích. IndexedDB, localStorage, bookmark, session và schema export cũ được giữ nguyên để không làm mất dữ liệu.

Trung tâm Vũ trụ có một CTA “Tiếp tục khám phá”, tìm kiếm toàn module, trạng thái phiên gần nhất, bầu trời theo giờ thiết bị, bookmark và JPL Asteroid Watch. Các workspace gồm Đài quan sát local-first, DSN official gateway, Bề mặt hành tinh với máy đo cung, Dòng thời gian Vũ trụ, Phòng học thiên văn và Flight Director dùng vector JPL Horizons thật.

## Kiến trúc

- `cosmic-observatory.js`: UI, renderer WebGL2/Canvas, observer sky, IndexedDB, provenance và lifecycle.
- `cosmic-observatory.css`: giao diện responsive, focus, reduced motion và forced colors.
- `cosmic-solar-system-3d.js`: renderer nội bộ WebGL2 với Canvas Lite fallback, camera orbit/pan/zoom, chọn mục tiêu, tua thời gian, context recovery và lifecycle độc lập.
- `cosmic-solar-system-3d.css`: cockpit/HUD immersive được scope trong `.hh-solar3d`, hỗ trợ fullscreen, safe-area, touch, 200% zoom và mobile bottom sheet.
- `utils/cosmic-data-gateway.js`: same-origin data gateway với allowlist, timeout, retry, cache, rate limit và giới hạn response; được dùng lại trong function `api/platform/summary.js` để giữ giới hạn Vercel Hobby.
- `vendor/astronomy-engine-2.1.19.min.js`: tính vị trí thiên thể trong trình duyệt, đi kèm license ở `vendor/astronomy-engine-LICENSE.txt`.
- `performance-loader.js`: chỉ tải bundle khi route bắt đầu bằng `/universe` hoặc route tương thích `/cosmic-observatory`.

## Route

| Route | Nguồn/trạng thái |
| --- | --- |
| `/universe` | Command Center, tìm kiếm và tiếp tục hành trình |
| `/universe/solar-system` | Renderer 3D nội bộ + Astronomy Engine, `computed`; kích thước/màu và scale phi tuyến là `illustrative` |
| `/universe/live-sky` | Astronomy Engine + vị trí người quan sát, `computed` |
| `/universe/observatory` | Nhật ký phiên quan sát trong IndexedDB |
| `/universe/missions` | Flight Director từ JPL Horizons + directory nhiệm vụ chính thức |
| `/universe/dsn` | Cửa ngõ DSN Now chính thức; không tạo tín hiệu giả |
| `/universe/asteroids` | JPL CNEOS CAD, `observed` |
| `/universe/surfaces` | NASA Treks + máy tính khoảng cách cung, `computed` |
| `/universe/exoplanets` | NASA Exoplanet Archive TAP, `observed` |
| `/universe/earth` | NASA EONET v3, `observed` |
| `/universe/space-weather` | NASA DONKI, `observed` |
| `/universe/timeline` | Timeline giáo dục với mốc gần đúng, `illustrative` |
| `/universe/learning` | Quiz thiên văn và kỷ lục cục bộ |
| `/universe/media` | NASA Image and Video Library, `observed` |
| `/universe/universe-map` | Liên kết chính thức WWT/ESASky; chưa nhúng engine |
| `/universe/tours` | Điều hướng tour tới các workspace thật |
| `/universe/planner` | Bản đồ observer sky ở chế độ lập kế hoạch |
| `/universe/data-center` | Registry, export/import và cache control |

Route cũ `/cosmic-observatory` và mọi route con được giữ làm compatibility redirect, không còn là URL chuẩn.

## API

Các endpoint chỉ nhận `GET`:

- `/api/cosmic/asteroids`
- `/api/cosmic/media`
- `/api/cosmic/exoplanets`
- `/api/cosmic/earth-events`
- `/api/cosmic/space-weather`
- `/api/cosmic/horizons`

Không có tham số `url` hoặc `endpoint`; upstream được cố định trong server. `NASA_API_KEY` được đọc từ environment. Khi chưa cấu hình, DONKI dùng `DEMO_KEY` công khai của NASA với quota thấp; frontend không nhận hoặc lưu key.

Mọi response thành công có provenance envelope:

`sourceName`, `sourceUrl`, `fetchedAt`, `observedAt`, `validFor`, `coordinateFrame`, `timeScale`, `units`, `uncertainty`, `attribution`, `usagePolicy`, `cacheStatus`, `dataQuality`, `dataType`, `data`.

## Cache và dữ liệu người dùng

- Serverless instance cache dữ liệu upstream trong bộ nhớ ngắn hạn và trả CDN cache header.
- Client cache response đã validate trong IndexedDB; khi upstream lỗi chỉ dùng cache có tuổi giới hạn và gắn nhãn `client-stale`.
- Bookmark media, phiên quan sát và cache tiếp tục nằm trong database `hh.cosmic-observatory` schema v1 để tránh migration phá dữ liệu.
- Export không chứa cache response, token hoặc API key.
- Import giới hạn 2 MB, kiểm tra `schema`, `version`, số lượng bookmark/session và ID.

## Flight Director

- Chỉ nhận target trong allowlist hành tinh/Mặt Trăng đã định danh bằng Horizons ID.
- Server trích bảng CSV nằm giữa `$$SOE` và `$$EOE`, kiểm tra mọi trường số và giới hạn tối đa 128 bản ghi.
- Client hiển thị phép chiếu 2D nhật tâm, timeline, khoảng cách, vận tốc và so sánh hai thiên thể.
- Vận tốc km/s được đổi từ vector AU/ngày; khoảng cách km được đổi theo hằng số AU đã công bố trong client.
- Nút CSV chỉ xuất các bản ghi đang hiển thị. Khi nguồn lỗi, giao diện giữ thông báo lỗi hoặc cache có nhãn, không tạo dữ liệu thay thế.

## Hệ Mặt Trời 3D nội bộ

- Trải nghiệm chạy ngay trong `hoang8.com`; không chuyển người dùng sang NASA Eyes và không phụ thuộc iframe bên ngoài.
- Tọa độ nhật tâm và quỹ đạo lấy từ Astronomy Engine. Nếu phép tính lỗi, thiên thể không có tọa độ bị bỏ qua hoặc workspace báo lỗi; không dựng vị trí giả.
- Chế độ `scientific` giữ quan hệ khoảng cách tuyến tính theo AU. `educational` và `cinematic` nén khoảng cách để các hành tinh cùng quan sát được và luôn gắn nhãn minh họa.
- Chuột, cảm ứng và bàn phím hỗ trợ orbit, pan, wheel/pinch zoom, chọn thiên thể và đặt lại camera. Fullscreen dùng Fullscreen API của trình duyệt.
- Playback ghi rõ đơn vị ngày mô phỏng/giây. Ephemeris được giới hạn tần suất cập nhật để không tính lại hàng trăm mẫu quỹ đạo mỗi frame.
- RAF dừng khi tab ẩn hoặc playback tạm dừng. Khi mất WebGL context, workspace chuyển sang Canvas Lite và thử phục hồi WebGL khi context trở lại.
- Camera, ngày giờ, mục tiêu, tốc độ, scale, chất lượng và trạng thái nhãn được lưu vào storage key v1 hiện có khi ẩn tab hoặc rời route.
- Màu, ánh sáng khối cầu, dải khí quyển minh họa và vòng Sao Thổ được tạo bằng shader/procedural display; nhãn ưu tiên mục tiêu và tự tránh chồng lấp. Không sao chép texture, model, UI hoặc bundle độc quyền của NASA Eyes.
- Khi rời Trang chủ, router dọn khóa cuộn do Home Cosmic OS sở hữu trước khi dựng Vũ trụ; CSS route cũng có lớp bảo vệ để timeline và inspector luôn cuộn tới được nếu teardown bị trễ.
- Playback chỉ vẽ lại khi ephemeris thực sự đổi, thay vì tải GPU/Canvas ở mọi frame giống nhau. Lỗi dựng quỹ đạo nền được ghi vào runtime state và thử lại có giới hạn.

## Quy tắc khoa học và hiển thị

- `observed`: bản ghi do upstream công bố.
- `computed`: giá trị do Astronomy Engine hoặc JPL Horizons tính.
- `predicted`: dự báo có thể được hiệu chỉnh.
- `interpolated`: giá trị nằm giữa hai mốc nguồn.
- `illustrative`: màu, kích thước điểm hoặc tỉ lệ phục vụ quan sát.

Chế độ Solar System `scientific` giữ quan hệ khoảng cách theo AU. `educational` và `cinematic` dùng thang phi tuyến nên luôn có nhãn minh họa. Kích thước và màu hành tinh không được trình bày là phép đo.

## Cấu hình production

1. Tạo `NASA_API_KEY` trong Vercel Environment Variables để DONKI có quota production.
2. Không thêm key vào `config.js`, HTML hoặc localStorage.
3. Deploy và gọi từng endpoint để xác minh egress tới JPL/NASA/IPAC.
4. Chạy `npm run test:space` và `npm run test:security`.

## Giới hạn đã biết

- WorldWide Telescope và ESASky đang mở ở tab nguồn chính thức; chưa nhúng layer HiPS vào renderer riêng.
- Flight Director hiện hỗ trợ hành tinh và Mặt Trăng trong allowlist; tàu vũ trụ chưa được thêm nếu chưa có registry ID và metadata nhiệm vụ được kiểm duyệt.
- Không có benchmark GPU thực tế nếu môi trường kiểm thử không cung cấp trình duyệt có WebGL2.
- Star catalogue tích hợp của Live Sky chỉ gồm nhóm sao sáng tham chiếu J2000; hành tinh, Mặt Trời và Mặt Trăng được tính theo thời gian/vị trí.
- Hệ Mặt Trời 3D dùng vật liệu procedural tối ưu cho web, chưa dùng texture/model bề mặt độ phân giải cao. Đây không phải ảnh chụp, mô hình photoreal hoặc bản sao NASA Eyes.
