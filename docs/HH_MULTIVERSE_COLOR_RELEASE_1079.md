# HH Multiverse — Color Realities, release 1079

Ngày 02/11/2026. Mở `https://hoang8.com/#/multiverse` hoặc phòng tranh `#/multiverse/gallery`.

## Giao diện và hình ảnh

- Tạo **18 ảnh gốc bằng công cụ imagegen tích hợp**: cổng đa vũ trụ; 8 tranh thế giới theo giả định; timeline, hiệu ứng bướm, nền văn minh; 6 chân dung nhân vật hư cấu.
- Trang chủ có ảnh bìa lớn, cổng 3D tương tác, lời giới thiệu và ô nhập giả định rõ hơn. Thẻ khám phá/thư viện có phối màu theo chủ đề, ảnh thể hiện đúng nhóm giả định và nút mở thế giới rõ ràng.
- Timeline, hiệu ứng bướm, danh sách nhân vật có tranh mở đầu. News và trang chủ Internet có minh họa cảnh; Social và hồ sơ nhân vật dùng chân dung thay chữ cái.
- Ba bộ màu **Lăng kính, Cực quang, Hoàng hôn** dùng các sắc xanh điện, cyan, tím, hồng, san hô, vàng. Màu nhấn được phân vai cho nút, chỉ số, điều hướng và từng nhóm nội dung; chữ giữ tương phản trên nền đậm.
- Phòng tranh có đủ18ảnh, lọc 8thế giới / 4hành trình / 6chân dung, xem ảnh lớn, ảnh trước/sau, phím ←/→, Esc, tải WebP và khởi tạo giả định từ tranh thế giới. Đóng ảnh trả focus về đúng nút đã mở.
- Thêm chế độ thu gọn tiêu đề để dành diện tích cho vùng chơi. Bộ màu và độ gọn được lưu theo tài khoản trên thiết bị dưới khóa `hh.multiverse.visual.v1:<account>`; dữ liệu sai hoặc khác phiên bản được giữ nguyên.

Ảnh là **tranh ý tưởng dựng sẵn**, không phải kết quả dựng lại từ snapshot, không thay đổi theo biến cố và không xác nhận ngoại hình nhân vật. Thông tin và trạng thái mô phỏng vẫn lấy từ World State Engine. Bộ tranh này không tạo thêm lời gọi AI trong lúc người dùng chơi.

## Tài sản và nguồn gốc

Ảnh dùng trong website được lưu trực tiếp tại `assets/multiverse/`. Có **55 file WebP**, tổng5.65MB cho toàn bộ các kích thước; trình duyệt chọn kích thước cần dùng bằng `srcset`/`sizes`. Ảnh dưới vùng nhìn dùng lazy loading; ảnh chính được ưu tiên tải. Không precache cả bộ ảnh cho các module khác.

- Cảnh:320,640,1280px; ảnh cổng có thêm1600px.
- Chân dung:160,400,960px.
- Mỗi ảnh có kích thước khung cố định để tránh nhảy bố cục. Khi tải ảnh lỗi, nền thay thế và thông báo giữ nguyên khung; dữ liệu và thao tác vẫn sử dụng được.
- Bộ prompt đầy đủ, SHA-256 của ảnh gốc, kích thước và số byte từng file nằm tại [`assets/multiverse/artwork-manifest-v1.json`](../assets/multiverse/artwork-manifest-v1.json).
- Không có ảnh stock hoặc tài sản tải từ website khác. Phương thức tạo: built-in `image_gen`, không dùng CLI/API fallback.
- Ảnh PNG gốc được công cụ giữ trong kho generated images của Codex. Các WebP đã chọn được chép vào project; website không tham chiếu đường dẫn cá nhân bên ngoài repository.
- `scripts/build-multiverse-art.py` chỉ đổi kích thước và đóng gói WebP từ các ảnh đã chọn, không chỉnh nội dung tranh. Production phục vụ file đã đóng gói, không cần Python, Pillow hoặc key tạo ảnh.

Muốn đóng gói lại, chuẩn bị JSON local có dạng `{ "items": [{ "id": "hero", "source": "đường dẫn PNG gốc", "prompt": "prompt đã dùng" }] }`, rồi chạy:

```powershell
python scripts/build-multiverse-art.py .study-local/multiverse-art-input.json
```

File input chứa đường dẫn cá nhân cần giữ ngoài Git. Script không ghi đè ảnh phiên bản cũ bằng một ảnh gốc khác; tạo tên phiên bản mới khi thay tranh.

## File và tích hợp

Mới: `hh-multiverse-art.js` (catalog/URL/tùy chọn màu); `hh-multiverse-color.css`; thư mục ảnh và manifest; `tests/hh-multiverse-art.test.js`; `scripts/qa-hh-multiverse-art.js`; script đóng gói và tài liệu này.

Sửa: `hh-multiverse-views.js`, `hh-multiverse.js`, `performance-loader.js`, `script.js`, `index.html`, `sw.js`, `tests/hh-multiverse.test.js`, `scripts/qa-hh-multiverse.js`.

Phòng tranh được đăng ký trong trang con của module, command search và breadcrumb. Tải `hh-multiverse-art.js` trước views; stylesheet màu và ảnh chỉ dùng trong Multiverse. Listener xem ảnh và xử lý ảnh lỗi được gỡ khi unmount. Release1079 dùng loader740, router302, Multiverse views/controller2, art/color1. Schema thế giới, API và database giữ tương thích, không cần migration dữ liệu.

## Kiểm thử thực tế

- **47/47 test Multiverse pass**, gồm native IndexedDB. Kiểm tra bộ tranh18ảnh/55file, file WebP hợp lệ, manifest/prompt, URL được giới hạn trong kho ảnh, ánh xạ tranh ổn định qua timeline/nhánh, tùy chọn theo tài khoản và bảo vệ phiên bản tương lai.
- **241/241** All Tool/platform contracts; **107/107** security/auth; **175/175** University/Law/MathCore/Platform/Gateway/Planet Hubs.
- Syntax checks các runtime đã sửa; Python compile; `git diff --check`.
- Full HH shell trên Chromium, có CSP production và Service Worker thật: giải mã thành công cả55file ảnh; gallery/filter/viewer/download, trả focus, mobile375/768, đổi màu/lưu/reload và khung thay thế cho HTTP404.
- **129 trạng thái**,3bộ màu,16theme nền tảng; **4.989 mẫu tương phản chữ** trong các trạng thái đã đo đạt ngưỡng. Audit có xét gradient, không coi gradient là nền trong suốt. Có kiểm tra desktop1440px, mobile375px, DPR2, zoom200%, reduced motion, forced colors và focus bàn phím. Đây là QA có phạm vi, không phải chứng nhận WCAG toàn site.
- Đổi màu/thu gọn tiêu đề không thay đổi JSON thế giới hoặc revision bản lưu. Các luồng tạo → 8app → timeline → preview/apply → compare → chat → nhật ký → export/import/reload → sync/share/clone vẫn pass.
- Không page error trong các luồng đã chạy; không tràn ngang toàn trang. Reload offline của module đã ghé vẫn mở bản IDB và dùng được News/Timeline.
- AI/backend-dependent flows dùng handler production với identity, DB bộ nhớ và Gemini fixture tường minh; không có paid AI call hoặc ghi thế giới production để thử nghiệm.

Chạy kiểm tra:

```powershell
npm run test:multiverse
# Đặt HH_QA_PLAYWRIGHT và HH_QA_CHROMIUM như hướng dẫn release1078 để chạy native QA.
npm run qa:multiverse
```

Ảnh chụp và log local ở `.study-local/hh-multiverse-1079/`: `home-desktop.png`, `gallery-desktop.png`, `gallery-prism.png`, `gallery-aurora.png`, `gallery-sunset.png`, `portrait-viewer.png`, `gallery-375.png`, `viewer-375.png`, `characters.png`, `world-375.png`, `readability.json`, `results.json`. Profile trình duyệt, input có đường dẫn cá nhân và bản xuất test không được commit.

## Giới hạn

Chọn bộ màu chỉ được lưu trên thiết bị, không đồng bộ như dữ liệu thế giới. Ảnh minh họa được chọn từ bộ tranh theo nhóm giả định; chưa tạo tranh mới riêng cho từng lần sinh thế giới hoặc sự kiện. Chân dung là minh họa, chưa suy ra loài/tuổi/ngoại hình từ mô tả AI. Engine mô phỏng và giới hạn lưu trữ của release1078 tiếp tục áp dụng.

Security CI còn có thể fail ở bước dependency audit tồn tại từ trước (5high,1low); release này không thêm hoặc đổi dependency runtime. Không coi contract tests pass là toàn bộ CI đã xanh. Production tiếp tục triển khai qua Git → Vercel hiện có.
