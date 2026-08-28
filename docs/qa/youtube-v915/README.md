# YouTube playback continuity · v915

## Phạm vi

- `youtube-playback-core.js` giữ registry singleton cho iframe YouTube, allowlist origin/command và dọn registration khi đổi route.
- `youtube-hub.js` giữ nguyên player slot khi cập nhật thư viện, queue hoặc kết quả; chỉ thay iframe khi video ID thực sự đổi.
- `youtube-hub-pro.js` debounce lưu tiến độ, chỉ poll sau khi iframe ready, theo dõi buffer và retry tối đa ba lần theo backoff mà không reload iframe.
- Loader và service worker dùng phiên bản `performance-loader.js?v=558`, `youtube-playback-core.js?v=1`, `youtube-hub.js?v=4` và `youtube-hub-pro.js?v=8`.

## Đã kiểm tra

- `node --check youtube-playback-core.js`
- `node --check youtube-hub.js`
- `node --check youtube-hub-pro.js`
- `node --test tests/youtube-playback-core.test.js tests/search-platform-workspaces.test.js tests/search-platform-pro.test.js tests/communication-search-contract.test.js tests/galaxy-brand.test.js tests/hh-eonwild-cinematic-pack.test.js tests/hh-eonwild-game.test.js` → **93/93 đạt**.
- `node --test` → **2.279/2.279 đạt**.

## Giới hạn xác minh

Kiểm thử tự động không mô phỏng được CDN, quảng cáo, giới hạn tài khoản hoặc chất lượng mạng YouTube thật. Player vẫn dùng iframe YouTube NoCookie và IFrame Player API chính thức; không proxy, downloader hoặc re-host nội dung. Độ mượt thực tế còn phụ thuộc video và kết nối của thiết bị.
