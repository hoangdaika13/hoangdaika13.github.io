# Prompt nâng cấp Hồ sơ người dùng trong Admin Panel

Bạn là Principal Product Designer, Senior Full-stack Engineer, Security Engineer và QA Engineer. Hãy nâng cấp toàn diện khu vực **Hồ sơ người dùng** trong Admin Panel của hoang8.com thành một trung tâm quản trị tài khoản 360°; mọi dữ liệu và hành động phải là dữ liệu thật, có phân quyền ở backend và có audit.

## 1. Kiến trúc và phạm vi bắt buộc

- Giữ HH Platform, App Shell, header, sidebar, breadcrumb, hash route và Admin Panel hiện tại.
- Hồ sơ người dùng mở trong drawer hoặc trang con bên trong Admin Panel; không tạo gateway/lớp giao diện mới.
- Giữ tương thích route, dữ liệu cũ, đăng nhập, Owner và các role Admin hiện có.
- Không làm mất trạng thái bộ lọc, vị trí danh sách hoặc nội dung đang xem khi đóng/mở hồ sơ.
- Owner có quyền cao nhất; Admin chỉ được thao tác trong phạm vi permission/scope được server cấp.
- Kiểm tra quyền ở server cho từng hành động; frontend chỉ là lớp hiển thị.
- Nếu backend hoặc dữ liệu chưa cấu hình, hiển thị “Chưa cấu hình dữ liệu”/“Không có quyền xem”, không tạo số liệu giả.

## 2. Tổng quan hồ sơ 360°

Tạo phần đầu hồ sơ rõ ràng, dễ quét:

- Avatar, tên hiển thị, email đã che một phần khi cần, HH ID và provider đăng nhập.
- Trạng thái tài khoản: active, locked, suspended, banned, deleted; thời hạn đình chỉ và lý do ở dạng tối thiểu.
- Huy hiệu xác minh email, Google/passkey và trạng thái consent.
- Vai trò hệ thống, role tùy chỉnh, scope và thời điểm hết hạn.
- Đăng nhập gần nhất, hoạt động gần nhất, thiết bị gần nhất, workspace gần nhất.
- Số phiên còn hiệu lực, số đăng nhập thất bại, tín hiệu bảo mật và trạng thái cần xem xét.
- Mốc tạo tài khoản, cập nhật hồ sơ, đổi provider và đổi mật khẩu gần nhất nếu backend có lưu.
- Hiển thị “Chưa ghi nhận” thay vì ngày 01/01/1970 hoặc dữ liệu suy đoán.
- Không hiển thị password, password hash, OTP, token, cookie, recovery code, API key, raw IP hoặc nội dung riêng tư.

## 3. Điều hướng hồ sơ

Chia hồ sơ thành các tab/panel có lazy-load và URL sâu nếu kiến trúc cho phép:

1. Tổng quan.
2. Đăng nhập & bảo mật.
3. Phiên và thiết bị.
4. Workspace đã sử dụng.
5. Quyền và vai trò.
6. Hoạt động hỗ trợ.
7. Audit Admin.
8. Ghi chú và xem xét.
9. Quyền riêng tư và dữ liệu.

Tab nào Admin không có quyền phải hiển thị trạng thái unauthorized rõ ràng, không âm thầm trả về dữ liệu rỗng.

## 4. Đăng nhập và bảo mật

Hiển thị timeline từ `loginEvents` đã được làm sạch:

- Thành công/thất bại, thời gian, provider, browser, hệ điều hành, loại thiết bị.
- Thiết bị mới, lý do thất bại, trạng thái suspicious/risk nếu backend ghi nhận.
- Khu vực tương đối và IP đã che; không suy đoán vị trí khi server không cung cấp.
- Bộ lọc theo thành công/thất bại, provider, thiết bị mới, khoảng thời gian và tín hiệu rủi ro.
- Tổng hợp từ dữ liệu thật: số lần thất bại, lần thành công, thiết bị mới, cảnh báo chưa xử lý.
- Phân biệt “không có dữ liệu”, “không có quyền xem” và “backend chưa cấu hình”.
- Không biến heuristic thành kết luận vi phạm; dùng nhãn “cần kiểm tra”.

## 5. Phiên và thiết bị

Tạo bảng phiên đầy đủ nhưng an toàn:

- Session ID đã rút gọn, phiên hiện tại, provider, thiết bị, browser, OS, khu vực đã che.
- Thời điểm tạo, hoạt động gần nhất, hạn JWT, hạn idle, trạng thái active/expired/revoked/logged-out/blocked.
- Lý do kết thúc phiên và Admin đã thực hiện nếu có.
- Sắp xếp theo hoạt động gần nhất; lọc phiên còn hiệu lực, hết hạn và bị thu hồi.
- Thu hồi từng phiên; thu hồi các phiên khác; thu hồi toàn bộ phiên theo quyền.
- Không bao giờ thu hồi phiên Admin hiện tại mà không có cảnh báo rõ ràng; bảo vệ bằng backend.
- Dọn phiên hết hạn bằng TTL/backend thật, không chỉ ẩn khỏi giao diện.
- Hiển thị cảnh báo khi có nhiều phiên đồng thời, nhưng không tự động khóa tài khoản.

## 6. Quyền, vai trò và scope

Hiển thị chính xác quyền hiệu lực:

- Role hệ thống, role tùy chỉnh, phiên bản role, permission được cấp trực tiếp và permission kế thừa.
- Scope global/workspace/module/account/provider và thời điểm bắt đầu/hết hạn.
- Hiển thị nguồn cấp quyền, người cấp, lý do, approval và trạng thái pending/active/revoked/expired.
- Cho phép mô phỏng quyền chỉ khi Admin có permission `permissions.simulate`; kết quả phải đánh dấu là mô phỏng.
- Owner có thể cấp/thu hồi role theo chính sách; Admin không được cấp role ngang hoặc cao hơn mình.
- Chặn thao tác trên chính tài khoản đang đăng nhập và tài khoản cấp cao hơn.
- Mọi thay đổi role/permission cần lý do, step-up/elevation hoặc dual approval nếu policy yêu cầu.
- Không cho mass assignment; server chỉ nhận các trường nằm trong allowlist.

## 7. Hành động quản trị tài khoản

Mỗi hành động phải có permission riêng, dialog xác nhận trong ứng dụng, lý do bắt buộc khi cần, trạng thái loading và kết quả thật:

- Làm mới hồ sơ.
- Xác minh/bỏ xác minh tài khoản.
- Khóa, mở khóa, đình chỉ có thời hạn, cấm hoặc khôi phục theo policy.
- Thu hồi một phiên, các phiên khác hoặc toàn bộ phiên.
- Cấp/thu hồi role và giới hạn workspace/module.
- Đánh dấu cần xem xét, bỏ đánh dấu và gán mức ưu tiên hỗ trợ.
- Gửi liên kết đổi mật khẩu qua flow bảo mật hiện có; không tự tạo mật khẩu hoặc token ở client.
- Mở workspace gần nhất chỉ khi có quyền và không giả danh người dùng.
- Sao chép HH ID/email đã che bằng nút rõ ràng, không đưa secret vào clipboard.

Không xây dựng impersonation/login-as nếu repository chưa có cơ chế an toàn, consent, banner rõ ràng, giới hạn thời gian và audit đầy đủ.

## 8. Workspace và hoạt động sử dụng

- Hiển thị workspace/module/route gần đây từ telemetry đã được người dùng cho phép.
- Thống kê theo module, số sự kiện, thời điểm gần nhất và thời lượng thô nếu có.
- Không thu thập hoặc hiển thị prompt, nội dung chat, form values, phím gõ, file riêng tư hoặc nội dung sản phẩm.
- Khi analytics consent tắt, hiển thị “Người dùng không cho phép hiển thị hoạt động chi tiết”.
- Phân biệt sự kiện telemetry, presence và login; không gọi người dùng là “online” chỉ vì còn phiên.
- Có giới hạn thời gian lưu và nhãn “tối đa N sự kiện gần nhất”.

## 9. Ghi chú, xem xét và hỗ trợ

- Ghi chú nội bộ có tác giả, thời gian tạo, thời hạn lưu, chỉnh sửa nếu backend hỗ trợ và xóa chỉ bởi tác giả/quyền phù hợp.
- Hỗ trợ Markdown/plain text an toàn; escape HTML và chống XSS.
- Không cho ghi password, token, OTP, dữ liệu thanh toán hoặc thông tin nhạy cảm vào ghi chú.
- Đánh dấu cần xem xét, lý do, mức ưu tiên, người phụ trách và thời điểm xem lại.
- Không tạo trạng thái “đã xử lý” nếu API ghi chưa thành công.
- Ghi audit cả thao tác thành công, thất bại, bị từ chối, timeout và hủy.

## 10. Quyền riêng tư và xuất dữ liệu

- Hiển thị bản tóm tắt loại dữ liệu Admin đang xem và lý do sử dụng.
- Che IP, user-agent và email theo policy; không cho bypass bằng query client.
- Export CSV/JSON theo khoảng thời gian, trường allowlist và bộ lọc hiện tại.
- Cho phép export hồ sơ hoặc audit khi có `reports.export`; giới hạn số bản ghi và rate limit.
- Neutralize công thức CSV (`=`, `+`, `-`, `@`), giữ UTF-8 và không gửi dữ liệu ra dịch vụ ngoài.
- Ghi audit người xuất, thời gian, bộ lọc, trường, số bản ghi, định dạng và kết quả.

## 11. Trải nghiệm giao diện

- Giữ phong cách Cosmic Creative Studio nhưng ưu tiên đọc dữ liệu và thao tác chính xác.
- Drawer desktop có panel cố định; mobile 375px dùng bottom sheet/toàn màn hình với nút đóng rõ ràng.
- Bảng chuyển thành card, không cuộn ngang toàn trang.
- Có hover, focus-visible, loading skeleton, empty, unauthorized, error, retry và success thật.
- Nút nguy hiểm dùng màu cảnh báo, không đặt cạnh nút an toàn gây nhầm.
- Hỗ trợ bàn phím, Escape đóng drawer, focus trap đúng chuẩn và zoom 200%.
- Tôn trọng `prefers-reduced-motion`, forced-colors và chế độ sáng/tối.
- Không dùng `alert`, `prompt`, `confirm`, không khóa body, không overlay vô hình.

## 12. Hiệu năng và độ tin cậy

- Lazy-load từng tab; hủy fetch khi đóng hồ sơ hoặc đổi tài khoản.
- Debounce tìm kiếm, phân trang server-side và giới hạn lookup/aggregation.
- Dùng projection allowlist, index theo userId/createdAt/lastSeenAt và `maxTimeMS` cho truy vấn nặng.
- Không polling hồ sơ liên tục; chỉ làm mới khi Admin yêu cầu hoặc có tín hiệu cần thiết.
- Dừng timer/listener khi rời Admin Panel; chống race condition khi mở nhanh nhiều hồ sơ.
- Cache-Control `no-store` cho dữ liệu quản trị.

## 13. Kiểm thử bắt buộc

Kiểm thử bằng dữ liệu fixture rõ nhãn, không dùng tài khoản production:

- Owner, Admin có quyền, Admin bị giới hạn scope, Support, Analyst và Member bị từ chối.
- Hồ sơ không có login event, không có session, analytics consent tắt, dữ liệu rỗng và backend chưa cấu hình.
- Tìm kiếm, lọc, sort, phân trang, URL deep-link và reload.
- Mở từng tab, chuyển tài khoản, đóng drawer, Escape, Back/Forward và hủy request.
- Thu hồi phiên hiện tại, phiên khác, toàn bộ phiên; xác nhận backend chặn đúng trường hợp.
- Đổi trạng thái, role, scope, review marker và ghi chú; kiểm tra audit thành công/thất bại.
- Chống XSS trong tên, email, note, route và user-agent; không lộ token/password/OTP.
- Export CSV/JSON, giới hạn 1.000 bản ghi, rate limit và formula injection.
- Desktop, tablet, mobile 375px, keyboard, focus, zoom 200%, reduced motion, forced-colors.
- Kiểm tra console, request lỗi, timeout, overflow ngang, bộ nhớ và timer chạy trùng.
- Chạy `node --check`, test contract, test bảo mật, build và kiểm thử trình duyệt.

## 14. Tiêu chí hoàn thành

Chỉ xác nhận hoàn thành khi:

- Hồ sơ đọc từ dữ liệu thật và không có số liệu giả.
- Mỗi hành động được server kiểm tra quyền, chống thao tác vượt cấp và có audit.
- Không trả về secret hoặc nội dung riêng tư ngoài mục đích quản trị.
- Phiên, role, status, notes, review và export hoạt động thật hoặc báo rõ chưa cấu hình.
- Không phá HH Platform, route cũ, đăng nhập hoặc các workspace khác.
- Báo cáo nêu rõ file đã đổi, chức năng đã kiểm thử, kết quả test và giới hạn backend.
- Không commit/push cho đến khi người yêu cầu xác nhận; khi được yêu cầu thì commit riêng, message rõ nghĩa và push đúng branch.
