# Pháp Luật Việt Nam — release 1070

Tên hiển thị chính thức: **Pháp Luật Việt Nam**. Module độc lập tại `#/vietnam-law`, tách khỏi Học tập và Đại học. Release 1069 đã tách Đại học & Cao đẳng; giữ nguyên dữ liệu, URL tương thích và bàn học cũ.

## Chức năng đã triển khai

- Sidebar, tìm nhanh và 8 đích điều hướng: trang chủ, kho văn bản, điều luật, lĩnh vực, hiệu lực, hỏi đáp, cập nhật, đã lưu.
- Tìm trực tuyến tên/số hiệu/từ khóa; loại văn bản, cơ quan, khoảng ngày ban hành; phân trang.12 nhóm lĩnh vực là nhóm từ khóa, không phải phân loại pháp lý độc quyền.
- Bộ lọc hiệu lực/ngày hiệu lực chỉ áp dụng tập bản ghi đã đối chiếu trong kho lưu. Không lấy ngày hiệu lực trong quá khứ để suy ra văn bản còn hiệu lực. Số 0 kết quả không chứng minh không có quy định.
- Đọc PDF gốc theo nhu cầu, tra điều/khoản/điểm/từ khóa, chuyển tới trang PDF. Đồ thị giữ nhóm và chiều liên kết của nguồn; mốc hash ứng dụng tách biệt lịch sử sửa đổi pháp luật.
- Lưu văn bản, ghi chú theo tài khoản trên thiết bị; giữ bản lưu hỏng/phiên bản tương lai để tải phục hồi; giữ nháp và gõ tiếng Việt khi dữ liệu về muộn; giải phóng timer/sự kiện/yêu cầu khi rời module.
- Đồng bộ metadata mới nhất, kiểm tra bản nguồn, trạng thái lỗi/bản lưu có thời điểm; giao diện theo token toàn website, focus bàn phím, giảm chuyển động,375 px và 200%.

## Nguồn và giới hạn

Nguồn hoạt động là [Công báo điện tử Chính phủ](https://congbao.chinhphu.vn/) và API tìm kiếm công khai phục vụ website đó. Không gọi đây là quyền API riêng của Cổng Pháp luật quốc gia. Chủ website xác nhận chưa có tài liệu/quyền API riêng và đồng ý tiếp tục bằng nguồn chính thức công khai. `phapluat.gov.vn` và `vbpl.vn` trả 403 trong cả trình duyệt và môi trường kiểm tra; không vượt chặn.

POST công khai `https://api-searchcongbao.chinhphu.vn/search/van-ban`; danh mục loại/cơ quan lấy từ `/search/options/…`. Không có cam kết SLA hay tài liệu API tích hợp công khai được xác minh; adapter kiểm tra schema, giới hạn dữ liệu, allowlist HTTPS và xác minh lại từng redirect. Khi cấu trúc/nguồn thay đổi, hiển thị lỗi hoặc bản lưu, không báo đồng bộ thành công giả.

Bootstrap 160 văn bản,19 bản trích PDF,2.930 tiêu đề điều;25 văn bản có 138 liên kết nguồn. Xem [báo cáo phạm vi](coverage-1070.md) và [manifest kiểm tra](coverage-1070.json). Đây là tập con, không phải bản sao đầy đủ hệ thống pháp luật quốc gia. Một PDF 12/2017/QH14 vượt 12 MiB; vẫn mở liên kết gốc. Không OCR hoặc tự điền điều bị thiếu. Trích xuất có thể sai ký tự; PDF gốc là căn cứ đối chiếu.

Bản công bố cũ vẫn có trong kho. Chưa xác minh hiệu lực hiện tại của toàn bộ tập; chưa tự hợp nhất sửa đổi, chưa suy hiệu lực từ các cạnh liên kết. Nhóm trống không chứng minh không có sửa đổi. Có thể giữ địa chỉ/thuộc tính lịch sử do nguồn cung cấp.

Luật Đất đai 31/2024/QH15 có thuộc tính Công báo không khớp PDF. Bản hiệu chỉnh giới hạn trong `curation.json`, đối chiếu [trang thuộc tính Chính phủ](https://vanban.chinhphu.vn/?pageid=27160&docid=211189) và PDF gốc, giữ metadata trước hiệu chỉnh. Không hiệu chỉnh suy đoán tình trạng hiện tại. Metadata các nguồn có thể còn lỗi ngoài trường hợp đã phát hiện.

## Hỏi đáp AI và vận hành

`/api/vietnam-law/ask` dùng Responses API qua provider hiện có, cần đăng nhập và `OPENAI_API_KEY` hoặc `OPENAI_API_KEYS` ở máy chủ. Có thể đặt `VIETNAM_LAW_AI_MODEL`; mặc định theo cấu hình/allowlist hiện có. Không lưu câu hỏi vào kho ứng dụng; provider request `store:false`, tắt web search, schema JSON chặt. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) cung cấp định dạng, không bảo đảm kết luận pháp lý đúng.

Chỉ dùng tối đa 3 văn bản được chọn, kiểm tra số hiệu ở đầu PDF, bỏ tiêu đề điều trùng/ngữ cảnh không rõ. Truy hồi toàn bộ điều trước khi rút gọn. Máy chủ đối chiếu từng ID trích dẫn và chuỗi trích với đoạn đã đọc, tự gắn URL/trang/hash; không tin URL do model tạo. Trích sai trả 502, thiếu căn cứ trả 422, chưa đăng nhập 401, chưa cấu hình 503; không hiển thị câu trả lời thay thế như AI thật. Trích khớp không chứng minh suy luận đúng hoặc luật còn hiệu lực. Người dùng cần đối chiếu nội dung và hiệu lực trước khi áp dụng cho vụ việc cụ thể.

API dùng MongoDB hiện có: `vietnamLawDocuments`, `vietnamLawVersions`, `vietnamLawSync`, rate limiter nền tảng. Phiên bản metadata mới không được đánh dấu là đã đọc lại PDF cũ. Người dùng cần đăng nhập để tải lại tệp; sync thủ công chỉ quản trị viên. CSRF/Fetch Metadata, giới hạn JSON 60 KB và tần suất được kiểm tra tại máy chủ.

Tìm và bản trích có cache 5 phút; trang đang hiển thị kiểm tra 5 phút/lần. Vercel cron `35 2 * * *` gọi sync mới nhất 40 metadata/ngày, yêu cầu `CRON_SECRET` ít nhất 24 ký tự; lịch không phải đồng bộ toàn kho hoặc bảo đảm cập nhật tức thời. Trạng thái công khai cho biết đã có cấu hình xác thực và đợt chạy thực tế gần nhất. [Giới hạn cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) tùy gói. Không gọi cron ghi dữ liệu production trong QA.

Giới hạn đọc:12 MiB/PDF,250 trang/tệp,6 tệp/văn bản, ngân sách thời gian; bản thiếu trang ghi rõ. Tải theo nhu cầu. Service Worker chỉ hỗ trợ tài nguyên/tập dữ liệu đã mở; không cache API riêng tư hay hứa toàn kho ngoại tuyến.

Node>=22.13,<25; Vercel chọn runtime được hỗ trợ. `includeFiles` đóng gói các pack và runtime ESM/PDF worker/native canvas vì tracer cũ không phân tích được PDF.js 6. Đã thử một gói riêng không dùng `node_modules` của checkout: đọc catalogue 160,689 điều và 2 trang PDF trực tuyến thành công. Kiểm tra Linux production được báo riêng sau push.

## Xác minh

-532 tests:130 learning,241 all-tools,107 security,54 focused (32 pháp luật,12 đại học,10 gateway);0 fail,0 skip.
- Chromium thật:16 theme,2.007 kiểm tra tương phản,375/768/1440 px,DPR 2,zoom 200%,forced-colors/focus;0 tràn ngang,0 lỗi JavaScript. [Kết quả](qa-1070/results.json), [tương phản](qa-1070/readability.json).
- Đã kiểm tra tìm số hiệu, điều 16/khoản 1, điểm trích thực, điều không tồn tại, PDF trang, lưu/ghi chú/reload, trường hợp nguồn lỗi, bộ lọc hiệu lực trong tập đối chiếu, IME khi hydrate chậm, bản lưu tương lai giữ nguyên, Service Worker ngoại tuyến và rời module.
- Backend QA chạy handler thật với DB/identity/provider fixture được ghi rõ. Đã kiểm tra 401,502 trích dẫn bịa và câu trả lời có trích khớp; chưa gọi model tính phí hoặc ghi tài khoản production trong QA.
- Kiểm tra dependency production còn 6 cảnh báo đã tồn tại:1 low và 5 high ở các nhánh SimpleWebAuthn/Vercel Blob/undici/zod. Hai dependency mới PDF.js 6.4.299 (Apache-2.0) và parse5 8.0.1 (MIT) không có mục advisory trong audit tại thời điểm kiểm tra. CI trước release 1069 thất bại ở bước audit này; không báo toàn bộ CI xanh. CodeQL 1069 đã qua. Không thay đổi stack xác thực/blob ngoài phạm vi yêu cầu.

## Tái tạo dữ liệu

`node scripts/import-hh-vietnam-law.js --refresh` chỉ tạo candidate trong `.study-local/vietnam-law-1070/candidate`. Kiểm tra nguồn, số hiệu, PDF, hash và failures trước khi chạy `node scripts/build-hh-vietnam-law.js --candidate <reviewed-directory>`. Sau đó `node scripts/report-hh-vietnam-law.js`. Không tự xuất bản candidate hoặc sửa tệp đã ghim mà bỏ qua manifest.

Chỉ nhập thuộc tính thực tế và văn bản pháp luật gốc; không sao chép bài phân tích thương mại. Giữ liên kết/tên cơ quan nguồn, thời điểm và SHA-256; mã thư viện bên thứ ba giữ license trong gói runtime.
