# Nghiên cứu cho prompt nâng cấp All Game 209

Ngày đọc: **24/10/2026**. Mục đích của lượt này là soạn prompt và tiêu chí triển khai; những ý tưởng dưới đây chưa được triển khai vào website bởi việc tạo tài liệu này.

## Quan sát từ project và ảnh người dùng

- Catalog thực có 209 game, 36 bundle, 22 nhãn thể loại; HEAD khi đọc là `e1c6a57`, release 1062.
- Ảnh cho thấy tiêu đề game rất sáng trên nền thẻ sáng. Trong `all-game.css`, màu tối được đặt ở `.ag-card-body`, còn rule riêng của `h2` chủ yếu đặt typography. `app-shell.css` có rule đặt màu trực tiếp lên heading trong workspace. Đây là một hướng điều tra cascade có căn cứ; chưa thay thế kiểm tra computed styles và selector thắng trên trang đang lỗi.
- Test màu hiện có có các kiểm tra palette/CTA; không được suy ra nó đã chứng minh contrast của mọi heading trong full shell. Prompt yêu cầu thêm kiểm tra đúng phần chữ đang hỏng.
- Kiến trúc hiện tại có state JSON, host quản lý vòng lặp/input/audio, engine tải theo nhóm và save theo tài khoản trên thiết bị. Đề xuất mở rộng dựa trên những điểm này, không mặc định chuyển cả website sang engine mới.

## Nguồn thiết kế gameplay và nội dung

| Nguồn trực tiếp | Điều tham khảo và giới hạn |
|---|---|
| [Y8 — Kingdom Rush](https://www.y8.com/games/kingdom_rush) | Đọc mô tả phòng thủ/xây tháp và cách trang trình bày game. Áp dụng nguyên tắc mục tiêu rõ và lựa chọn chiến thuật; không lấy asset hay suy ra toàn bộ campaign từ mô tả ngắn. |
| [Y8 — Fireboy and Watergirl](https://www.y8.com/games/fireboy_and_watergirl_forest_temple) | Vai trò bổ trợ, công tắc/cơ cấu và phòng giải đố tăng dần. Dùng làm tham khảo cho co-op có phụ thuộc vai trò thực. |
| [Hades FAQ — Supergiant](https://www.supergiantgames.com/blog/hades-faq/) | Tham khảo truyện/nhân vật có liên hệ với lịch sử các lượt chơi và khả năng chơi theo nhịp riêng; không đồng loạt áp roguelite lên cờ, bài hay thư giãn. |
| [Baba Is You — Hempuli](https://www.hempuli.com/Baba/) và [nhật ký sửa màn](https://www.hempuli.com/blog/index.php?rule=id&ruleid=546) | Định hướng màn mới qua tương tác luật; kiểm tra lại lời giải khi sửa nội dung. |
| [Factorio FFF #373](https://www.factorio.com/blog/post/fff-373) | Vùng/scenario mới cần thay quyết định về tài nguyên, sản xuất và phần thưởng; đổi phông cảnh không tạo chiều sâu. |
| [Mini Metro — press kit](https://dinopoloclub.com/press/mini-metro/) | Đối chiếu map, điều kiện phát triển và cách tách các chế độ chơi. |
| [Mini Motorways — Endless & Expert](https://dinopoloclub.com/2022/11/03/play-mini-motorways-your-way-with-our-new-endless-expert-mode-update/) | Sandbox và thử thách nghiêm ngặt phục vụ nhu cầu khác nhau; mode mới phải thay lựa chọn thực. |
| [Dead Cells — trang chính thức](https://deadcells.com/) | Tham khảo tuyến đường và kiểu trang bị tạo khả năng chơi lại; không sao chép boss, bản đồ hay media. |
| [OpenTTD — About](https://www.openttd.org/about) | Tham khảo chiều sâu hệ thống/scenario. Mã GPL và quyền media phải được đánh giá riêng trước mọi ý định tái sử dụng; prompt chỉ đề xuất học thiết kế. |
| [ink — inkle](https://www.inklestudios.com/ink/) | Tách kịch bản, biến và nhánh; cân nhắc công cụ viết/test truyện và dữ liệu biên dịch. Không bắt buộc thêm runtime nếu JSON hiện có đáp ứng. |

[Into the Breach — trang chính thức](https://www.subsetgames.com/itb.html) cũng được tìm thấy, nhưng mở trực tiếp bị 403 trong phiên nghiên cứu; không dùng nó làm căn cứ cho tuyên bố đã nghiên cứu sâu toàn bộ luật.

`game24h.com` trong lần kiểm tra này chuyển tới trang bán tên miền. Không coi đó là cổng game đã đọc, không tự đồng nhất một tên miền gần giống với cùng chủ sở hữu. Những nguồn Y8/chính chủ truy cập được được dùng thay cho một trích dẫn Game24h không kiểm chứng.

## Khả năng đọc và kiến trúc dựng hình

| Nguồn chính thức | Áp dụng cho prompt |
|---|---|
| [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) | Contrast chữ thường 4,5:1; chữ lớn đủ điều kiện 3:1. Đo cặp màu hiển thị thật, gồm nền/lớp phủ, không kiểm tra một token rồi suy ra mọi thẻ đạt. |
| [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/) | Chữ rõ, bố cục dễ theo dõi, hướng dẫn truy cập lại được, điều khiển dễ dùng và tín hiệu có phương thức thay thế. Đây là bộ hướng dẫn thiết kế, không phải chứng nhận website đã đáp ứng toàn bộ accessibility. |
| [Three.js — Responsive](https://threejs.org/manual/pages/responsive.html) | Phân biệt kích thước hiển thị và drawing buffer; cập nhật camera khi resize, kiểm soát DPR/chi phí pixel. |
| [Three.js — Cleanup](https://threejs.org/manual/pages/cleanup.html) | Chủ động dispose tài nguyên GPU trong SPA; bỏ mesh khỏi scene chưa đủ. |
| [PixiJS — Renderers](https://pixijs.com/8.x/guides/components/renderers) | Tại thời điểm đọc, Canvas renderer được ghi chưa sẵn sàng và WebGPU có lưu ý tương thích. Không hứa fallback Canvas tự động. |
| [PixiJS — Ticker](https://pixijs.com/8.x/guides/components/application/ticker-plugin) và [Phaser — TimeStep](https://docs.phaser.io/api-documentation/class/core-timestep) | Cần adapter hoặc chuyển quyền sở hữu loop rõ ràng; không để framework và host cùng step luật. |
| [Babylon.js — Scene optimization](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene/) | Đánh giá các kỹ thuật tối ưu cảnh theo số đo, tránh tải thêm một engine mà không có lợi ích cụ thể. |
| [MDN — WebGL context lost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event) | Test mất/khôi phục context và giữ state; không chỉ thử máy có GPU hoạt động bình thường. |

## Asset và license

- [Kenney — Support](https://kenney.nl/support): trang hỗ trợ công bố asset trên các asset page theo CC0 và dẫn người dùng tới license trong gói. Vẫn cần lưu đúng nguồn/archive/notice của asset thực dùng; logo không được coi là asset tùy ý sử dụng.
- [Quaternius — License](https://quaternius.com/license.html): trang hiện công bố QAL v1.0, cập nhật 28/08/2026, khác với việc gắn nhãn mặc định mọi pack là CC0. Có điều kiện về phân phối asset độc lập và phiên bản license khi nhận. Vì vậy prompt yêu cầu kiểm tra đúng pack, archive và ngày nhận; không giả định quyền từ một FAQ cũ.
- License thư viện, code mẫu, mô hình, font, texture và nhạc cần được phân biệt. Quyền dùng engine không tự cấp quyền dùng mọi media trong demo.

## Những phần là đề xuất, không phải dữ kiện về game nguồn

Các mục tiêu 24–40 màn puzzle, 16–24 nhiệm vụ action, 4–6 chương truyện, mùa giải 12–16 trận và khoảng thời lượng trong prompt là đề xuất phạm vi cho hoang8.com. Chúng cần được chốt theo từng ID và đo lại sau triển khai. Không nguồn nào ở trên bảo đảm rằng cứ đạt số lượng đó là có gameplay hay hoặc có đúng số phút trải nghiệm.

2D/2.5D/3D cũng là lựa chọn thiết kế: giữ 2D khi hỗ trợ đọc luật; dùng 2.5D cho lớp cảnh/độ cao khi hữu ích; thử 3D chọn lọc trước khi mở rộng. Hiệu ứng CSS lên thẻ, glow hoặc một ảnh render không chứng minh bên trong game đã có renderer mới.
