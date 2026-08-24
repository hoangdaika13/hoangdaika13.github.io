# Prompt nâng cấp toàn bộ HH Communication OS

Bạn là Principal Product Designer, Senior Frontend Architect, Realtime Systems Engineer, chuyên gia UX, accessibility, hiệu năng, bảo mật và quyền riêng tư. Hãy kiểm tra, thiết kế lại và triển khai nâng cấp toàn bộ mục lớn **Giao tiếp** của HH Platform thành một **Communication Cockpit** chuyên nghiệp, dễ hiểu với người mới và sử dụng được thật.

Đây không phải nhiệm vụ thay màu hoặc dựng giao diện mô phỏng. Phải đọc code, chạy test, kiểm tra dữ liệu và capability hiện có trước khi sửa. Giữ nguyên các engine đang hoạt động, không làm mất dữ liệu đã lưu, không phá route, không xóa tính năng và không viết lại backend nếu hợp đồng hiện tại đã đáp ứng. Mọi capability chưa có bằng chứng phải được ghi đúng là cục bộ, chưa kết nối, chưa xác minh hoặc không được hỗ trợ.

## 1. Mục tiêu sản phẩm

Biến Giao tiếp thành một workspace độc lập trong App Shell, nơi người dùng luôn hiểu:

1. Họ đang ở module nào.
2. Dữ liệu đang chạy cục bộ hay đã kết nối máy chủ.
3. Hành động nào có hiệu lực thật và hành động nào cần adapter, realtime hoặc provider.
4. Việc gì cần làm tiếp theo.
5. Dữ liệu nào có thể rời thiết bị và chỉ rời thiết bị sau sự đồng ý nào.

Kết quả cuối phải:

- Hiển thị trực tiếp trong App Shell, không giống một modal lớn.
- Dùng được đủ 15 view hiện có, không tạo nút giả.
- Có bố cục rõ ràng trên desktop và mobile.
- Không mất chữ, khóa cuộn, tràn ngang hoặc mất dữ liệu nhập dở.
- Không reload cả trang chỉ để thử mount lại một engine.
- Không giả người online, trạng thái realtime, provider, AI hoặc E2EE.
- Giữ local-first làm chế độ an toàn mặc định.
- Nâng cấp thẩm mỹ và animation nhưng không gây lag hoặc che nội dung.

## 2. Audit bắt buộc trước khi sửa

Trước khi triển khai, hãy lập bảng audit có bằng chứng theo từng file và từng view.

### 2.1. Kiến trúc và route

Kiểm tra ít nhất:

- `communication-suite.js` và `communication-suite.css`.
- `communication-workspace-fix.css`.
- `communication-command-center.js/css`.
- `communication-messenger-next.js/css`.
- `communication-channels-forum.js/css`.
- `communication-live-room.js/css`.
- `communication-canvas-automation.js/css`.
- `communication-intelligence.js/css`.
- `script.js`, `index.html`, `performance-loader.js` và `sw.js`.
- Các API/serverless endpoint liên quan.
- `realtime-server/src/communication-v2.js` và các test realtime.
- Tất cả `tests/communication-*.test.js`.

Xác định rõ:

- Route nào mount engine nào.
- State nào được giữ khi đổi route.
- Listener, timer, media stream, socket subscription và animation loop nào cần dọn khi unmount.
- Có chỗ nào render lại toàn bộ root làm mất focus, vị trí cuộn hoặc dữ liệu nhập.
- Có route/lớp cũ nào lóe phía sau khi chuyển view hoặc nhấn F5.
- Có thao tác retry nào đang dùng `location.reload()`.
- Có font 7–11px, tab ngang quá chật hoặc nội dung bị cắt.
- Có nguồn dữ liệu nào đang bị gắn nhãn “Sẵn sàng”, “Online”, “AI” hoặc “Realtime” chỉ vì engine tồn tại.

### 2.2. Ma trận chức năng thật

Với từng control, ghi:

| View | Control | Engine hiện có | Dữ liệu thật | Chế độ fallback | Backend cần thiết | Trạng thái |
|---|---|---|---|---|---|---|
| Ví dụ | Gửi tin | Messenger store | Local draft | Lưu cục bộ | Realtime adapter để gửi thiết bị khác | Local/Realtime |

Không coi việc nút có click handler là bằng chứng chức năng đã hoàn chỉnh. Phải kiểm tra kết quả, persistence, lỗi, retry, cleanup và quyền truy cập.

### 2.3. Dữ liệu và migration

- Liệt kê toàn bộ key `hh.communication.*` hiện có.
- Xác định schema/version, giới hạn dữ liệu và cơ chế normalize.
- Thiết kế migration không phá profile cũ.
- Không tự seed lại dữ liệu mẫu sau khi người dùng đã có dữ liệu.
- Dữ liệu mẫu phải ghi rõ là cục bộ và không được tạo người online giả.
- Không xóa dữ liệu cũ chỉ vì schema mới không nhận ra một field.

## 3. Giữ đủ 15 view và làm mỗi view khác biệt

Không gộp mất chức năng. Sidebar phải chứa đúng 15 view hiện có, mỗi view xuất hiện đúng một lần:

1. `command-center` — Tổng quan giao tiếp.
2. `unified-inbox` — Hộp thư hợp nhất.
3. `messenger` — Tin nhắn trực tiếp và nhóm.
4. `channels` — Kênh cộng đồng.
5. `forum` — Thảo luận theo chủ đề.
6. `live-room` — Phòng trực tiếp.
7. `calls` — Cuộc gọi âm thanh/video.
8. `shared-canvas` — Canvas cộng tác.
9. `automation` — Tự động hóa giao tiếp.
10. `hh-spaces` — Không gian làm việc/chia sẻ.
11. `notifications` — Trung tâm thông báo.
12. `universal-search` — Tìm kiếm toàn bộ giao tiếp.
13. `smart-catch-up` — Bắt kịp nội dung đã bỏ lỡ.
14. `onboarding` — Hướng dẫn thành viên mới.
15. `moderation` — Kiểm duyệt và an toàn.

Nhóm sidebar đề xuất:

- **Tổng quan**: Command Center, Unified Inbox.
- **Trò chuyện**: Messenger, Channels, Forum.
- **Trực tiếp**: Live Room, Calls.
- **Cộng tác**: Shared Canvas, Automation, HH Spaces.
- **Thông minh & An toàn**: Notifications, Universal Search, Smart Catch-up, Onboarding, Moderation.

Mỗi view phải có giao diện, trạng thái rỗng, hướng dẫn và hành vi đúng với tên của nó. Không dùng một card grid hoặc một template lớn cho cả 15 view.

## 4. Bố cục Communication Cockpit

```text
┌ HH Communication ─ Tìm kiếm ─ Tạo mới ─ Trạng thái ─ Hồ sơ ┐
├────────────────┬──────────────────────────────┬───────────────┤
│ Điều hướng     │ Workspace hiện tại           │ Ngữ cảnh      │
│                │                              │               │
│ Nhóm view      │ Nội dung tương tác chính     │ Chi tiết      │
│ 15 chức năng   │                              │ Thành viên    │
│                │                              │ File/quyền    │
│ Trạng thái     │                              │ Hành động     │
├────────────────┴──────────────────────────────┴───────────────┤
│ Local/Adapter/Realtime/Provider · Đồng bộ · Quyền riêng tư   │
└───────────────────────────────────────────────────────────────┘
```

### 4.1. Desktop

- Dùng `height: calc(100dvh - app chrome)` và `min-height: 0` xuyên suốt grid/flex.
- App route và Cockpit dùng nền opaque, `isolation: isolate`; không nhìn thấy route cũ phía sau.
- Sidebar rộng khoảng 248–280px, có thể thu gọn nhưng không làm mất tên view.
- Inspector bên phải khoảng 300–340px, có thể đóng.
- Header, status rail và composer không che nội dung.
- Chỉ workspace giữa là vùng cuộn chính; không cuộn toàn trang.
- Không dùng thanh tab ngang cho 15 view.
- Giữ focus, draft, selection và vị trí cuộn hợp lý khi chuyển view.
- Retry chỉ remount engine lỗi; không reload App Shell.

### 4.2. Typography

- Nội dung chính tối thiểu 16px.
- Hướng dẫn và đoạn văn 16–18px.
- Mục sidebar 14–16px.
- Metadata tối thiểu 12px và có độ tương phản đạt chuẩn.
- Tiêu đề card 17–20px.
- Line-height khoảng 1.5–1.7.
- Không dùng chữ 7–11px cho trạng thái hoặc thông tin quan trọng.
- Không dùng chữ xám mờ trên nền đen; dùng lavender/cyan sáng vừa đủ.

### 4.3. Mobile

- Bottom navigation gồm: Tổng quan, Hộp thư, Tin nhắn, Trực tiếp, Thêm.
- “Thêm” mở bottom sheet chứa các view còn lại, được nhóm như desktop.
- Bottom sheet cao khoảng 80–85dvh, có tay nắm, nút đóng và focus trap.
- Inspector mở bằng bottom sheet riêng.
- Vùng chạm tối thiểu 44–48px.
- Khóa cuộn nền khi sheet mở.
- Không cuộn ngang; composer không bị bàn phím che.
- Giữ draft và state khi xoay màn hình.
- Chỉ panel đang mở được cuộn.

## 5. Yêu cầu riêng cho từng view

### 5.1. Communication Command Center

- Tóm tắt tin chưa đọc, mention, ticket, cuộc gọi và tác vụ cộng tác từ dữ liệu thật.
- Một CTA chính theo ngữ cảnh, ví dụ “Tiếp tục cuộc trò chuyện”.
- Trạng thái nguồn dữ liệu luôn hiển thị rõ.
- Không hiện card trống hàng loạt; thay bằng hướng dẫn kết nối hoặc tạo nội dung.

### 5.2. Unified Inbox

- Gom DM, nhóm, kênh, bình luận, mention và ticket.
- Lọc theo nguồn, chưa đọc, mention, ghim, snooze, lưu trữ và thời gian.
- Hành động hàng loạt có xác nhận phù hợp.
- Mở đúng hội thoại nguồn, không nhân bản dữ liệu.
- Giữ focus/vị trí cuộn khi đánh dấu hoặc trả lời.

### 5.3. Messenger

- Danh sách phòng, hội thoại và inspector thành viên rõ ràng.
- Draft theo từng phòng, reply, reaction, pin, edit, recall và tìm kiếm thật.
- Trạng thái gửi phải phân biệt `local`, `queued`, `sent`, `delivered`, `failed` dựa trên acknowledgment thật.
- Translation chỉ gắn tên provider khi adapter trả về kết quả đã xác nhận.
- Không tuyên bố E2EE; nếu hiện tại chỉ HTTPS/TLS thì phải viết đúng như vậy.

### 5.4. Channels

- Kênh public/private/shared, quyền role, slow mode và thread.
- Presence chỉ hiện sau adapter/socket xác nhận.
- Member/guest không được tự nâng quyền.
- Link nguy hiểm và active-content phải bị chặn hoặc cảnh báo.

### 5.5. Forum

- Chủ đề, tag, trạng thái solved/open/guide, reply theo luồng.
- Tìm kiếm tiếng Việt và bộ lọc kết hợp.
- Report, moderation queue và audit trail bất biến.
- Nội dung người dùng luôn escape/sanitize.

### 5.6. Live Room

- Participant, reaction, hàng đợi media, host control và ghi chú có consent.
- Phân biệt BroadcastChannel cục bộ với phòng realtime nhiều thiết bị.
- Tệp local không tự upload.
- Đồng bộ play/pause/seek chỉ gắn nhãn realtime khi có event/ack thật.

### 5.7. Calls

- Device preview chỉ chạy sau thao tác chủ động.
- Hiển thị trạng thái permission, ICE/STUN/TURN và lỗi dễ hiểu.
- Dọn stream/track/peer connection khi rời phòng.
- Không lưu token, room ID nhạy cảm hoặc device ID vào localStorage.
- Chỉ mô tả DTLS-SRTP/WebRTC đúng phạm vi; không đổi thành tuyên bố E2EE.

### 5.8. Shared Canvas

- Note, checklist, decision, assignee, file metadata và chuyển thành task.
- Lưu metadata an toàn; không lưu byte file/base64 ngoài ý muốn.
- Nếu chưa có backend collaboration, ghi “Canvas cục bộ”; không hiện con trỏ cộng tác giả.
- Operation sync phải có version/ordering/deduplication khi realtime được kết nối.

### 5.9. Automation

- Trigger → Điều kiện → Hành động.
- Rule mới mặc định tắt.
- Có test/dry-run, preview, log, retry và chống vòng lặp.
- Hành động gửi, xóa, đổi quyền hoặc publish cần xác nhận.
- Không chạy automation server nếu chưa có adapter/backend.

### 5.10. HH Spaces

- Work presence, Creative Room, Focus Circle, Context Capsule và playback comment.
- Presence cục bộ phải gắn nhãn cục bộ.
- Shared state nhiều thiết bị cần room auth và acknowledgment.
- Smart summary dùng local extractive mặc định; chỉ ghi AI khi provider thật xử lý.

### 5.11. Notifications

- Lọc nguồn, ưu tiên, mute, người quan trọng và nhóm thông báo tương tự.
- Push permission chỉ xin sau thao tác người dùng.
- Digest local phải ghi “Digest cục bộ”.
- Không giả push đang hoạt động khi service worker/permission chưa sẵn sàng.

### 5.12. Universal Search

- Tìm message, file, channel, member, thread và task theo phạm vi/quyền.
- Có filter người gửi, ngày, loại, reaction và workspace.
- Semantic expansion cục bộ không được gắn nhãn AI.
- Kết quả không được làm lộ nội dung của phòng người dùng không có quyền.

### 5.13. Smart Catch-up

- Tách tóm tắt, quyết định, hành động và nội dung chưa đọc.
- Mặc định xử lý cục bộ, deterministic và có source count.
- Mỗi lần gửi dữ liệu lên adapter/AI phải có consent rõ.
- Ghi rõ phần nào là trích xuất, phần nào do provider tạo.
- Không lưu nội dung catch-up nếu người dùng chưa bật “Ghi nhớ”.

### 5.14. Onboarding

- Checklist gia nhập, quy tắc, kênh nên theo dõi và cài đặt quyền riêng tư.
- Tiến độ onboarding lưu theo tài khoản/profile.
- Không tự thêm người dùng vào phòng hoặc bật thông báo nhạy cảm.
- Hướng dẫn từng bước, một CTA chính và có thể bỏ qua.

### 5.15. Moderation & Safety

- Report, block, mute, rate limit, moderation queue và audit log.
- Quyền owner/admin/moderator/member/guest phải được kiểm tra phía server cho hành động server.
- Không chỉ ẩn nút ở frontend.
- Không hiển thị PII không cần thiết trong log.
- Có lý do, trạng thái, lịch sử và quy trình kháng nghị nếu backend hỗ trợ.

## 6. Capability phải trung thực

Tạo một resolver dùng chung, không suy diễn từ việc một object có hàm `mount()`.

Mỗi capability phải trả về dữ liệu có cấu trúc tương đương:

```js
{
  state: "local" | "adapter" | "realtime" | "provider" |
         "needs-connection" | "unsupported" | "unknown" | "error",
  available: false,
  verified: false,
  source: "local" | "browser" | "adapter" | "socket" | "provider",
  label: "Chế độ cục bộ",
  reason: "Chưa nhận được xác nhận từ realtime server",
  checkedAt: null
}
```

Quy tắc:

- `local`: engine cục bộ thật sự xử lý được hành động.
- `adapter`: adapter trả `connected/confirmed` rõ ràng.
- `realtime`: socket đã kết nối và handshake hợp lệ.
- `provider`: đã cấu hình, xác minh và hành động/provider liên quan phản hồi hợp lệ.
- Engine tồn tại không đồng nghĩa realtime/provider sẵn sàng.
- Trạng thái trống mặc định là `unknown` hoặc `needs-connection`, không phải online.
- UI phải hiển thị lý do và hành động tiếp theo.
- Không tạo số người online, latency, delivery receipt hoặc provider quota ngẫu nhiên.
- Không tuyên bố E2EE khi backend hiện quảng bá `endToEndEncryption: false`.

## 7. Realtime và backend

- Giữ và tái sử dụng hợp đồng event hiện có; không tạo protocol thứ hai trùng chức năng.
- Realtime phải có authentication, membership/room authorization và payload validation.
- Server-authoritative cho role, moderation, delivery receipt và trạng thái cạnh tranh/quyền hạn.
- Có reconnect, exponential backoff, deduplication, sequence/version và resync.
- Có rate limit, giới hạn payload, timeout và audit event.
- Khi socket mất kết nối, chuyển về local/queued đúng sự thật; không làm mất draft.
- Queue gửi lại chỉ chạy khi idempotency key ngăn gửi trùng.
- Không dùng `location.reload()` để chữa lỗi mount hoặc reconnect.
- Provider/server chưa cấu hình phải có CTA “Kết nối” hoặc hướng dẫn, không tạo dữ liệu mẫu giả như phản hồi thật.
- Nếu một tính năng cần backend mới, ghi rõ contract, endpoint/event, auth và fallback trước khi triển khai.

## 8. Bảo mật và quyền riêng tư

- Không hardcode API key, client secret, bot token, access token hoặc refresh token.
- Không đưa credential vào HTML, URL, log, QR, localStorage hoặc export.
- Escape/sanitize toàn bộ message, tên phòng, file metadata, URL và nội dung forum.
- Kiểm tra quyền phía server; frontend guard chỉ là lớp UX.
- Chặn XSS, CSRF, clickjacking, prototype pollution và URL scheme nguy hiểm.
- Validate schema, type, length, MIME, file size và message size.
- Clipboard, microphone, camera, screen share, notification và geolocation chỉ được yêu cầu sau thao tác chủ động.
- Hiển thị permission state trung thực; trang web không được giả đã thu hồi quyền do trình duyệt quản lý.
- Report/log/export phải tự che email, ID nhạy cảm, token và nội dung không cần thiết.
- Smart Catch-up/AI/translation phải hiển thị dữ liệu nào sẽ gửi, provider nào nhận và chỉ gửi sau consent.
- Dữ liệu phòng private không được lọt vào universal search, digest hoặc telemetry trái quyền.
- Chế độ guest và tài khoản phải cách ly state.

## 9. Accessibility

- Keyboard sử dụng được toàn bộ sidebar, workspace, inspector và composer.
- Có `:focus-visible` rõ ràng.
- Sidebar dùng `nav` có tên; mục hiện tại dùng `aria-current="page"`.
- Workspace chính dùng `main` hoặc role/label tương đương.
- Status mới dùng `aria-live="polite"`, không đọc lại toàn trang.
- Dialog/bottom sheet có `aria-labelledby`, focus trap, Escape và trả focus về nút mở.
- Icon-only button phải có `aria-label` và tooltip.
- Không chỉ dùng màu để biểu thị local/realtime/error.
- Tôn trọng zoom 200%, font hệ thống và Windows forced-colors.
- Mobile có vùng chạm tối thiểu 44px.
- Composer, error và CTA không bị bàn phím che.

## 10. Hiệu năng và vòng đời

- Không render lại toàn bộ Communication Cockpit cho cập nhật nhỏ.
- Tách shell state, engine state, realtime adapter, capability resolver và view renderer.
- Khi đổi view, dọn listener, observer, timer, animation frame, object URL, media stream và socket room subscription của view cũ.
- Không disconnect socket dùng chung chỉ vì đổi view; chỉ unsubscribe phạm vi view.
- Dùng event delegation hợp lý và tránh gắn listener lặp sau remount.
- Virtualize/page danh sách message, notification, search result và audit log dài.
- Debounce search/typing indicator và batch DOM update.
- Dùng IndexedDB cho lịch sử lớn/file metadata phù hợp; localStorage chỉ giữ preference và state nhỏ có version.
- Tạm dừng animation/visualizer khi `document.hidden`.
- Chỉ dùng transform/opacity cho animation thường xuyên.
- Giới hạn blur, shadow, particle và DPR theo thiết bị.
- Không kéo dài loading giả; engine sẵn sàng là hiển thị ngay.

## 11. Hệ màu và animation riêng

Giữ phong cách vũ trụ nhưng mỗi module có nhận diện riêng, animation có mục đích:

- Command Center: cyan–violet; tín hiệu hội tụ vào bảng điều khiển.
- Unified Inbox: violet–blue; packet sáng đi vào đúng nguồn.
- Messenger: cyan–magenta; message bubble xuất hiện nhẹ theo trạng thái gửi.
- Channels: blue–emerald; node thành viên nối vào kênh sau xác nhận presence.
- Forum: amber–violet; thread mở như nhánh dữ liệu.
- Live Room: coral–magenta; waveform chỉ phản ứng khi có media thật.
- Calls: cyan–green; vòng tín hiệu đổi theo connecting/connected/failed.
- Shared Canvas: mint–violet; card hội tụ vào canvas khi tạo thật.
- Automation: orange–pink; luồng Trigger → Condition → Action.
- HH Spaces: violet–gold; capsule và focus circle chuyển động nhẹ.
- Notifications: cyan–amber; pulse một lần khi có thông báo mới.
- Universal Search: bốn tia quét hội tụ vào kết quả.
- Smart Catch-up: lavender–cyan; các đoạn thật gom thành summary.
- Onboarding: emerald–gold; checkpoint sáng dần theo tiến độ.
- Moderation: coral–blue; radar quét chậm, không tạo cảm giác cảnh báo giả.

Nguyên tắc:

- Chỉ module đang mở chạy hiệu ứng đáng kể.
- Không chạy animation mạnh sau khi người dùng bắt đầu đọc hoặc nhập.
- Dừng khi tab ẩn.
- Hỗ trợ Tĩnh, Cân bằng và Điện ảnh.
- `prefers-reduced-motion` phải vô hiệu animation không thiết yếu.
- Không dùng animation che chữ, làm đổi layout hoặc gây mất focus.
- Không hiển thị chấm xanh/pulse “online” khi chưa có xác nhận thật.

## 12. Retry, lỗi và khôi phục

- Retry chỉ remount engine hiện tại và giữ route, draft, focus, selection, scroll.
- Không gọi `location.reload()`.
- Phân biệt lỗi tải asset, lỗi engine, mất realtime, provider chưa cấu hình, permission denied và dữ liệu invalid.
- Mỗi lỗi có thông báo dễ hiểu và hành động phù hợp: Thử lại, Làm việc cục bộ, Kết nối lại, Mở cài đặt hoặc Sao chép báo cáo đã che dữ liệu.
- Có timeout và tránh retry loop vô hạn.
- Khi crash, giữ draft/checkpoint và cho phép khôi phục an toàn.
- Không gửi report tự động nếu chưa có consent.

## 13. Kiểm thử và QA bắt buộc

### 13.1. Automated tests

Chạy tối thiểu:

```powershell
node --check communication-suite.js
node --test tests/communication-*.test.js
npm --prefix realtime-server test
git diff --check
```

Contract mới phải bao phủ:

- Đủ 15 view, được nhóm và không trùng.
- Direct Cockpit mount, `100dvh` và một vùng cuộn chính.
- Typography không có micro-label quan trọng.
- Capability local/adapter/realtime/provider có bằng chứng.
- Không giả E2EE, online, provider hoặc AI.
- Retry không reload trang.
- Mobile bottom navigation và bottom sheet.
- Visibility pause và reduced motion.
- Keyboard, focus trap, trả focus, `aria-live` và forced-colors.
- Listener/timer/media cleanup khi unmount.

### 13.2. Browser QA

Kiểm tra ít nhất:

- 375×812.
- 768×1024.
- 1366×768.
- 1920×1080.
- Zoom 80%, 100%, 125%, 150% và 200%.
- Keyboard-only.
- Reduced motion.
- Windows high contrast nếu môi trường hỗ trợ.
- Online, offline, socket mất giữa phiên và provider chưa cấu hình.
- Permission allow, deny và unsupported.
- Route đổi liên tục giữa đủ 15 view.
- F5 trực tiếp trên từng route con.

Xác minh:

- Không tràn ngang.
- Không khóa cuộn hoặc có nhiều vùng cuộn cạnh tranh.
- Không lộ route/lớp cũ phía sau.
- Không mất draft, focus hoặc scroll không mong muốn.
- Không listener/timer/media stream bị rò sau unmount.
- Console không có lỗi.
- Không có secret trong source, HTML, storage, log hoặc export.
- Không có capability label sai sự thật.

## 14. Definition of Done

Chỉ coi là hoàn tất khi:

- Đủ 15 view truy cập được từ sidebar và command search.
- Mỗi view có giao diện, mục đích và engine đúng tên.
- Core control tạo kết quả thật hoặc trạng thái không hỗ trợ rõ ràng.
- Dữ liệu cũ được migrate và không bị mất.
- Local-first hoạt động khi backend/realtime/provider không có.
- Realtime/provider chỉ sáng sau xác nhận thật.
- Không tuyên bố E2EE khi chưa triển khai và kiểm toán phù hợp.
- Retry không reload App Shell.
- Desktop/mobile đúng bố cục và vùng cuộn.
- Accessibility, reduced motion và visibility lifecycle đạt contract.
- Toàn bộ test cũ và test mới đạt.
- Browser QA không có lỗi console hoặc lớp giao diện chồng nhau.
- Asset version/cache được cập nhật để production nhận bản mới.
- Không có secret hoặc dữ liệu riêng tư bị lộ.

## 15. Báo cáo bàn giao

Sau khi hoàn tất, báo cáo:

1. File đã thay đổi.
2. Engine và dữ liệu hiện có đã được giữ như thế nào.
3. Chức năng local hoạt động thật.
4. Chức năng adapter/realtime/provider đã xác minh.
5. Chức năng vẫn cần backend/provider và lý do.
6. Migration đã chạy.
7. Test/QA đã chạy và kết quả.
8. Các giới hạn bảo mật hoặc browser còn tồn tại.
9. Commit hash và đường dẫn commit sau khi commit/push lên `origin/main`.

Không được báo “hoàn tất toàn bộ” nếu còn nút giả, capability chưa xác minh, test đỏ, dữ liệu chưa migrate hoặc backend bắt buộc chưa được triển khai. Ưu tiên tính đúng, an toàn và dễ dùng trước độ màu mè; animation chỉ được tăng sau khi luồng sử dụng, accessibility và hiệu năng đã đạt.
