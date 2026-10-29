# HH University — xác minh triển khai 1077

Tiếp nối toàn bộ chức năng và [báo cáo 1076](RELEASE_1076.md). Bản sửa này giữ nguyên dữ liệu cá nhân và phạm vi nội dung.

Kiểm tra website sau push 1076 phát hiện `dataReady:false`: bộ bài tập được hash theo CRLF ở Windows, trong khi Git chuẩn hóa file thành LF khi triển khai. Kiểm thử tại máy dùng cùng byte CRLF nên chưa bắt được khác biệt đó. Bước build hiện chuẩn hóa bộ bài tập nguyên bản HH sang UTF-8/LF **trước** khi tính byte/SHA. Test xác nhận file LF; kiểm tra staging đối chiếu trực tiếp byte trong Git với pin. Không chuẩn hóa hoặc sửa file PDF/tài nguyên upstream được giữ nguyên byte.

Đồng thời giữ focus và mở đúng bộ lọc trường khi người dùng áp dụng bằng Enter trên mobile. Bộ lọc, tìm kiếm đã lưu và URL khi quay lại vẫn được giữ.

Cache/release **1077**, loader **738**, University main **4**, sidecar **3**; tools/workspace **2**, experience core/UI/CSS **1**, router **300**. Việc đổi phiên bản giúp tab dùng Service Worker cũ tải đúng sidecar đã sửa checksum.

Đã chạy lại 177 test focused và 241 test công cụ; kết hợp 107 test bảo mật và 130 test Học tập không thay đổi, tổng **655 đạt**. Lượt Chromium cuối dùng asset 1077 vẫn đạt **41 luồng**, gồm nguồn PDF thật, hash bộ bài tập, mobile Enter/focus và quy trình bản sao có revision. [Bằng chứng cuối](qa-1076/report.json), [luồng trình duyệt](qa-1076/results.json).

Giới hạn dữ liệu/AI/bản sao được giữ đúng như báo cáo 1076. Gemini được kiểm thử bằng fixture; không gọi mô hình trả phí hoặc ghi dữ liệu tài khoản production. Audit dependency vẫn có 5 high, 1 low trong thư viện hiện có. Kết quả readiness và smoke test production được xác minh sau push.
