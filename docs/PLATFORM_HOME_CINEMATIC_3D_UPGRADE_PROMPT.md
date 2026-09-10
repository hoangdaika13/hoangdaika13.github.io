# Prompt nâng cấp Trang chủ HH Platform thành vũ trụ 3D điện ảnh

Bạn là Principal Product Designer, Senior Frontend/WebGL Engineer, Motion Designer, Performance Engineer và QA Engineer. Hãy trực tiếp khảo sát, thiết kế lại và triển khai nâng cấp toàn diện **Trang chủ HH Platform** trên website `hoang8.com` thành một **Cinematic Living Cosmos Command Center**: có chiều sâu 3D, nhiều màu sắc, chân thật, cao cấp và sống động như một cảnh phim khoa học viễn tưởng, nhưng toàn bộ nội dung và thao tác vẫn phải rõ ràng, dễ dùng và hoạt động thật.

Đây không phải nhiệm vụ chỉ thay màu hoặc thêm animation trang trí. Phải đọc code hiện tại, xác định đúng owner/lifecycle, giữ chức năng đang chạy, sửa vấn đề có bằng chứng và kiểm thử trực tiếp trước khi báo hoàn thành. Không quảng cáo khả năng chưa có, không tạo dữ liệu giả và không đánh đổi khả năng sử dụng để lấy hiệu ứng.

## 1. Kiến trúc bắt buộc

- `/platform` là route canonical của Trang chủ HH Platform Lớp 2 và là khung giao diện chính.
- HH Galaxy là một mục lớn bên trong HH Platform; không biến Galaxy thành một lớp giao diện hoặc gateway độc lập.
- Giữ nguyên App Shell, header, sidebar, breadcrumb, command palette, hồ sơ, trạng thái điều hướng và vùng nội dung chính.
- Không khôi phục HH CORE gateway bắt buộc, nút chuyển hai lớp hoặc màn hình trung gian trước Trang chủ.
- Không tạo một trang chủ thứ hai song song với `platform-home.js` / `platform-home.css`.
- Dùng và mở rộng `home-cosmos-motion.js` / `home-cosmos-motion.css` nếu đúng owner; không khởi tạo nhiều renderer cạnh tranh.
- Giữ tương thích `/home` và deep link cũ theo router hiện tại, nhưng không thay đổi quyền sở hữu canonical của `/platform`.
- Không làm hỏng đăng nhập, phiên khách, phân quyền Admin, dữ liệu đã lưu, favorites, pins, recents hoặc route của workspace.
- Khi mở workspace rồi quay lại Trang chủ, App Shell và trạng thái Trang chủ phải được phục hồi ổn định, không đổi bố cục hoặc mount chồng.

## 2. Audit trước khi sửa

Đọc tối thiểu:

- `platform-home.js`, `platform-home.css`.
- `home-cosmos-motion.js`, `home-cosmos-motion.css`.
- `galaxy-shell.js`, `galaxy-shell.css` và tài liệu HH Galaxy Design System.
- `script.js`, `performance-loader.js`, `index.html`, `sw.js`.
- Các test `platform-home*`, `home-cosmos-motion*`, `galaxy-shell*` và release consistency.

Lập danh sách có bằng chứng về:

- Owner thật của từng DOM layer, renderer, RAF, timer, observer và listener.
- Phần nào thuộc nội dung Trang chủ, phần nào thuộc persistent App Shell.
- Vùng cuộn thật trên desktop, tablet và mobile.
- Có canvas/WebGL/particle layer nào đang chạy trùng hoặc mount lại khi Back/Forward.
- Có overlay, pseudo-element hoặc hiệu ứng nào chặn click, hover, kéo thả, focus hay cuộn.
- Có animation nào vẫn chạy khi tab ẩn, route đã rời hoặc section ngoài viewport.
- Có text nhỏ, tương phản thấp, hero quá cao, card quá dày hoặc nội dung bị hiệu ứng che.
- Có số liệu, trạng thái online, kết quả AI, tiến độ hoặc provider readiness nào không có nguồn thật.

Không bắt đầu bằng cách viết lại toàn bộ. Ưu tiên sửa đúng owner và mở rộng hệ thống hiện có.

## 3. Hướng nghệ thuật: Cinematic Living Cosmos

Thiết kế như một trung tâm điều khiển giữa vũ trụ sống động:

- Nền không gian sâu từ đen xanh, indigo, tím than đến cyan lạnh; không dùng nền đen phẳng.
- Tinh vân nhiều lớp có vùng sáng, vùng tối và làn bụi, thay vì một radial-gradient mờ duy nhất.
- Dải Ngân Hà nằm xa, có mật độ sao và bụi bất quy tắc, không giống một dải màu nhân tạo.
- Sao có nhiều nhiệt độ màu: xanh lam, trắng, vàng nhạt và cam; kích thước/độ sáng/phân bố khác nhau.
- Hành tinh, vệ tinh, tiểu hành tinh và hạt bụi có tỷ lệ, ánh sáng, khí quyển và độ sâu hợp lý.
- Ánh sáng dùng nguyên tắc key light, rim light, reflected light và atmospheric scattering nhẹ.
- Có color grading điện ảnh, vignette rất nhẹ và bloom có kiểm soát.
- Neon dùng để dẫn hướng tương tác, không phủ sáng toàn bộ giao diện.
- Kính mờ vừa phải; panel phải đọc rõ trên mọi vùng nền.
- Mỗi khu vực chức năng có màu nhận diện riêng nhưng cùng một design system.

Bảng màu đề xuất:

- Deep space: `#02040D`, `#071127`, `#11103A`.
- Stellar cyan: `#61E7FF`.
- Nebula violet: `#8B6DFF`.
- Cosmic magenta: `#F35BD6`.
- Solar amber: `#FFD36A`.
- Aurora green: `#8EF0C1`.
- Error/caution dùng token semantic hiện có, không thay bằng neon khó đọc.

## 4. Hệ nền vũ trụ 3D chân thật

Tạo tối thiểu ba tầng chiều sâu:

### 4.1. Far field

- Star field xa có phân bố không đều, cụm sao, khoảng trống và nhiều nhiệt độ màu.
- Dải Ngân Hà/tinh vân xa chuyển động cực chậm.
- Không để toàn bộ sao nhấp nháy cùng nhịp.
- Một số sao sáng có quầng hoặc diffraction spike tinh tế; phần lớn sao phải nhỏ và ổn định.

### 4.2. Mid field

- Tinh vân procedural hoặc texture có giấy phép rõ ràng với lớp bụi tối.
- Hành tinh/portal danh mục có bóng đổ, viền khí quyển, phản xạ và rim light riêng.
- Quỹ đạo và đường kết nối chỉ hiện rõ khi có ý nghĩa tương tác; không biến nền thành sơ đồ rối.
- Có vật thể đi ngang hiếm gặp như sao băng hoặc comet, với giới hạn tần suất và số lượng.

### 4.3. Near field

- Bụi vũ trụ hoặc particle gần camera có parallax nhỏ và blur theo chiều sâu.
- Có foreground silhouette rất nhẹ ở cạnh khung hình nếu giúp tăng chiều sâu.
- Tất cả lớp này phải `pointer-events: none` và không tạo overflow.

Không dùng chuyển động camera lớn, rung màn hình, zoom liên tục hoặc hiệu ứng làm người dùng chóng mặt. Parallax theo chuột chỉ có biên độ nhỏ; touch không cần mô phỏng con trỏ.

## 5. Hero 3D của Trang chủ

Hero phải có một điểm nhìn mạnh nhưng không chiếm toàn bộ màn hình:

- Tiêu đề ngắn, mô tả rõ giá trị của HH Platform và một CTA chính.
- CTA “Khám phá chức năng” cuộn/mở đúng catalog thật.
- CTA tiếp tục công việc mở đúng recent workspace thật nếu có dữ liệu.
- Trung tâm hình ảnh có thể là stellar core, holographic planetarium hoặc command sphere 3D.
- Core phản ứng nhẹ với lựa chọn danh mục, dữ liệu gần đây hoặc hover; không giả hoạt động hệ thống.
- Chữ, nút, badge và control đứng yên; không xoay, trôi hoặc rung theo vật thể 3D.
- Hero desktop nên để người dùng thấy một phần nội dung tiếp theo, tránh cao hơn khoảng 70–78dvh.
- Trên mobile, ưu tiên CTA và nội dung; scene 3D chuyển thành ảnh/Canvas nhẹ hoặc composition đơn giản hơn.

## 6. Biến toàn bộ nội dung Trang chủ thành một hành trình 3D thống nhất

Giữ đủ các khu vực hiện có và nâng cấp chúng thành những tầng của cùng một không gian:

1. **Command Center** — thông tin thật cần chú ý hôm nay.
2. **Tiếp tục công việc** — recent workspace/account-scoped.
3. **Yêu thích và ghim** — favorites/pins thật, thay đổi và lưu lại được.
4. **Danh mục chức năng** — catalog đầy đủ, tìm kiếm và lọc thật.
5. **Portal nhóm chức năng** — mở đúng nhóm/route, không phải card giả.
6. **Lộ trình gợi ý** — chuỗi workspace hợp lý, từng bước mở đúng chức năng.
7. **Trạng thái kết nối/cấu hình** — phân biệt local, browser, backend và provider.
8. **Empty/error/loading** — nội dung rõ ràng, có hành động phục hồi thật.

Ngôn ngữ hình ảnh đề xuất:

- Section là các “orbital deck” hoặc “space station module”, không phải card grid giống nhau kéo dài vô tận.
- Card có perspective rất nhẹ, viền ánh sáng theo vị trí con trỏ nhưng không dịch chuyển vùng bấm.
- Category portal có hành tinh/biểu tượng 3D riêng, màu riêng và mô tả ngắn.
- Recent workspace giống mission capsule; favorite giống star bookmark; journey giống tuyến bay, nhưng nội dung tiếng Việt phải rõ nghĩa.
- Có chiều sâu giữa nền, panel và đối tượng; không lạm dụng `backdrop-filter`, glow hoặc shadow.
- Animation xuất hiện theo section bằng IntersectionObserver, chạy một lần hoặc rất nhẹ; không lặp mọi thứ liên tục.

## 7. Chức năng phải hoạt động thật

- Search phải tìm đúng catalog hiện tại, bao gồm tên, mô tả, nhóm và child tool nếu kiến trúc hỗ trợ.
- Bộ lọc nhóm, trạng thái và khả năng phải kết hợp đúng, có empty state rõ ràng.
- Favorites, pins và recents phải dùng dữ liệu account-scoped/guest-scoped hiện có.
- Không trộn dữ liệu giữa khách và tài khoản đăng nhập.
- Command palette mở từ nút Trang chủ và phím tắt hiện có.
- Planet/category/portal phải mở đúng route hoặc scroll tới đúng nhóm.
- Back/Forward và reload phải phục hồi route, filter/selection phù hợp mà không mount chồng.
- Không làm mất dữ liệu người dùng đang nhập ở workspace khi quay lại Trang chủ.
- Chỉ hiển thị số lượng được tính từ dữ liệu thật; không hard-code số công cụ nếu catalog có thể thay đổi.
- Provider/API chưa cấu hình phải hiện “Chưa cấu hình” hoặc trạng thái tương đương.
- Không tạo số người online, streak, mức hoàn thành, hệ thống khỏe hoặc AI result giả.

## 8. Motion có chủ đích

Tạo ba mức chất lượng tương thích preference hiện có:

- **Tĩnh/Tiết kiệm:** ảnh/CSS fallback, không parallax, không particle loop.
- **Cân bằng:** ít sao, tinh vân nhẹ, FPS/DPR giới hạn và bloom tối thiểu.
- **Điện ảnh:** đầy đủ WebGL/Canvas, nhiều tầng chiều sâu nếu thiết bị đáp ứng.

Yêu cầu:

- Nút tạm dừng chuyển động luôn dễ thấy và mô tả trạng thái hiện tại.
- Tôn trọng `prefers-reduced-motion`, Save Data, pin yếu nếu capability trình duyệt cung cấp và thiết bị yếu.
- Không tự bật lại motion khi người dùng đã tắt.
- Dừng RAF, timer, video và observer không cần thiết khi `document.hidden` hoặc route không còn active.
- Dừng animation của section ngoài viewport nếu không ảnh hưởng chức năng.
- Chỉ animate `transform`, `opacity` hoặc uniform GPU phù hợp trong loop thường xuyên.
- Không animate blur lớn, layout, width/height hoặc box-shadow phức tạp liên tục.
- Hover/focus phải phản hồi ngay, không phụ thuộc animation loop.

## 9. WebGL và hiệu năng

- Chỉ một renderer/RAF owner cho nền Trang chủ tại một thời điểm.
- Không để WebGL của Trang chủ cạnh tranh với video, game, editor hoặc workspace đã mở.
- Lazy-load shader, texture và scene nặng sau khi shell/nội dung tương tác đã sẵn sàng.
- Hiển thị first paint bằng CSS/thumbnail rồi thay atomically khi frame WebGL đầu tiên hoàn tất.
- Giới hạn DPR khoảng 1–1.5 trên phần lớn thiết bị; chỉ tăng khi ngân sách GPU cho phép.
- Giới hạn particle count, texture resolution, draw call và render buffer theo quality tier.
- Không tải toàn bộ texture/video 4K khi scene chưa nhìn thấy.
- Ưu tiên procedural texture hoặc asset nội bộ tối ưu; không thêm engine 3D thứ hai nếu Three.js/WebGL hiện có đáp ứng.
- Có fallback khi WebGL/context/shader thất bại; nội dung và navigation vẫn sử dụng được.
- Hỗ trợ context loss/restore không reload toàn trang.
- Khi unmount: giải phóng geometry, material, texture, framebuffer, renderer, observer, listener và animation frame.
- Không để nhiều canvas ẩn vẫn tiếp tục render.
- Đo ít nhất: thời gian interactive, số canvas/RAF, FPS tương đối, DPR, memory/resource cleanup và layout shift.

Ngân sách gợi ý trên desktop phổ thông:

- First interactive content không đợi scene nặng.
- Một canvas trang trí chính.
- Tối đa khoảng 30 FPS cho Cân bằng và 50–60 FPS cho Điện ảnh nếu thiết bị duy trì ổn định.
- Hạ chất lượng tự động nếu FPS thấp liên tục, nhưng không đổi preference đã lưu của người dùng.

## 10. Responsive, cuộn và zoom

- Desktop, tablet và mobile 375px phải sử dụng được.
- Zoom 200% không làm mất CTA, search, filter, catalog hoặc nút tạm dừng.
- Không khóa `body` hoặc `.app-main` khiến Trang chủ không cuộn được.
- Chỉ Trang chủ sở hữu vùng cuộn bên trong khi root đã mount thành công; loading/error/fallback phải có vùng cuộn an toàn.
- Không tạo hai thanh cuộn cạnh nhau.
- Không dùng `overflow: hidden` toàn cục để che lỗi layout.
- Không có overflow ngang trên toàn document.
- Header/sidebar/breadcrumb không nhảy vị trí khi mở catalog, đổi filter hoặc quay lại từ workspace.
- Mobile dùng một cột, vùng chạm tối thiểu 44px và panel/bottom sheet không che toàn bộ scene/nội dung.
- Safe area và bàn phím ảo không che search hay CTA.

## 11. Accessibility

- Mọi chức năng dùng được bằng bàn phím.
- Giữ landmark `header`, `nav`, `main` và heading hierarchy hợp lý.
- Focus-visible có tương phản cao, không chỉ dùng glow mờ.
- Đối tượng 3D trang trí phải `aria-hidden`; portal tương tác phải có tên truy cập rõ.
- Không dùng màu hoặc chuyển động là dấu hiệu duy nhất cho selected/loading/error.
- Hỗ trợ `prefers-reduced-motion`, forced-colors và tăng cỡ chữ 200%.
- Không để canvas che screen reader content hoặc capture pointer ngoài vùng tương tác.
- Status thay đổi dùng live region ngắn, không đọc lại toàn bộ Trang chủ.
- Độ tương phản chữ/panel phải giữ được khi nền phía sau sáng nhất.

## 12. Tài nguyên và giấy phép

- Có thể tham khảo NASA, ESA và các dự án GitHub chất lượng về star field, procedural nebula, atmospheric scattering và Three.js.
- Trước khi dùng mã hoặc tài nguyên: kiểm tra URL nguồn, tác giả, giấy phép, điều khoản attribution và tình trạng bảo trì.
- Ưu tiên tài nguyên public domain, CC0, CC BY phù hợp hoặc asset do dự án tự tạo.
- Không sao chép nguyên website, thương hiệu, giao diện, shader độc quyền hoặc tài nguyên không rõ quyền.
- Không hotlink ảnh/video/texture bên ngoài trong production.
- Tối ưu và lưu asset trong repository/CDN do dự án kiểm soát nếu giấy phép cho phép.
- Ghi lại nguồn, giấy phép, thay đổi đã thực hiện và nơi asset được dùng trong tài liệu repository.
- Không thêm dependency nặng chỉ để tạo một hiệu ứng có thể làm bằng CSS, Canvas hoặc thư viện đã có.

## 13. Quy trình triển khai

1. Đọc `AGENTS.md`, tài liệu kiến trúc và kiểm tra Git status.
2. Audit Trang chủ hiện tại bằng code, test và trình duyệt; chụp/ghi lại vấn đề trước khi sửa.
3. Xác định một visual owner duy nhất và sơ đồ lifecycle.
4. Lập kế hoạch nhỏ theo thứ tự: ổn định layout → chức năng → scene nền → micro-interaction → tối ưu.
5. Triển khai theo component nhỏ; không thay toàn bộ hệ thống bằng một file khổng lồ.
6. Giữ CSS scoped dưới root Trang chủ/Galaxy Shell; không đặt luật global lên `body`, `button`, `canvas` hoặc mọi workspace nếu không cần.
7. Version asset/cache đúng convention hiện có.
8. Chạy syntax, lint, typecheck, build và test tập trung sau mỗi nhóm thay đổi quan trọng.
9. Kiểm thử trực tiếp desktop, tablet, mobile 375px và zoom 200%.
10. So sánh trước/sau bằng cùng viewport và cùng dữ liệu thử nghiệm.
11. Chỉ chỉnh lỗi do thay đổi mới; ghi riêng lỗi có sẵn và không làm yếu test để che lỗi.

## 14. Luồng kiểm thử bắt buộc

Kiểm thử ít nhất:

- Khách/đăng nhập → `/platform` → Trang chủ render nội dung trước, scene render sau.
- Cuộn toàn bộ Trang chủ và nhảy tới catalog.
- Search → lọc nhóm → empty state → xóa filter.
- Yêu thích → ghim → mở workspace → quay lại → reload.
- Command palette → mở một workspace → Back/Forward.
- Mở từng category portal và kiểm tra route/nhóm đích.
- Điện ảnh → Cân bằng → Tĩnh → reload và xác nhận preference.
- Tab ẩn/hiện → xác nhận animation dừng/tiếp tục đúng.
- WebGL unavailable/context lost → fallback vẫn đọc và dùng được.
- Thiết bị yếu/Save Data/reduced motion → không tải hoặc chạy scene quá nặng.
- Desktop 1440px, laptop 1280px, tablet 768px và mobile 375px.
- Zoom 200%, keyboard-only, focus order và screen reader labels cơ bản.
- Không overflow ngang, không khóa cuộn, không overlay vô hình và không double scrollbar.
- Không lỗi console, request lỗi bất thường, RAF/timer chạy trùng hoặc tài nguyên GPU không cleanup.
- Không làm hỏng login, Admin guard, route cũ, dữ liệu nhập dở hoặc App Shell ổn định.

Chạy tối thiểu các test liên quan tới:

- `platform-home`.
- `platform-home-scroll`.
- `home-cosmos-motion`.
- `galaxy-shell`.
- navigation, runtime boundary, cache/service worker và release consistency.

## 15. Tiêu chí hoàn thành

Chỉ xác nhận hoàn thành khi có bằng chứng. Báo cáo ngắn gồm:

- Các vấn đề đã tìm thấy và nguyên nhân.
- Những phần giao diện/chức năng đã nâng cấp.
- Scene 3D, star field, tinh vân, ánh sáng và animation đã thêm.
- Cách giữ một renderer/RAF và cách cleanup.
- Dữ liệu nào đã xác nhận lưu, tách tài khoản và khôi phục.
- Kết quả desktop/mobile/zoom/accessibility/reduced-motion.
- Kết quả syntax, lint, typecheck, build và test với số lượng pass/fail.
- Danh sách nguồn, giấy phép và asset/mã thực sự đã sử dụng.
- Giới hạn còn lại, đặc biệt là WebGL, thiết bị yếu hoặc capability cần backend/provider.

Không báo “đẹp nhất”, “chân thật nhất” hoặc “hoàn thiện toàn bộ” nếu chưa có bằng chứng trực quan và kỹ thuật. Không sửa tài nguyên không liên quan, không xóa dữ liệu người dùng, không tạo metric giả và không commit/push cho đến khi người dùng yêu cầu sau khi xem báo cáo kiểm thử.
