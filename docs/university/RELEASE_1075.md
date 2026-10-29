# HH University — bản 1075

Ngày 29/10/2026. Nâng cấp mục độc lập `/university/*` phục vụ hai hành trình: chọn trường/ngành và quản lý việc học của sinh viên. Kế thừa nguyên danh mục, điểm 2020–2026, chương trình học, URL cũ và tiến độ Bàn học. Không đổi schema dữ liệu K12 hoặc MATHCORE.

## Chức năng đã triển khai

| Yêu cầu | Hành vi thực tế và phạm vi |
| --- | --- |
| 1. Trải nghiệm | Hai lối vào ở trang chủ; điều hướng khám phá trường/ngành, tuyển sinh, so sánh, nguyện vọng, học phí/học bổng, Bàn học, tài liệu, AI. Điều hướng phụ dẫn tới lịch, kế hoạch/GPA, nghề nghiệp và nguồn. Thanh mục cuộn ngang trên mobile, tự đưa mục đang mở vào vùng nhìn thấy. Dùng token và đủ 16 theme hiện có. |
| 2. Hồ sơ trường | Giữ 959 hồ sơ; bổ sung metadata chính thức cho UIT, Bách khoa Đà Nẵng và FPT Polytechnic: website, liên hệ, các địa chỉ đã đọc được, nguồn và ngày kiểm tra. Không tự xác nhận ký túc xá, thay đổi pháp nhân hoặc kiểm định còn hiệu lực khi thiếu nguồn. |
| 3. Tìm ngành xuyên trường | Chỉ mục tải theo nhu cầu có 21.286 biến thể tên/mã, tìm không dấu, lọc trường/nhóm/ngành/năm; xem nguồn và mở hồ sơ thật. Nhóm nghề do HH biên soạn được tách khỏi thông tin chương trình chính thức. |
| 4. So sánh | Tối đa bốn trường/chương trình, bảng thông tin và liên kết nguồn, ghi chú, lưu trên thiết bị, xuất CSV và bản in/PDF qua trình duyệt. Ô thiếu dữ liệu hiển thị rõ. |
| 5. Điểm và tính điểm | Giữ bộ lọc, lịch sử và CSV 2020–2026. Biểu đồ chỉ dùng bản ghi cùng thang/phương thức/đợt, không nối năm thiếu. Một công thức HUBT 2026 được giới hạn rõ theo trường, mã chương trình và phương thức; các trường hợp chưa có quy tắc không được tự tính. |
| 6. Nguyện vọng | Hồ sơ sở thích, môn mạnh/điểm tự nhập, vùng, ngân sách và mục tiêu; gợi ý có giải thích và trọng số điều chỉnh. Điểm tự khai chỉ là ghi chú, không suy ra xác suất đỗ. Danh sách chống trùng, kéo thả hoặc nút lên/xuống, ghi chú từng mục, lưu và xuất CSV. Có liên kết tới hệ thống đăng ký chính thức. |
| 7. Lịch và hồ sơ | Mốc nguồn kèm phạm vi áp dụng; tạo mốc cá nhân, checklist, đánh dấu hoàn thành, xuất ICS. Mốc giờ Việt Nam được đổi chính xác sang UTC; sự kiện cả ngày dùng ngày kết thúc loại trừ. Thông báo trình duyệt chỉ xin quyền sau thao tác bật, chỉ nhắc khi trang còn mở. |
| 8. Tài chính | Phân biệt học phí nguồn theo khóa/năm/đơn vị với tiền sinh hoạt tự nhập. Dự toán có khoảng, số tháng, tín chỉ, khoản phát sinh và hỗ trợ đã xác nhận. Lưu thông báo học bổng, lọc hạn đăng ký, tạo checklist. |
| 9. Kế hoạch và GPA | Tạo/sửa học phần, tín chỉ, kỳ, lịch, môn tiên quyết, điểm, học lại, pass/fail và môn loại khỏi GPA. Cấu hình thang 4/10/100 và cách lấy lần học; tín chỉ đạt không cộng trùng mã môn. Mô phỏng GPA cần đạt, cảnh báo mục tiêu không khả thi, trùng lịch hoặc thiếu môn tiên quyết. Nhập bảng UIT thành học phần dự kiến **chưa phân kỳ**; không gán điều kiện tốt nghiệp. Có tìm/lọc/phân trang học phần. |
| 10. Học liệu và ôn tập | Tra cứu 65 liên kết học liệu, quyền sử dụng, lưu, đánh dấu trang và ghi chú; xem sáu học phần nền tảng do HH biên soạn. Flashcard có lịch ôn, bài trắc nghiệm từ câu hỏi thật, tiếp tục bài đang làm, sổ câu sai và luyện lại. Đọc PDF chính thức đã kiểm tra ngay trong trang hoặc PDF cục bộ; luôn có đường về nguồn gốc. |
| 11. Gemini | Hỏi bài, nhận xét bài làm, lập kế hoạch, tạo bài tập/flashcard và hỏi tuyển sinh theo nguồn đã chọn. API dùng xác thực, CSRF, giới hạn yêu cầu, timeout, dữ liệu nguồn được pin SHA/byte/version và kiểm tra trích dẫn. Kết quả tuyển sinh chỉ đưa số liệu trong đoạn trích khớp nguồn; thay đổi ngữ cảnh hủy kết quả cũ. Không tự gửi CV/hồ sơ cá nhân. |
| 12. Nghề nghiệp | Tám nhóm định hướng HH, kế hoạch kỹ năng, dự án thực hành, đánh dấu hoàn thành; CV chỉnh sửa, xuất HTML an toàn, in/PDF và xóa. Các cổng việc làm chính thức là liên kết, không giả làm tin tuyển dụng còn hạn hoặc nguồn lương. |
| 13. Biên tập | Trang độ phủ, nguồn và fingerprint; gửi báo sai sau đăng nhập, hàng đợi quản trị, cập nhật có revision và lịch sử. Duyệt đề nghị không tự công bố dữ liệu. Script kiểm tra nguồn chỉ tạo candidate, yêu cầu đối chiếu ngữ nghĩa trước khi nhập metadata. |
| 14. Dữ liệu và kiểm thử | State mới có phiên bản, tách theo tài khoản trên thiết bị, xuất/xóa và bảo vệ dữ liệu phiên bản tương lai. Khi localStorage đầy, các chỉnh sửa tiếp theo vẫn được giữ trong phiên và có xuất phục hồi. Fetch, listener, timer, iframe/blob được dọn khi rời module. Kiểm thử thật trên Chromium, mobile, zoom và đủ theme; AI dùng fixture được ghi rõ. |

## Độ phủ dữ liệu, nguồn và giới hạn

Danh mục kế thừa có **959 hồ sơ**, gồm tên lịch sử, đơn vị thành viên/phân hiệu và cao đẳng; chưa phải cuộc đối chiếu đầy đủ các cơ sở đang hoạt động. **21.286 biến thể** ở **586 hồ sơ** không tương đương số ngành đào tạo duy nhất đang mở. Điểm có **119.621 bản ghi tại 309 hồ sơ**. Những dòng không nêu thang điểm tiếp tục giữ chưa xác định. Bảng từng trường và năm: [ma trận 1069](coverage-1069.json), [diễn giải nguồn cũ](RELEASE_1069.md).

Metadata chính thức mới có **3 hồ sơ bổ sung**, **2 dòng học phí dự kiến**, **2 thông báo đăng ký học bổng**, **1 công thức tính điểm phạm vi hẹp**, **3 mốc lịch nguồn**, **8 nguồn đã đối chiếu**. Không tuyên bố đã có đầy đủ học phí, học bổng, công thức hoặc thông tin hiện hành của toàn bộ trường.

- [UIT: học phí và học bổng](https://tuyensinh.uit.edu.vn/hoc-phi-hoc-bong) là thông báo tháng 06/2025. Các mức 37 triệu năm học 2025–2026 và 42 triệu năm học 2026–2027 được giữ là **dự kiến cho khóa 2025**, không đổi thành học phí khóa 2026 đã xác nhận.
- [UIT: đăng ký học bổng HK1 2026–2027](https://ctsv.uit.edu.vn/bai-viet/thong-bao-dang-ky-xet-cap-cac-loai-hoc-bong-hk-1-nh-2026-2027) có hạn đăng ký 01/11/2026; mỗi loại giữ đối tượng/điều kiện riêng. Thông báo đăng ký không phải quyết định cấp học bổng hoặc mức hỗ trợ đã bảo đảm.
- [HUBT: phương thức tuyển sinh](https://tuyensinh.hubt.edu.vn/cau-hoi-thuong-gap/truong-dai-hoc-kinh-doanh-va-cong-nghe-chi-ap-dung-cac-phuong-thuc-xet-tuyen-nao/) hỗ trợ ca tính tổng ba điểm THPT, phương thức 100 năm 2026 cho hai mã 7480201/7340101, chỉ khi người dùng xác nhận không có ưu tiên, điểm cộng hoặc quy đổi chứng chỉ. Không tính đủ điều kiện hồ sơ hay kết luận trúng tuyển.
- [Kế hoạch tuyển sinh 2026](https://xaydungchinhsach.chinhphu.vn/ke-hoach-tuyen-sinh-dai-hoc-cao-dang-nam-2026-119251104111312456.htm) được ghi là kế hoạch lịch sử cần đối chiếu thông báo điều chỉnh; chưa xác nhận mọi thay đổi và lịch riêng của trường.
- [Bách khoa Đà Nẵng](https://tuyensinh.dut.udn.vn/phuong-thuc-tuyen-sinh) và [FPT Polytechnic](https://caodang.fpt.edu.vn/tuyen-sinh/hoc-phi) bổ sung các thông tin liên hệ đã đọc được. Không chuyển công thức/học phí trong hình ảnh chưa đối chiếu thành dữ liệu tính toán.
- [PDF tuyển sinh UIT](https://tuyensinh.uit.edu.vn/sites/default/files/uploads/files/202607/dean_moi.pdf) được kiểm tra HTTP, loại nội dung và khả năng nhúng thực tế. Chỉ liên kết/nhúng từ nguồn trường; không phân phối lại file. PDF cục bộ không được tự tải lên máy chủ.

Hai bảng chương trình UIT vẫn là **176 mã học phần**, chưa xác minh phân kỳ, bắt buộc/tự chọn và quy tắc tốt nghiệp. Sáu khóa nền tảng HH gồm **36 bài**, là nội dung tự biên soạn ở mức nền tảng/chưa thẩm định; không thay thế đầy đủ chương trình của mọi ngành. 65 tài liệu ngoài giữ dạng metadata/liên kết và điều kiện sử dụng, không sao chép sách hay kho tài liệu ngoài.

[Baseline nguồn](../../data/hh-university/workspace/source-baseline.json) ghi **7 HTTP 200, 1 lỗi timeout FPT** trong lần kiểm tra trực tiếp; trang FPT đã đọc được qua nguồn công khai khi đối chiếu. Fingerprint chỉ phát hiện thay đổi nội dung kỹ thuật, không tự xác nhận chính sách mới. Các liên kết có thể thay đổi sau thời điểm kiểm tra.

## Lưu trữ và máy chủ

Namespace mới là `hh.university.workspace.v1:<owner>`, riêng với `hh.university.v1` và cơ chế HH School/IndexedDB cũ. Các công cụ cá nhân mới lưu theo tài khoản **trên thiết bị**, chưa đồng bộ đa thiết bị. Tiến độ Bàn học cũ giữ cơ chế đồng bộ hiện có. Nhắc việc không chạy nền khi website đóng; dùng ICS để đưa lịch sang ứng dụng lịch riêng.

API đi qua function modules hiện có, không tạo thêm function slot:

- `GET /api/university/status`: cấu hình Gemini và kiểm tra `dataReady` của gói dữ liệu máy chủ; không gọi mô hình.
- `POST /api/university/ask`: đăng nhập; tối đa 12 yêu cầu/tài khoản/10 phút và 30/IP/10 phút. Các khóa Gemini chỉ đọc phía máy chủ; `UNIVERSITY_GEMINI_MODEL` là override tùy chọn, không làm đổi cấu hình MATHCORE.
- `POST /api/university/reports`: gửi nguồn cần đối chiếu; tối đa 6/tài khoản/giờ.
- `GET/PATCH /api/university/reports`: chỉ quản trị; có kiểm tra revision, lịch sử và `published:false`.

Gemini đã tích hợp adapter thật. QA chỉ dùng phản hồi Gemini mô phỏng qua handler/REST adapter thật; không gọi mô hình trả phí hoặc xác nhận chất lượng câu trả lời thật trong lần bàn giao này. Khả năng trả lời thật còn phụ thuộc khóa, model và quota của nhà cung cấp. Kiểm tra đoạn trích khớp không bảo đảm mọi suy luận của mô hình đều đúng.

## Tái tạo và kiểm thử

Chạy `node scripts/build-hh-university-workspace.js` sau khi cập nhật metadata hoặc dữ liệu danh mục; script kiểm tra hash các gói và tạo chỉ mục/sidecar xác định. Build danh mục gốc cũng gọi bước này. Chạy `node scripts/audit-hh-university-sources.js --refresh` để tạo candidate tại `.study-local/university-1075/source-check-candidate.json`; không tự công bố dữ liệu lấy về. Mở rộng năm phải cập nhật cấu hình năm/pipeline gốc và kiểm tra dữ liệu nguồn, không tự đổi nhãn dữ liệu năm cũ.

**633 kiểm thử đạt, 0 lỗi, 0 bỏ qua**: công cụ/shell 241, bảo mật đầy đủ 107, Học tập 130, University/MATHCORE/Pháp luật/gateway/home 155. Riêng workspace mới có 22 test cho GPA/tín chỉ, điều kiện tiên quyết, dự toán, CSV/ICS, phiên bản dữ liệu, công thức tuyển sinh, kiểm tra nguồn, xác thực và biên tập. Kiểm tra cú pháp và `git diff --check` đạt.

Native Chromium full shell: **26 luồng**, **89 lượt đo trạng thái**, **4.702 phép đo tương phản**, đủ **16 theme**, 375/768/1440px, DPR2, zoom 200%, forced colors và bàn phím. Không page error hoặc tràn ngang; kiểm tra tài nguyên offline qua Service Worker, giữ ghi chú cũ, nhập bảng UIT, GPA, bài ôn/câu sai, PDF nguồn thật và PDF blob, CV thoát HTML/in sạch sidebar, từ chối quyền biên tập, hủy AI cũ, phục hồi dữ liệu tương lai và lỗi quota.

Lệnh chính:

```text
npm run test:all-tools
npm run test:security:full
npm run test:learning
node --test tests/hh-university.test.js tests/hh-university-workspace.test.js tests/hh-mathcore.test.js tests/hh-mathcore-upgrade.test.js tests/hh-mathcore-gemini.test.js tests/hh-vietnam-law.test.js tests/hh-vietnam-law-pdf-transport.test.js tests/hh-core-gateway.test.js tests/platform-home.test.js tests/platform-home-scroll.test.js
```

Đặt `HH_QA_PLAYWRIGHT`, `HH_QA_CHROMIUM` theo môi trường native; đặt `HH_QA_UNIVERSITY_WORKSPACE=1`, tùy chọn `HH_QA_OUTPUT`, rồi chạy `node scripts/qa-hh-university.js`. Báo cáo ghi rõ tài khoản/DB/Gemini là fixture; riêng PDF trường được truy cập thật.

[Báo cáo kiểm thử](qa-1075/report.json), [luồng trình duyệt](qa-1075/results.json), [tương phản](qa-1075/readability.json), [tìm ngành](qa-1075/workspace-majors.png), [so sánh](qa-1075/workspace-compare.png), [dự toán](qa-1075/workspace-budget.png), [GPA](qa-1075/workspace-gpa.png), [AI fixture](qa-1075/workspace-gemini-fixture.png), [mobile](qa-1075/workspace-mobile.png), [CV khi in](qa-1075/workspace-cv-print.png).

Audit dependency hiện báo **5 high, 1 low** trong cây dependency có sẵn; bản này không thêm/sửa package hoặc lockfile. Không xem kiểm thử chức năng đạt là toàn bộ CI bảo mật đã đạt.

Version: release/cache **1075**, loader **736**, router **300**, University main/CSS **2**, helper workspace **1**. Kết quả deployment và smoke test website thật được xác minh sau push và báo trong chat.
