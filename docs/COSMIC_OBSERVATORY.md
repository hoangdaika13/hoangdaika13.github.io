# HH Cosmic Observatory v1

## Phạm vi phát hành

Phiên bản v1 tích hợp `#/cosmic-observatory/*` vào App Shell và tải tài nguyên theo route. P0 dùng được gồm tổng quan, Hệ Mặt Trời, Live Sky, JPL Asteroid Watch, NASA Media và Data & Attribution Center. Exoplanets, EONET Earth Events và DONKI Space Weather cũng có adapter đọc dữ liệu thật; các workspace mission/WWT hiện là cửa ngõ tới nguồn chính thức và không giả lập telemetry.

## Kiến trúc

- `cosmic-observatory.js`: UI, renderer WebGL2/Canvas, observer sky, IndexedDB, provenance và lifecycle.
- `cosmic-observatory.css`: giao diện responsive, focus, reduced motion và forced colors.
- `utils/cosmic-data-gateway.js`: same-origin data gateway với allowlist, timeout, retry, cache, rate limit và giới hạn response; được dùng lại trong function `api/platform/summary.js` để giữ giới hạn Vercel Hobby.
- `vendor/astronomy-engine-2.1.19.min.js`: tính vị trí thiên thể trong trình duyệt, đi kèm license ở `vendor/astronomy-engine-LICENSE.txt`.
- `performance-loader.js`: chỉ tải bundle khi route bắt đầu bằng `/cosmic-observatory`.

## Route

| Route | Nguồn/trạng thái |
| --- | --- |
| `/cosmic-observatory` | Tổng quan có widget JPL và NASA Media |
| `/cosmic-observatory/solar-system` | Astronomy Engine, `computed` |
| `/cosmic-observatory/live-sky` | Astronomy Engine + vị trí người quan sát, `computed` |
| `/cosmic-observatory/asteroids` | JPL CNEOS CAD, `observed` |
| `/cosmic-observatory/media` | NASA Image and Video Library, `observed` |
| `/cosmic-observatory/exoplanets` | NASA Exoplanet Archive TAP, `observed` |
| `/cosmic-observatory/earth` | NASA EONET v3, `observed` |
| `/cosmic-observatory/space-weather` | NASA DONKI, `observed` |
| `/cosmic-observatory/universe-map` | Liên kết chính thức WWT/ESASky; chưa nhúng engine |
| `/cosmic-observatory/missions` | Directory chính thức; chưa hiển thị telemetry |
| `/cosmic-observatory/tours` | Điều hướng tour tới các workspace thật |
| `/cosmic-observatory/planner` | Bản đồ observer sky ở chế độ lập kế hoạch |
| `/cosmic-observatory/data-center` | Registry, export/import và cache control |

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
- Bookmark media, session và cache nằm trong database `hh.cosmic-observatory` schema v1.
- Export không chứa cache response, token hoặc API key.
- Import giới hạn 2 MB, kiểm tra `schema`, `version`, số lượng bookmark/session và ID.

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
- Mission Timeline chưa có data adapter mission thống nhất, vì vậy chỉ cung cấp directory chính thức.
- Không có benchmark GPU thực tế nếu môi trường kiểm thử không cung cấp trình duyệt có WebGL2.
- Star catalogue tích hợp của Live Sky chỉ gồm nhóm sao sáng tham chiếu J2000; hành tinh, Mặt Trời và Mặt Trăng được tính theo thời gian/vị trí.
