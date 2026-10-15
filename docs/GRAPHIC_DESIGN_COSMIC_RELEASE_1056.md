# HH Cosmic Design Studio — release 1056

Hoàn thiện/kiểm thử: 15/10/2026. Baseline `f1abd3a`. Đây là bản sửa nền tảng, nâng cấp giao diện và nối các adapter có khả năng thực hiện; **không phải tuyên bố đã đạt toàn bộ tính năng của Figma/Photoshop/Blender hoặc hoàn tất mọi hạng mục nâng cao trong đề bài**.

## Phạm vi và dữ liệu

- Canonical `/graphic-design` giờ mount dashboard Studio thật thay vì bỏ qua dashboard để mở generic hub. Giữ `/platform`, shell, auth, Admin và 25 route con; Workflow là route bổ sung sẵn có.
- Context dự án tách account + project ID bằng storage adapter được truyền tường minh. Không monkeypatch localStorage, không tự nhận dữ liệu legacy là của người vừa đăng nhập. Tạo hai dự án cùng tool không dùng chung key. Dữ liệu cũ không bị xóa; bản sao lưu legacy cần được người dùng nhập rõ ràng.
- Dashboard không tự tạo ba dự án, tiến độ hay hoạt động giả. Checklist được ghi rõ là tự đánh dấu, không phải chất lượng thiết kế đo tự động.
- Vault phân key record theo tài khoản, chờ IndexedDB transaction hoàn tất; lỗi autosave giữ bản đang chờ để retry. Import/branch remap ID và binary để tránh ghi đè bản nguồn.
- Kho dữ liệu cục bộ không phải ranh giới bảo mật trước mã độc cùng origin/người có quyền hồ sơ trình duyệt. Không tuyên bố lưu cục bộ đã được mã hóa hoặc sync cloud.

## Sửa lõi và đầu ra

- Boolean hình chữ nhật vuông góc chính xác bằng chia ô và truy vết contour: union/subtract/intersect/exclude, vùng rời và lỗ, có undo. Nhận 2–32 hình chữ nhật không xoay/bo góc/scale; đường cong và transform ngoài phạm vi bị từ chối **không sửa tài liệu**, không thay bằng bounding box.
- Preview hydrate ảnh từ Blob gốc. SVG/PNG xuất dùng source gốc thay vì thumbnail 320px; không cắt data URI ở 2.000 ký tự. Preflight kiểm tra nguồn, nội dung và khả năng render thật trước xuất.
- Gói portable Universal gồm manifest/document/binary/checksum, tối đa 16 MiB/asset và 64 MiB tổng binary. Import kiểm tra toàn gói trước khi ghi transaction, remap ID, tách asset theo account. Gói JSON/metadata legacy vẫn đọc được nhưng không được coi là gói chứa đủ file gốc.
- `persist` trả trạng thái lưu thật, không nuốt quota/mirror failure thành thành công. Mirror xếp hàng revision thay vì bỏ thay đổi mới khi lần lưu trước đang chạy.
- Export Center có hai hành động riêng xuất **document chung**: SVG và `.hhdesign` kèm asset. Queue riêng vẫn dùng artboard riêng, có chú thích không tự chuyển đổi mọi engine.
- Bản rà soát cuối sửa double-stringify gói tại Export Center (test roundtrip bằng Universal API thật), cleanup listener/generation trên cùng host khi đổi tài khoản, không flush default Vector trước khi hydrate xong và không render lại host đã đóng. 3D dùng một scheduler có guard khi visibility đổi giữa lúc import; Collaboration không tạo socket/đọc token sau destroy; Composer không tạo Blob URL muộn và đóng AudioContext đúng một lần. Các trường hợp async muộn có test điều khiển thời điểm, không chỉ kiểm tra chuỗi nguồn.
- Metadata-only remove asset chưa xóa binary vì snapshot/branch có thể còn tham chiếu. Chưa triển khai orphan garbage collector. SVG người dùng nhập ngoài chưa raster-export khi chưa có tuyến sanitize/render được xác minh.

## Giao diện

Neon tím than/cyan/magenta, theme Nebula/Aurora/Solar, hero gọn và không có chữ phản chiếu nhấp nháy. Bàn điều khiển chung có tìm kiếm tiếng Việt qua 25 studio, empty state, chế độ tập trung/thoát tập trung, giảm hiệu ứng giao diện, reset và hướng dẫn/giới hạn riêng cho từng studio. Trong editor, tìm studio khác được thu trong disclosure để dành chỗ cho nội dung. Cài đặt giao diện lưu theo dự án, lỗi lưu được báo trung thực.

Không tạo app shell mới, không đổi màu nội dung thiết kế theo theme giao diện. Lớp trang trí không chặn pointer. Dừng RAF 3D khi tab ẩn, hủy renderer hoàn tất muộn sau khi unmount và flush autosave native pending khi rời; không tự phát audio hoặc gọi provider.

## Bản đồ 25 workspace và phạm vi thực tế

Tất cả hàng dưới đều dùng route/engine cũ; đã kiểm tra mount công cụ trên Chromium và không overflow toàn trang ở 375px. Đó **không** đồng nghĩa đã kiểm thử từng nút hoặc toàn bộ danh sách tính năng nâng cao.

| Route con | Engine / dữ liệu và thay đổi liên quan | Giới hạn còn lại |
|---|---|---|
| vector | Vector Core; storage/IndexedDB theo project, chờ commit, flush và đóng DB khi rời | Tài liệu engine riêng; chưa adapter hai chiều đầy đủ vào Universal |
| nondestructive | Engine chỉnh ảnh hiện có; nhận scoped storage từ Studio | Mask/curves/ảnh lớn cần kiểm thử workflow chuyên sâu thêm |
| typography | Typography Pro; dùng storage tiêm theo project, không đọc kho toàn cục | Font/OpenType tùy engine; chưa tự chuyển mọi style sang engine khác |
| effects | Graph hiệu ứng hiện có, scoped storage | Không tuyên bố mọi filter/plugin ngoài đều có renderer |
| quick-motion | Preset/timeline; scope, lỗi lưu bền vững; hai dự án được kiểm thử tiêu đề thật | Animated SVG/CSS/JSON không đồng nghĩa MP4/GIF |
| animation | Timeline 2D hiện có; storage riêng, lỗi quota không làm vỡ mount | Định dạng Lottie-like nội bộ không tự trở thành Lottie chuẩn |
| state-machine | Engine state/binding hiện có; nhận scoped storage | Chưa test toàn bộ graph đồng thời với các studio khác |
| 3d | Three.js r184 hiện có; scoped save/load, pause tab, late-init cleanup | Model/texture nhị phân engine riêng có thể cần nhập lại; HDR/EXR/DOF chưa có renderer |
| mockup | Engine mockup hiện có; nhận scoped storage | Không khẳng định mọi mẫu là mô hình 3D/asset tự do |
| character | Character Pro hiện có; scoped storage kể cả null fail-closed | Rig, binary và motion vẫn theo engine riêng |
| simulation | Simulation engine hiện có; nhận scoped storage | Mô phỏng thiết kế nhẹ, không phải vật lý khoa học |
| prototype | Frame/hotspot hiện có; scoped save, không ghi “đã lưu” trước xác nhận | Preview cục bộ, chưa thành web app hoặc share server |
| motion | Motion engine hiện có; không fallback kho toàn cục khi storage bị từ chối, lưu lỗi có trạng thái | Không bổ sung codec/renderer video mới |
| adaptive | Engine biến thể hiện có; scoped storage và lỗi lưu trung thực | Smart crop theo quy tắc, không nhận diện ảnh bằng AI |
| data | Dataset/CSV engine hiện có; nhận scoped storage | Chưa nối mọi binding sang Universal hai chiều |
| components | Component engine/Workflow hiện có; scoped storage | Một số schema riêng cần adapter trước khi liên thông |
| color | Color engine hiện có; scoped storage | CMYK/soft proof generic chỉ xấp xỉ, không chứng nhận in |
| projects | Vault/Hub ID ổn định, account scope, transaction commit, package/branch remap | JSON danh sách Hub không chứa mọi file; cần gói portable đúng loại |
| collaboration | Layer context/fingerprint từ document thật, không còn coi sample là project | Backend hiện chỉ presence/comments/metadata, chưa document CRDT/đồng chỉnh đầy đủ |
| review | Snapshot document/frame thật, scoped storage, quota error | Snapshot giản lược; link/password/expiry chỉ local-browser-profile, không phải bảo vệ server |
| dev-ai | Inspect selected layer thật, command apply/undo, consent trước provider, SVG preview an toàn | Heuristic local không phải AI; provider chưa được cấu hình/kiểm thử WAN |
| export | SVG/package từ document chung qua API thật, native queue giữ capability rõ | PDF/MP4/WAV cần encoder; WebM artboard không phải timeline video đầy đủ |
| plugins | Declarative host áp dụng set-frame/add/update/select trên document thật + undo | Không chạy mã tùy ý; chỉ command host cho phép, không marketplace online |
| performance | Inventory/count từ document thật, nhãn UI RAF/ước tính texture đúng bản chất | Không coi UI RAF là FPS render hoặc ước tính là VRAM đo; proxy plan chưa tạo file |
| composer | Nhập active frame, giữ payload nguồn; render subset shape/text/path, HTML preview an toàn | Composition riêng; 3D/rig/media là proxy/metadata, chưa playback/render tổng hợp hoàn chỉnh |

Workflow vẫn tách bước Vector/Components/Review/Deliver, truyền context/storage đúng; chưa tuyên bố cả năm hành trình đa engine trong đề bài đều chuyển đổi lossless tự động.

## Bằng chứng kiểm thử

- Baseline trước sửa: 297 test Graphics đạt. Bản này: **334/334** test Graphics/media integration đạt (bao gồm test mới tài liệu, package, project scope, specialist và Export Center).
- Hồi quy: **368/368** Galaxy/shell/route/scroll/release và **241/241** All Tool đạt; các bộ có contract dùng chung nên không cộng thành số test độc lập.
- Syntax: tất cả runtime/helper/runner JS thay đổi; `git diff --check` và staged release/cache consistency.
- Repository không có lint/typecheck/build tổng cho frontend trong package scripts; không ghi những bước không tồn tại là đã chạy. Không thay framework/package/dependency.
- Runner lưu trong Git: `scripts/qa-graphic-design-campus.js`, actual Chromium + SwiftShader, CSP từ HEAD production. Loopback phục vụ index/SW đã stage riêng, auth/CSP từ HEAD để không lẫn WIP Facebook. API/realtime là unavailable response doubles; không gọi provider, WAN hoặc thiết bị thật.
- **8/8 nhóm browser QA**: khách→canonical hub; layout/theme/focus/search/reduced/forced; hai Quick Motion cùng loại→sửa riêng→mở/reload/Back/Forward; 25 engine + Workflow control readiness; toàn bộ 26 route ở 375px; deferred Vector hydration/cleanup và một RAF 3D; ảnh gốc/portable; không pageerror/CSP/shader/public-asset error hoặc POST provider. Kiểm tra race dùng IndexedDB timing double và visibility/RAF scheduling double trong DOM thật; các phép thử asset/portable tiếp tục dùng IndexedDB thật, không coi scheduling double là kiểm chứng tab vật lý trên thiết bị.
- Test ảnh gốc tổng hợp 1024×768, SVG→giải mã PNG cùng kích thước và pixel đỏ/xanh chính xác. Package sang browser context sạch giữ checksum, remap ID/liên kết và cách ly account khác. Đây là dữ liệu QA tổng hợp, không ảnh của người dùng.
- Desktop 1440px, tablet 768px, mobile 375px, CSS zoom 200%; chưa zoom UI trình duyệt hoặc cảm ứng nhiều ngón trên thiết bị thật. Không cam kết toàn diện WCAG hay FPS/GPU memory.
- Hai probe cục bộ bổ sung: lõi document IndexedDB/SVG/native pixels/account isolation, và 7 nhóm specialist gồm hostile HTML không thực thi, plugin đổi frame thật, selected-layer chỉnh thật. Harness/log bổ sung và ảnh nằm trong `.study-local`, không commit dữ liệu QA.
- Suite `platform-home.test.js` riêng đã có lỗi harness/registry trước bản này (ghi ở release1055); không thuộc các bộ được xác nhận đạt ở đây.

## Tham khảo và quyền sử dụng

Không thêm dependency, model, font hoặc media mới; không copy source bên ngoài. Mã bổ sung là mã nguyên bản. Tham khảo cách tổ chức và kiểm chứng, không nhúng toàn bộ editor:

- Penpot Interface Tour: https://help.penpot.app/user-guide/first-steps/the-interface/ — tham khảo vùng thao tác, file status, panel và phân biệt workspace/view/dashboard. Penpot source MPL-2.0; không dùng mã/tài nguyên.
- Konva Node/serialization và test: https://github.com/konvajs/konva/blob/master/src/Node.ts và https://github.com/konvajs/konva/blob/master/test/unit/Node-test.ts — tham khảo ranh giới node/document, serialize/restore và nguyên tắc test trạng thái; MIT: https://github.com/konvajs/konva/blob/master/LICENSE. Không cài/copy code, không pin dependency hay tuyên bố dùng một commit cụ thể.
- Fabric.js: https://github.com/fabricjs/fabric.js và LICENSE MIT — đối chiếu khả năng engine và serialization, không dùng source. Đường dẫn Object.ts được thử đã đổi/404 nên không coi là nguồn mã áp dụng.
- Three.js r184 đã có: giữ nguyên runtime; giấy phép MIT tại `vendor/THREE-LICENSE.txt`, đối chiếu https://github.com/mrdoob/three.js/blob/dev/LICENSE. Không thêm Three renderer thứ hai cho cùng workspace.

## Phát hành

Cache1056, loader718, script292; Studio CSS10/JS9, Universal JS6; Context1/Capabilities1. Native/specialist assets được đồng bộ giữa lazy loader, studio/workflow và SW. Index/SW stage từ HEAD cộng riêng hunk release này, không đưa Facebook/auth WIP hoặc cấu hình/QA data vào Git.

Trạng thái deploy/public assets được kiểm tra sau push, không xác nhận trước trong tài liệu.
