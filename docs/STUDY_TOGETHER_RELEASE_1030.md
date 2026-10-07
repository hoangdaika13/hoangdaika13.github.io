# Học cùng nhau · release 1030

## Đã triển khai

Route `/learn/study-together` là một trang con của Học tập trong HH Platform, có mặt trong sidebar và registry tìm kiếm lệnh. Nút tương ứng nằm trong HH School. Không thay App Shell, auth flow, route trang chủ hoặc các workspace khác.

- Tạo phòng, mã mời ngẫu nhiên 16 ký tự, tham gia/rejoin; tối đa 32 người theo cấu hình SFU, tối đa 5 phòng đang mở cho mỗi chủ phòng.
- Phòng chờ có duyệt/từ chối thật trước khi cấp token; chủ phòng đổi mã, tắt mic, mời thành viên ra, cập nhật quyền và kết thúc phòng.
- Mic/camera mặc định tắt; preview riêng tư, chọn thiết bị, âm lượng nghe, chất lượng camera 360p/720p/1080p áp dụng lần bật tiếp theo, lưới/người nói, chia sẻ màn hình qua API trình duyệt.
- Chat phiên học, giơ tay, cảm xúc qua reliable LiveKit data packets; đồng hồ tập trung dùng metadata do backend cập nhật, ghi chú cá nhân account-scoped trên thiết bị.
- Nhấn giữ V để nói; trạng thái mất mạng/kết nối lại, xử lý từ chối thiết bị; dừng track/preview, disconnect và gỡ listener/timer khi rời workspace hoặc đổi tài khoản.
- Chữ 200%, 375px/tablet/desktop, focus rõ, reduced-motion/forced-colors; không khóa body. SDK chỉ lazy-load khi mở phòng.

Không ghi âm/ghi hình, không ghi chat vào database, không có thống kê hoặc người tham gia giả. Không cam kết E2EE; backend media LiveKit có vai trò trung chuyển. Mã mời và dữ liệu quyền phòng hết hạn sau 24 giờ; đây không phải lịch tự ngắt một cuộc gọi đang diễn ra. Thành viên đã được duyệt có thể rejoin bằng room ID cho đến khi bị chặn/đóng/hết hạn.

## Backend và dữ liệu

`/api/study-together` rewrite vào function modules hiện có, không vượt ngân sách 12 Vercel functions. Dùng `currentUser`, chống mutation trái nguồn, rate limit và MongoDB hiện có. Các collection `studyTogetherRooms` / `studyTogetherMembers` có TTL và index được tạo khi sử dụng.

Identity/tên/vai trò lấy từ tài khoản đã xác thực. Backend giữ API secret; browser chỉ nhận room-scoped join token TTL 90 giây trong bộ nhớ, không có grant quản trị SFU. Mã mời chỉ lưu SHA-256. Quyền microphone/screen được ký từ chính sách phòng. Chặn thành viên là authoritative trong backend; việc revoke token đã cấp phụ thuộc phiên bản LiveKit được triển khai, cần kiểm thử lại trên hạ tầng công khai.

Ghi chú: `hh.studyTogether.notes.v1.<accountId>`. Tùy chọn: `hh.studyTogether.preferences.v1.<accountId>`. Chat chỉ tồn tại trong phiên; không tự động rejoin hay bật lại thiết bị sau reload. Ghi chú vẫn được mở lại.

## LiveKit cục bộ đã tự dựng

Chạy tại root repository trên Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-livekit-local.ps1
```

Script tải LiveKit server **1.13.8** từ release chính thức và kiểm tra SHA-256 trước khi chạy. Bind loopback `127.0.0.1`: signal 7880, RTC TCP 7881, UDP 7882. Sinh khóa ngẫu nhiên riêng; `.study-local/credentials.json`, YAML, binary, PID và log bị loại khỏi Git. Không in khóa. Đây là máy chủ thử nghiệm một máy, không mở firewall hoặc cung cấp endpoint công khai. Chính sách thực thi chỉ áp dụng cho tiến trình lệnh này.

Để chạy backend thật cục bộ, nạp riêng các giá trị `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` từ file private này vào môi trường backend cùng cấu hình MongoDB/auth hiện có, rồi chạy `npm start` và mở với `?api=local`. Không chép khóa vào `config.js`/frontend. CSP chỉ bổ sung bốn URL HTTP/WS loopback đúng port 7880, không mở mọi `ws:` endpoint. Backend production từ chối endpoint WS không bảo mật.

Dừng đúng instance do script tạo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-livekit-local.ps1 -Stop
```

## Phần cần hạ tầng công khai

Chưa tạo tài khoản LiveKit Cloud, chưa cấp VPS/domain và chưa đặt biến môi trường trên backend production. Không có quyền truy cập hạ tầng này trong môi trường hiện tại. Push mã không đồng nghĩa phòng học đã hoạt động công khai trên hoang8.com.

Hai lựa chọn: dự án LiveKit Cloud hoặc máy chủ LiveKit self-host. Self-host cần endpoint `wss://`, TLS đáng tin cậy, public IP/RTC ports và TURN cho các mạng hạn chế theo hướng dẫn chính thức. SFU là dịch vụ chạy lâu dài, không nằm trong Vercel serverless function. Đặt ba biến server-only ở backend hiện có, deploy lại rồi kiểm thử ít nhất hai thiết bị trên hai mạng khác nhau. Không gửi API secret vào chat hoặc commit. Config API chỉ xác nhận đủ cấu hình, không giả lập kết nối thành công.

## Bằng chứng kiểm thử 2026-10-07

- **113/113** Node tests: 12 Study Together tests, HH School, Platform home/shell, navigation, runtime routing, release/cache alignment và request security.
- `npm run test:security:full`: **106/106** tests auth/security/readiness đạt (có một số contract trùng bộ trên; không cộng thành số lượng unique).
- `node --check` trên các JS thay đổi và gateway: đạt; `git diff --check`: đạt.
- Playwright/Chromium headless với **LiveKit server thật**, hai browser contexts, camera/mic test devices; database và danh tính được ghi rõ là QA doubles, không phải đăng nhập production.
- Phòng chờ → chủ phòng duyệt → hai người kết nối; camera có frame video nhận được, microphone có audio track nhận được; literal HTML trong chat không được thực thi; giơ tay và đồng hồ chung đồng bộ.
- Screen-share source từ canvas **tổng hợp**, video nhận được qua SFU; không quay màn hình cá nhân. Hủy chia sẻ là lỗi `NotAllowedError` được inject có chủ đích, chưa chứng minh thao tác chọn/hủy OS dialog trên thiết bị thật.
- Nhấn/nhả V bật/tắt mic; host close ngắt peer và kết thúc local tracks. Preview đang chạy được dừng khi unmount.
- Notes giữ sau reload, không trộn sang tài khoản khác. Mic/cam không tự bật sau reload.
- Viewport 1440/768/375 và font 200% không overflow ngang; connected mobile cũng kiểm tra 200%; zero `pageerror`. Snapshot chỉ trong thư mục Temp, không commit browser profile.
- Chưa kiểm thử mic/cam vật lý, Safari/iOS, mạng WAN/TURN, mất mạng kéo dài hay tải 32 người. Route/shell được kiểm tra bằng contracts, không thay bằng tuyên bố đăng nhập production đã kiểm thử.
- Repository không có lệnh lint/typecheck/build riêng. Dùng syntax + contract/runtime/browser tests; không tuyên bố đã chạy các lệnh không có.
- `npm audit --omit=dev`: còn 1 low ở `@simplewebauthn/server@13.2.2`, 1 high ở `@vercel/blob` → `undici@6.28.0`; cả hai version giống lockfile trước thay đổi này. Không tự nâng dependency auth/storage ngoài phạm vi.

Reproduce browser QA: start local server, cung cấp đường dẫn Playwright qua `HH_PLAYWRIGHT_PATH` và Chromium qua `HH_BROWSER_EXECUTABLE`, chạy `node scripts/qa-study-together.js`. Test chỉ serve bốn file allowlisted trên loopback và luôn xóa phòng QA do chính nó tạo. Không expose khóa hoặc dùng auth QA trong handler production.

## Nguồn và giấy phép

- [LiveKit client SDK](https://github.com/livekit/client-sdk-js): **Apache-2.0**, pinned `livekit-client@2.22.3`. Vendored official UMD + LICENSE trong `vendor/`; tái tạo bằng `npm run sync:livekit`. Áp dụng Room/events, track attachment, devices, adaptive stream, dynacast và simulcast.
- [LiveKit server SDK](https://github.com/livekit/node-sdks): **Apache-2.0**, pinned `livekit-server-sdk@2.19.1`. Áp dụng AccessToken, RoomServiceClient, metadata và host moderation; không sao chép website hay thương hiệu.
- [LiveKit server](https://github.com/livekit/livekit/releases/tag/v1.13.8): **Apache-2.0**. Official Windows binary cho local QA; không commit binary/secret.
- [Room API](https://docs.livekit.io/reference/client-sdk-js/classes/Room.html), [server SDK](https://docs.livekit.io/reference/server-sdk-js/), [local setup](https://docs.livekit.io/transport/self-hosting/local/), [production deployment](https://docs.livekit.io/transport/self-hosting/deployment/): tham khảo tích hợp và giới hạn hạ tầng, không sao chép tài nguyên từ Discord/Meet/Zoom.
