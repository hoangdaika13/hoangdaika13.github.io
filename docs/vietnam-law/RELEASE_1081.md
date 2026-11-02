# Pháp Luật Việt Nam 1081 — danh mục đầy đủ trong phạm vi nguồn đã nhập

Phát hành ngày 02/11/2026. Module vẫn ở `#/vietnam-law`; không thay đổi định dạng ghi chú, bookmark hay tiến độ PDF theo tài khoản.

Kho văn bản mặc định cho phép duyệt toàn bộ 584 hồ sơ đã nhập, thay vì chỉ mở một trang kết quả trực tuyến. Có phân trang đầu/cuối, lưu bộ lọc và số trang trong URL, hiển thị tất cả kết quả, sắp xếp, nhóm luật/bộ luật/Hiến pháp, bộ lọc nâng cao và đếm trạng thái. Có thể chuyển sang tìm thêm trong chỉ mục Công báo ngay trong website. PDF gốc, phần tra điều, ghi chú, nguồn và liên kết sửa đổi tiếp tục dùng trình đọc trong trang.

## Phạm vi đã kiểm tra

- Đã duyệt đủ 35 trang của [danh mục Luật Công báo](https://congbao.chinhphu.vn/van-ban-dang-cong-bao/luat-l13.htm): 348 mã văn bản khác nhau, nhập đủ 348/348. Audit giữ URL, SHA-256, thời điểm và danh sách mã từng trang.
- Đã nhập đủ 9 trang tìm kiếm loại Luật của endpoint công khai: 333 kết quả. Danh mục HTML và chỉ mục tìm kiếm khác nhau: các luật 2026/QH16 mới trên HTML chưa có hết trong chỉ mục. Ứng dụng giữ cả hai tập, không lấy 333 làm số lượng luật toàn quốc.
- Đã duyệt toàn bộ 63 kết quả truy vấn “Bộ luật”, 26 kết quả “Hiến pháp”, giữ các hồ sơ có nguồn đã có và bổ sung nghị quyết sửa Hiến pháp 203/2025/QH15 từ bản công bố chính thức. Tổng 584 hồ sơ, 355 hồ sơ thuộc nhóm chính: 345 luật, 7 bộ luật và 3 hồ sơ Hiến pháp/sửa đổi/hợp nhất. Phân nhóm theo tiêu đề được tách khỏi loại metadata nguồn, vì nguồn có trường hợp gắn Bộ luật Lao động thành Nghị quyết.
- Có 49 bản trích PDF với 6.275 tiêu đề điều, gồm 120 điều Hiến pháp 2013, 120 điều của bản hợp nhất chính thức 52/VBHN-VPQH, 2 điều nghị quyết 203/2025/QH15 và luật 24/2026/QH16 mới. Đây là nội dung PDF thật; không OCR hoặc tự viết điều luật còn thiếu. 48 bản có đối chiếu được số hiệu/tiêu đề riêng ở đầu PDF; bản hợp nhất Hiến pháp không có số hiệu riêng trong phần đầu được dùng để kiểm tra nên chưa đủ điều kiện làm căn cứ AI.
- Kiểm tra 585 tệp dữ liệu qua SHA-256, tổng 29.138.231 byte. 91 hồ sơ có liên kết quan hệ do nguồn cung cấp, 289 liên kết; không suy ra đầy đủ sửa đổi từ các nhóm trống.
- Chuẩn hóa 105 hồ sơ có ngày giữ chỗ `1900-01-01` thành ngày chưa xác định; giá trị nguồn vẫn giữ trong `sourceDatePlaceholders`. Không hiển thị ngày giữ chỗ như ngày hiệu lực thật.
- Tại mốc kiểm tra, 567 hồ sơ chưa xác minh tình trạng hiện tại, 17 hồ sơ chưa đến ngày hiệu lực nguồn ghi. Không tự gắn nhãn toàn bộ đang có hiệu lực.

Chi tiết từng hồ sơ và checksum: [coverage1081](coverage-1081.json), [bảng các bản trích](coverage-1081.md), [audit nguồn](../../data/hh-vietnam-law/source-audit.json).

## Chỉ mục trực tuyến và đối chiếu nguồn khác

[Chỉ mục văn bản Công báo](https://congbao.chinhphu.vn/van-ban-dang-cong-bao.htm) trả 25.262 hồ sơ lúc kiểm tra. Đã gọi thật trang cuối 632 với 40 mục/trang: trả 22 hồ sơ và `has_next:false`. Đây là số của chỉ mục nguồn tại thời điểm đó, không phải khẳng định đủ văn bản quốc gia. Giới hạn trang cũ 1000 được mở rộng để trang cuối vẫn truy cập được khi dùng 20 mục/trang; UI chỉ dựng các nút trang cần thiết.

Đã đối chiếu [Hiến pháp2013 trên hệ thống Chính phủ](https://vanban.chinhphu.vn/hien-phap-nam-2013), [Bộ luật Hàng hải95/2015/QH13](https://vanban.chinhphu.vn/?docid=183192&pageid=27160), kết quả chỉ mục chính thức của [CSDL quốc gia về203/2025/QH15](https://vbpl.moj.gov.vn/botuphap/Pages/vbpq-thuoctinh.aspx?ItemID=178314), và [bản Công báo cùng nghị quyết](https://congbao.chinhphu.vn/van-ban/nghi-quyet-so-203-2025-qh15-45146.htm). Đối chiếu này phát hiện nghị quyết sửa Hiến pháp bị bỏ sót bởi truy vấn từ khóa Công báo.

Trang trực tiếp `vbpl.vn`/`vbpl.moj.gov.vn` có lỗi truy cập 403/502 trong môi trường nghiên cứu; `phapluat.gov.vn` trả 403. Không vượt chặn, không khẳng định đã kết nối API riêng của Cổng Pháp luật quốc gia. Có liên kết đến các nguồn này để người đọc tiếp tục đối chiếu. Host PDF `g7.cdnchinhphu.vn` được thêm chính xác sau khi kiểm tra liên kết từ trang Công báo chính thức; không mở allowlist cho các host tùy ý.

## Kiểm tra

- 57/57 tests pháp luật, catalog và PDF transport đạt; bao gồm tính đầy đủ 348 mã của 35 trang đã nhập, duyệt đủ 584 hồ sơ qua phân trang/hiện tất cả, phân nhóm không sửa metadata nguồn, 120 điều Hiến pháp, an toàn URL và API tra danh mục khi chỉ mục ngoài lỗi.
- Chromium thật với shell đầy đủ, handler thật và fixture DB/identity/AI công khai: 22 trạng thái đạt;16 theme;3.605 phép đo tương phản;0 lỗi JavaScript, 0 tràn ngang. Kiểm tra 375/768/1440 px, DPR 2, 200%, bàn phím, trang cuối/reload/hiện tất cả 584 hồ sơ, nhóm bộ luật và điều 120 Hiến pháp, chuyển nguồn trực tuyến.
- Trình đọc PDF vẫn đạt các kiểm tra trang/tệp/zoom/xoay/tìm chữ/tiến độ, tệp 93 MBqua Range thật, nguồn 503/thử lại, bản lưu tương lai, IME, trích dẫn AI được kiểm tra và ngoại tuyến các bản trích đã ghé. Không gọi AI trả phí hoặc ghi tài khoản production.

Kết quả: [QA](qa-1081/results.json), [tương phản](qa-1081/readability.json). Ảnh chụp cục bộ ở `.study-local/hh-vietnam-law-1081-final/`.

## Giới hạn còn lại

Chưa có bản sao đầy đủ toàn bộ văn bản pháp luật quốc gia và lịch sử từ trước phạm vi Công báo đang công bố. 584 hồ sơ là danh mục đã nhập;25.262 là số hồ sơ trong chỉ mục trực tuyến đã kiểm tra. Phải phân biệt hai phạm vi này với toàn bộ pháp luật Việt Nam.

Chưa có xác minh hiệu lực hiện tại toàn kho; không tự hợp nhất các sửa đổi. Bản gốc, văn bản sửa đổi và bản hợp nhất chính thức là các hồ sơ riêng. Không chuyển dữ liệu hợp nhất thành văn bản đang có hiệu lực nếu nguồn chưa xác nhận.

Các giới hạn cũ còn giữ: một PDF 12/2017/QH14 vượt 12 MiBtrích máy chủ nhưng đọc được trong trang; ba truy vấn số hiệu lịch sử chưa có kết quả chính xác được giữ trong audit, không tự tạo hồ sơ. PDF scan có thể không trích được chữ. Toàn bộ PDF không được hứa có sẵn ngoại tuyến.

## Tái tạo

`node scripts/catalogue-hh-vietnam-law.js --refresh` tạo candidate có kiểm soát, không tự xuất bản. Sau khi đọc audit, kiểm tra danh tính và failures, chạy `node scripts/build-hh-vietnam-law.js --candidate .study-local/vietnam-law-1081/candidate`, rồi `node scripts/report-hh-vietnam-law.js`. Candidate và dữ liệu cá nhân không đưa vào Git.

`node --test tests/hh-vietnam-law.test.js tests/hh-vietnam-law-pdf-transport.test.js tests/hh-vietnam-law-catalogue.test.js` chạy kiểm tra tập trung. `scripts/qa-hh-vietnam-law.js` chạy browser QA với Playwright/Chromium được cấu hình qua biến môi trường.
