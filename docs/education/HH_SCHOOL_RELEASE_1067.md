# HH School 1067 — giữ hoạt động tương tác khi dữ liệu nền về

Hoàn thiện ngày 28/10/2026, tiếp nối [bản nâng cấp 1066](HH_SCHOOL_RELEASE_1066.md). Phạm vi vẫn là HH School `/learn/*` và các thành phần phục vụ trực tiếp.

Khi người học nhập 62 và bấm biểu diễn phần trăm trước khi phản hồi tiến độ nền hoàn tất, lần vẽ lại trước đây có thể đưa mô hình về mặc định 35. Bản vá giữ chính form và vùng kết quả của hoạt động đang mở khi cùng bài học/cùng loại hoạt động được vẽ lại; nút đang dùng được khôi phục focus. Bài khác dùng giá trị riêng. Tham chiếu DOM thuộc vòng đời workspace và được giải phóng khi unmount.

Áp dụng cho các hoạt động đếm nhóm, phân số, phần trăm và áp suất dùng form hiện có. Giá trị mô hình chỉ thuộc phiên mở bài; nháp luyện tập, bài thi và ghi chú tiếp tục dùng cơ chế lưu theo tài khoản/hồ sơ của 1066. Tương tác mô hình không tự chứng nhận thành thạo.

Browser regression cố tình giữ phản hồi GET tiến độ, nhập và nộp form phần trăm, rồi thả phản hồi để handler hydrate thật vẽ lại. Sau đó xác minh input vẫn là 62, có đúng 62 ô được tô, focus còn ở nút, và bài phân số khác khởi tạo đúng giá trị của mình. Trước sửa, kiểm tra thất bại với `35 !== 62`; sau sửa đạt.

Bộ HTTP fixture QA được sửa để ghép đủ byte request trước khi giải mã UTF-8. Cách nối chuỗi từ từng chunk trước đây có thể làm hỏng ký tự tiếng Việt/emoji đúng ranh giới chunk và tạo lỗi checksum giả. Backend sản xuất và transport SHA-256 giữ nguyên.

467 kiểm thử đạt, 0 lỗi, 0 bỏ qua: Học tập 119, công cụ/shell 241, bảo mật 107. Chạy lại đủ 7 bộ Chromium: workspace, shell, recovery, refinement, offline, classroom, editorial. Có kiểm tra 168 cấu hình lớp–môn, 16 theme, mobile 375px, tablet, desktop, DPR2, zoom 200%, IME, focus, offline và lịch sử lớn. Bộ refinement có thêm tình huống phản hồi chậm nêu trên; các handler thật vẫn chạy với cookie QA và MongoDB trong bộ nhớ được khai báo rõ.

[Báo cáo máy đọc được](qa-1067/report.json), [kết quả refinement](qa-1067/refinement.json), [ảnh mô hình sau hydrate](qa-1067/percent-after-hydration.png) và [full shell mobile](qa-1067/home-mobile.jpg). Ảnh của các màn hình khác cùng bảng chức năng/nguồn/độ phủ nằm trong bàn giao 1066.

Phiên bản cuối: loader 728, Service Worker cache 1067, workspace JS v3, host v9. Workspace CSS v2, core v6, sync v5, codec v1 và content manifest v2 giữ nguyên. Các script QA mặc định ghi vào `.study-local/*-1067`.

Học liệu hiện có 225 bài, 822 câu; tất cả vẫn là bản nháp, 0 bài được thẩm định. Chưa hoàn tất nội dung và đối chiếu SGK cho toàn bộ lớp 1–12. Đồng bộ lớn hỗ trợ tối đa 32 MiB/snapshot; chưa có lịch thu gom các snapshot cloud cũ hoặc benchmark toàn giới hạn trên thiết bị yếu. Các giới hạn và nguồn tham khảo chi tiết tiếp tục được ghi trong bàn giao 1066.
