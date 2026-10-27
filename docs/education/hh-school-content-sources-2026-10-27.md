# HH School — hồ sơ nguồn và phạm vi biên soạn

Ngày kiểm tra: 26–27/10/2026. Hồ sơ này phân biệt văn bản chương trình để đối chiếu, bài giảng nguyên bản đang biên soạn và nội dung đã qua thẩm định. Kiểm thử mã hoặc đáp án cấu hình không tạo ra phê duyệt chuyên môn.

## Văn bản đã truy cập

| Nguồn | Việc đã thực hiện | Cách sử dụng và giới hạn |
| --- | --- | --- |
| [CTGDPT và các chương trình môn học — bản lưu tại Đại học Cần Thơ](https://se.ctu.edu.vn/images/upload/thongbao/TT32.pdf) | Tải 14.971.469 byte; PDF 1.555 trang; trích văn bản để định vị các phần lớp–môn. SHA-256 `fc2c7f5345db34a1e516920f1f298693e5dbd57365f88adeb4edc662645a0ea0`. | Bản lưu tài liệu do Bộ GDĐT ban hành tại cơ sở giáo dục; không coi là bản hợp nhất hiện hành hoặc sách giáo khoa. Repo chỉ lưu chỉ mục trang, hash và phạm vi, không đóng gói lại toàn bộ PDF. |
| [Chương trình môn Ngữ văn — tài liệu Bộ GDĐT tại trường Bàu Sen](https://fileth.hcm.shieldix.app/Data/hcmedu/thbausen/2020_3/ctngu_van_193202020.pdf) | Mở trực tiếp bản 110 trang, đối chiếu vị trí các lớp và mạch đọc–viết–nói–nghe. | Chỉ đối chiếu chương trình; đoạn đọc, ví dụ và bài tập mới được biên soạn nguyên bản, không chép ngữ liệu SGK thương mại. |
| [Thông tư 17/2025/TT-BGDĐT — Công báo](https://congbao.chinhphu.vn/tai-ve-van-ban-so-17-2025-tt-bgddt-46255-59050?format=pdf) | Đọc nội dung sửa đổi; [bản PDF 22 trang trên kho Chính phủ](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/9/17-bgddt.pdf) đã tải, SHA-256 `1d40c0513a1fdff35245c633ffc382122a18d2d5c0fbc96fcb426a51a8f9fea6`. | Cần đối chiếu các phần Lịch sử–Địa lí tiểu học/THCS, Lịch sử 10, Địa lí và GDCD bị tác động. Không dùng số tỉnh/vùng hoặc mô tả bộ máy cũ như mặc định hiện hành. Việc đối chiếu toàn bộ từng yêu cầu còn thiếu. |
| [Thông tư 13/2022/TT-BGDĐT — đăng Công báo](https://congbao.chinhphu.vn/van-ban-dang-cong-bao/thong-tu-l3/trang-222.htm) | Đã đọc hồ sơ đăng văn bản và phạm vi điều chỉnh. | Chưa hoàn thành đối chiếu toàn bộ phụ lục sửa đổi Lịch sử THPT và chuyên đề. Không coi bản Lịch sử 2018 là đủ cho chương trình hiện hành. |
| [Thông tư 46/2020/TT-BGDĐT — GDQPAN](https://congbao.chinhphu.vn/van-ban/thong-tu-so-46-2020-tt-bgddt-32620.htm) | Xác định văn bản chương trình môn GDQPAN riêng. | Chưa định vị, đối chiếu đầy đủ phụ lục và sửa đổi hiện hành trong pack. Bài an toàn/công dân được gắn nhãn bản nháp, không thay huấn luyện thực hành có giáo viên. |
| [Dự thảo sửa CTGDPT công bố 21/8/2026](https://xaydungchinhsach.chinhphu.vn/toan-van-du-thao-thong-tu-sua-doi-bo-sung-mot-so-noi-dung-trong-chuong-trinh-giao-duc-pho-thong-119260820174117596.htm) | Kiểm tra được đây là **dự thảo**, có nội dung liên quan tiếng Anh tiểu học. | Không biến dự thảo thành quy định đã có hiệu lực. Tiếng Anh 1–2 trong dữ liệu mới là phần làm quen tự chọn/mở rộng, chưa xác nhận đủ chương trình cho cấu hình trường cụ thể. |

Một số URL Bộ GDĐT cũ bị timeout/không mở được trong lượt kiểm tra, gồm URL bản hợp nhất `vbhn-ttu-322018-202021-132022-ttbgddt.pdf`. Bản lưu tại trường/đại học được dùng để đọc chính tài liệu chương trình; không suy từ đó rằng mọi sửa đổi hiện hành đã được hợp nhất.

## Chỉ mục có gì

`data/hh-school/curriculum/source-index.json` giữ **153 vị trí phần chương trình theo lớp/nhánh**, nguồn, trang PDF, hash phần trích và trạng thái đối chiếu. Ba dòng lớp 10–12 trong mục lục Địa lí đã được loại; các phần thật bắt đầu ở trang 566, 576, 585. Lớp 1 GDTC nằm sau bảng tổng quan trên trang 1161. Nhánh Công nghệ công nghiệp/nông nghiệp và các nhánh Tin học được giữ riêng.

Số dấu đầu dòng tự trích chỉ là ứng viên phục vụ biên tập, có thể bị ảnh hưởng ngắt dòng/bảng. **Không dùng chúng làm mẫu số của phần trăm độ phủ**. `officialOutcomeCount` được giữ `null` cho đến khi đã phân tách, khử trùng, đối chiếu sửa đổi và được người thẩm định xác nhận. Mục tiêu của từng bài biên soạn có ID riêng; không giả đây là mã yêu cầu chính thức của Bộ.

## Bài giảng và bài tập

Dữ liệu `authored-*.json` là nguồn biên soạn chuẩn. Builder tạo pack theo lớp, manifest có SHA-256, URL cache theo hash, metadata lớp–môn–chương–mục tiêu và các câu có ID ổn định. Mỗi bài có phần giải thích tại chỗ, ví dụ từng bước, câu luyện có gợi ý, câu kiểm tra khác, phản hồi hiểu nhầm và hoạt động có rubric. Các đoạn đọc và tình huống mới là nguyên bản; ảnh, nhạc, văn bản hoặc đề thương mại không được nhập vào chỉ vì xem được miễn phí.

Mọi bài mới giữ `contentStatus: draft`, `editorialStatus: needs-subject-review`, không có tên người duyệt hoặc ngày duyệt giả. Luồng đã xuất bản không tự chứa các bản nháp. Xem trước cần lựa chọn rõ và lượt làm chỉ là luyện thử. `textbookCrosscheck` ghi **chưa hoàn thành**, danh sách ấn bản đã đối chiếu để trống. Không tự nhận đã đọc toàn bộ sách giáo khoa, sách giáo viên hay sách nâng cao; chưa đo thời lượng của người học thật.

Các mô hình khoa học có giả định, đơn vị và giới hạn; bài điện, hóa, nhiệt chỉ dùng sơ đồ/dữ liệu phù hợp, không hướng dẫn tự thử nguồn điện gia đình, hóa chất hay vật nóng. Hoạt động thể chất, sức khỏe và GDQPAN không được coi là xác nhận năng lực thực hành hoặc hướng dẫn y tế cá nhân.

## Phần còn phải hoàn thiện trước khi gọi là giáo trình đầy đủ

- Phân tách và đối chiếu **toàn bộ** yêu cầu cần đạt hiện hành của mỗi lớp–môn; định lượng đúng phần chưa có bài.
- Biên soạn những chủ đề còn thiếu; một vài bài trong một môn không đủ để đánh dấu môn đã hoàn tất.
- Đối chiếu các bộ sách/ấn bản cụ thể; lưu phần đã đối chiếu, tác giả, nhà xuất bản và bằng chứng quyền đối với media/văn bản thực sự phân phối.
- Chọn ngôn ngữ/chương trình cho Ngoại ngữ 2 và tiếng dân tộc; chọn tỉnh/thành và tài liệu được duyệt cho giáo dục địa phương.
- Hoàn thiện chuyên đề THPT, nhánh Tin học/Công nghệ và nguồn GDQPAN riêng; không dùng một bài sơ lược để thay cả nhánh.
- Thẩm định chuyên môn, rà đáp án/rubric và chơi thử học tập với người mới; test kỹ thuật không thay bước này.

[Ma trận 168 cấu hình lớp–môn và khoảng trống](hh-school-curriculum-coverage-2026-10-27.md) được sinh lại từ dữ liệu thật. Các trường `complete: false` và 0 bài đã được duyệt phải được giữ cho đến khi có đủ bằng chứng tương ứng.
