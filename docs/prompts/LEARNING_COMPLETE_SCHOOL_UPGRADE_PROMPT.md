# Prompt triển khai: hoàn thiện toàn bộ Học tập — lớp 1–12, nền tảng đến nâng cao, học và ôn thi

Hãy trực tiếp nâng cấp toàn bộ **mục lớn Học tập của hoang8.com — module HH School tại `/learn/*`**, gồm nội dung lớp 1–12 và tất cả chức năng bên trong module, thành một hệ thống tự học có giáo trình đầy đủ, bài giảng dễ hiểu, thực hành, đánh giá, chữa sai và ôn thi. Một người mới hoặc mất gốc phải biết bắt đầu ở đâu, được giải thích kiến thức từ nền tảng, luyện từng bước và tiến tới các bài kiểm tra phù hợp.

Phạm vi thay đổi là HH School và các API, dữ liệu, tài nguyên trực tiếp phục vụ HH School. Giữ nguyên các module độc lập khác; không mở rộng tác vụ sang nâng cấp những mục khác của website. Ngoại ngữ là môn học trong chương trình phổ thông thì vẫn thuộc ma trận lớp–môn của HH School.

Đây là yêu cầu triển khai thực tế, không chỉ thiết kế giao diện hoặc thêm danh mục. Mục tiêu là tái tạo chu trình học tập có cấu trúc như ở trường và luyện thi sát hình thức thực tế; kết quả trong ứng dụng vẫn phải được trình bày đúng là kết quả luyện tập/thi thử.

## 1. Đọc project và xác minh baseline

Đọc `AGENTS.md`, Git status/log, cấu trúc repository và toàn bộ phần Học tập trước khi sửa. Giữ kiến trúc global mount/vanilla JS, routing/sidebar/command search, tải theo nhu cầu và các ID đã phát hành.

Các file cần khảo sát gồm `script.js`, `index.html`, `performance-loader.js`, `sw.js`; `hh-school.js/.css`, `hh-school-curriculum.js`, `hh-school-core.js`, `hh-school-offline.js`, `hh-school-sync.js`, search/code workers; backend `utils/education-handler.js` và các endpoint liên quan; `tests/hh-school-*.test.js`, `docs/education/ctgdpt-2018-sources.md`, `data/hh-school/original-content-manifest.json`.

Baseline kiểm tra ngày 26/10/2026 tại commit `d5d829b`: HH School có khung 12 lớp, 168 cặp lớp–môn/hoạt động trong catalog, 96 bản ghi bài mẫu, 576 câu hỏi; mới có bài ở 48 cặp lớp–môn. Có 48 bài `checked`, 48 bài `machine_generated`, chưa có bài thỏa `canPublish`. Đây là số liệu mã nguồn, không phải xác nhận chương trình đã đầy đủ hay catalog đã đúng toàn bộ quy định hiện hành. Xác minh lại vì repository có thể đã thay đổi.

Điều tra trực tiếp các điểm yếu: biến thể bài học lặp nội dung, yêu cầu cần đạt chung chung, cùng câu hỏi xuất hiện ở nhiều bước, bấm Next đã được tính hoàn thành, đề tương đương chỉ đổi offset, lab dùng chung giữa các lớp, chấm đáp án ngắn bằng chuỗi/từ khóa và giới hạn lưu làm mất lịch sử khi học nhiều năm. Sửa nguyên nhân; không hợp thức hóa bằng đổi nhãn.

## 2. Xây dựng ma trận chương trình đầy đủ và nguồn đối chiếu

Lấy **yêu cầu cần đạt của chương trình hiện hành** làm trục. Đối chiếu từng lớp, môn, học kỳ, mạch kiến thức, chương/chủ đề, bài, năng lực và kỹ năng. Phân biệt môn bắt buộc, lựa chọn, chuyên đề, môn tích hợp/phân môn, hoạt động trải nghiệm và nội dung địa phương; không áp cùng danh sách môn cho mọi lớp.

Nguồn phải được đọc trực tiếp: chương trình của Bộ GDĐT và sửa đổi còn hiệu lực, sách giáo khoa/sách giáo viên/sách bài tập đúng phiên bản, tài liệu nâng cao có tác giả–nhà xuất bản rõ, quy định đánh giá và cấu trúc thi chính thức theo năm/địa phương. Kiểm tra thay đổi sách năm học 2026–2027 và các cập nhật mới hơn trước khi chốt nội dung. Không mặc định sách cũ hoặc quy chế thi của năm trước vẫn áp dụng.

Tách `curriculumVersion`, `academicYear`, `textbookEdition` và `examSpecVersion`. Có bảng liên kết chương/bài sách với các yêu cầu cần đạt dùng chung; nội dung phù hợp nhiều sách không cần nhân bản thành các bài giống nhau. Chọn bộ sách mặc định theo danh mục áp dụng thực tế. Địa phương cần chọn tỉnh/thành và phiên bản tài liệu; ngoại ngữ/tiếng dân tộc cần xác định đúng ngôn ngữ. Phần chưa có nguồn phải ghi thiếu cụ thể.

Xuất ma trận `lớp × môn × chủ đề × yêu cầu cần đạt` với nguồn, bài học, bài tập, đánh giá, nội dung nâng cao, trạng thái biên tập và bằng chứng QA. Mỗi yêu cầu cần đạt phải có minh chứng nội dung và cách kiểm tra phù hợp. Độ phủ được tính từ ma trận này; số record, số trang hoặc số câu sinh ngẫu nhiên không chứng minh đầy đủ.

## 3. Biên soạn đầy đủ để người mới tự học được

Mỗi bài cần giải thích trọn vẹn trong ứng dụng: mục tiêu, kiến thức tiên quyết, khởi động, thuật ngữ, lý thuyết dễ hiểu, hình/sơ đồ phù hợp, ví dụ giải thích từng bước, luyện có hướng dẫn, bài tự làm, lỗi thường gặp, ứng dụng và tóm tắt/ôn sau bài. Link ngoài là tài liệu đối chiếu/bổ sung, không thay toàn bộ bài giảng.

Xây ba lớp nội dung **Bù nền tảng → Chuẩn chương trình → Nâng cao**, có liên kết kiến thức tiên quyết và hướng quay lại khi bị hổng. Nâng cao phải tăng suy luận, chuyển giao và lựa chọn phương pháp, không chỉ tăng số lớn, đổi tên nhân vật hoặc kéo dài đề. Gắn rõ phần mở rộng ngoài yêu cầu bắt buộc; không khiến học sinh tưởng mọi bài nâng cao đều bắt buộc thi.

Quy mô bài/chương và ngân hàng câu phải chốt theo độ phức tạp của từng yêu cầu cần đạt. Với bài lý thuyết phù hợp, cần nhiều ví dụ khác nhau, nhóm câu luyện có hướng dẫn, nhóm tự làm và nhóm ôn độc lập. Lập chỉ tiêu có lý do cho từng môn; không ép Âm nhạc, Mĩ thuật hoặc Thể chất theo cùng số câu trắc nghiệm của Toán.

Mọi bài tập có đáp án/điều kiện nghiệm, lời giải, cách kiểm tra và phản hồi sai cụ thể. Kiểm tra bài thiếu dữ kiện, nhiều đáp án, sai đơn vị, mâu thuẫn hình–đề, đáp án lộ sẵn hoặc dùng kiến thức chưa dạy. Không dùng nội dung cùng khuôn để lấp đủ chương.

Biên soạn nguyên bản dựa trên kiến thức và yêu cầu cần đạt. Lưu danh mục sách tham khảo với tác giả, năm/ấn bản, chương/trang đã đối chiếu và quyền sử dụng. Chỉ phân phối văn bản, đề, ảnh, âm thanh khi có quyền phù hợp; tài liệu chưa có quyền thì dẫn nguồn đọc chính thức. Quyền đọc miễn phí không tự cấp quyền chép toàn bộ sách.

Giữ cổng xuất bản thật xuyên catalog, search, lesson player, luyện tập, đề thi, offline và API. Bản nháp/generated không lọt vào luồng công bố dưới nhãn đã duyệt. Không tự đổi `checked` thành `approved`, bịa người duyệt hoặc coi test kỹ thuật là thẩm định chuyên môn. Tách nội dung đã kiểm chứng và nội dung cần chuyên gia kiểm tra; phần chưa đạt không được tính hoàn thành.

## 4. Dạy và đánh giá đúng đặc trưng từng môn

- **Toán:** thao tác trực quan cho tiểu học; số học, đại số, hình học, xác suất/thống kê đúng lớp; công thức rõ, đồ thị/suy luận/chứng minh phù hợp. Chấm được số tương đương, phân số, biểu thức trong miền xác định, sai số và đơn vị khi cần; không coi vài phép thế số là chứng minh tương đương tổng quát.
- **Tiếng Việt/Ngữ văn:** học âm–vần–đọc–viết đúng giai đoạn, chính tả, ngữ pháp, đọc hiểu, nghị luận và phân tích; hướng dẫn lập ý, dàn bài, viết rồi sửa. Giữ dấu tiếng Việt khi dấu là đối tượng đánh giá. Tự luận có rubric, minh chứng, nhiều cách diễn đạt hợp lệ; không chấm hiểu văn bằng một keyword hoặc buộc học thuộc bài mẫu.
- **Ngoại ngữ phổ thông:** từ vựng, ngữ pháp, nghe, nói, đọc, viết theo lớp; audio/transcript và hoạt động không dùng mic vẫn có. Phân biệt phản hồi phát âm tham khảo với đánh giá chuyên gia.
- **Khoa học/Tự nhiên–Xã hội/KHTN/Lý–Hóa–Sinh:** thí nghiệm/mô phỏng đúng chủ đề, quan sát, dự đoán, biến số, dữ liệu và giải thích; ghi giới hạn mô hình. Không dùng một nút Start/Change cho mọi bài. Thực hành có chỉ dẫn an toàn phù hợp tuổi, ưu tiên mô phỏng khi cần.
- **Lịch sử/Địa lí:** tư liệu, mốc thời gian, bản đồ, biểu đồ, đối chiếu bằng chứng và nguyên nhân–hệ quả; ghi thời điểm của địa giới/số liệu, không trộn bản đồ các giai đoạn.
- **Đạo đức/GDCD/Kinh tế–Pháp luật:** tình huống có căn cứ và nhiều phương án cần giải thích; dữ kiện pháp luật phải được kiểm tra theo thời điểm. Không áp đáp án một câu cho mọi quyết định.
- **Tin học/Công nghệ:** thao tác, thuật toán, thiết kế và dự án đúng lớp; code sandbox giới hạn tài nguyên, tách worker, không cho mã bài học truy cập token/DOM/tài khoản.
- **Âm nhạc/Mĩ thuật/Thể chất/Trải nghiệm/Hướng nghiệp/Địa phương:** hoạt động thực hành, sản phẩm, portfolio, tiêu chí quan sát và tự nhận xét; phân biệt tự khai, minh chứng và giáo viên xác nhận. Không tự khẳng định đã đo thể lực/kỹ năng thực hành khi chỉ có thao tác trên web.

## 5. Hoàn thiện hành trình học như một năm học có tổ chức

Luồng bắt buộc: **chọn hồ sơ/lớp/môn/mục tiêu → kiểm tra nền tảng → học bù → kế hoạch tuần/học kỳ → học bài → luyện tập → chữa sai → ôn cách quãng → kiểm tra → phân tích → điều chỉnh kế hoạch**.

Có chế độ Học từ đầu, Học theo trường, Ôn kiến thức cũ, Học nâng cao và Ôn thi. Người học biết hôm nay làm gì, vì sao được gợi ý, thời lượng dự kiến và bước tiếp theo. Cho thay lịch, học chậm/nhanh, nghỉ rồi quay lại đúng chỗ; không khóa đọc toàn bộ chương trình chỉ vì placement thấp.

Phân biệt **đã xem, đã làm hoạt động, đã kiểm tra, đang ôn, đã có bằng chứng thành thạo**. Next chỉ là điều hướng. Mastery dựa trên đáp án độc lập, dạng bài khác nhau và lần ôn sau; có thể giảm khi quên. Lịch ôn, sổ lỗi, ghi chú, flashcard và bài học bù cùng dùng kỹ năng/outcome thật. Mục tiêu thời gian là ước tính và cần hiệu chỉnh qua playtest học tập, không lấy thời gian solver làm thời gian học.

Thiết kế retrieval practice, ôn giãn cách, xen ví dụ đã giải với tự làm và câu hỏi giải thích; công bố đó là lựa chọn sư phạm, không hứa bảo đảm ghi nhớ hoặc tăng điểm cho mọi người.

## 6. Xây hệ thống kiểm tra và ôn thi thực chất

Hỗ trợ kiểm tra sau bài/chương, giữa kỳ/cuối kỳ, ôn cuối cấp, tuyển sinh lớp 10 theo địa phương/năm, tốt nghiệp THPT theo năm và bồi dưỡng nâng cao khi có blueprint/nguồn tương ứng. Không mặc định mọi môn, lớp hay kỳ thi có cùng cấu trúc.

Mỗi exam spec ghi môn, lớp, năm/địa phương, phạm vi, nguồn, thời gian, dạng câu, phân bố nội dung–mức độ và quy tắc chấm. Đề chính thức đã được phép dùng, đề mô phỏng và đề tự biên soạn phải phân biệt rõ. Chưa có thông tin năm tới thì nói chưa công bố; không bịa “đề Bộ mới nhất”.

Tách chế độ Luyện đề có trợ giúp và Thi thử. Phiên thi đóng băng đề, thứ tự, phiên bản câu và rubric khi bắt đầu; có đọc hướng dẫn, đồng hồ, đánh dấu xem lại, tự lưu, khôi phục khi reload/mất mạng, xác nhận nộp, nộp hết giờ, kết quả và chữa đề. Quy định rõ pause; không để đổi tab/reload làm lùi thời gian hoặc sửa bài sau khi nộp.

Mã đề tương đương phải theo ma trận, khác bài thực chất, loại trùng cùng họ và giữ tổ hợp câu dùng chung ngữ liệu. Thay số chỉ là biến thể của một họ, không tính thành câu độc lập. Câu luyện và đề kiểm tra năng lực cần tách để tránh nhớ đáp án được tính thành thành thạo.

Chấm chính xác các dạng xác định; hỗ trợ chấm từng phần khi phù hợp. Tự luận/sản phẩm có rubric và trạng thái tự đối chiếu, phản hồi tự động hoặc giáo viên nhận xét đúng thực tế. AI nếu có chỉ là trợ giúp đã công bố giới hạn; thiếu AI vẫn học và luyện được. Báo cáo lỗi theo kỹ năng, thời gian, mức tự tin và gợi ý học bù; không suy diễn điểm thi thật hay thứ hạng chưa có dữ liệu.

Nếu bài giao cần giấu đáp án và giáo viên chấm, kiểm soát ở server, không chỉ ẩn bằng CSS hoặc gửi đáp án xuống client rồi gọi đó là bảo mật thi. Không tuyên bố chống gian lận tuyệt đối trên web.

## 7. Hoàn thiện toàn bộ chức năng trong mục lớn

Rà từng trang Hôm nay, Lộ trình, Môn học, Lesson Player, Luyện tập, Kiểm tra, Thư viện, Tiến độ, Teacher/Family/Admin và mọi nút/chế độ/filter/export. Ghi rõ nút nào đã làm việc thật, cần kết nối backend hoặc thiếu triển khai; sửa đầy đủ loading, empty, error, retry, pending và permission.

Nối vòng giao bài → học/làm → lưu nháp → nộp → chấm/nhận xét → sửa → báo cáo. Tái sử dụng backend `/api/education`, quyền giáo viên/phụ huynh/học sinh và hệ lớp có sẵn của HH School. Người tự học không phải có mã mời, giáo viên hoặc API key mới dùng được giáo trình. Kiểm tra phân quyền ở server và dữ liệu thực giữa các vai trò.

Các chức năng lịch học, ghi chú, tài liệu, báo cáo và hỗ trợ học tập được hoàn thiện trong HH School theo nhu cầu của bài học. Mọi thay đổi dùng chung ở router, loader, auth hoặc storage phải giới hạn ở phần cần thiết cho HH School và có kiểm tra tránh hồi quy sang các mục khác.

## 8. Giao diện, tài nguyên và lưu tiến trình nhiều năm

Thiết kế sáng sủa, dễ đọc, ít phân tán, hợp lứa tuổi. Bài giảng ưu tiên vùng đọc và thao tác; công thức/bảng/bản đồ/âm thanh có cách tiếp cận phù hợp. Tên lớp–môn–chương–bài rõ, tìm kiếm tiếng Việt, bookmark và quay lại bài đang học thực sự hoạt động.

Kiểm tra full shell/theme/sidebar ở 375px, 768px, 1440px, zoom 200%, bàn phím/IME, reduced motion và contrast. Nút chạm tối thiểu 44px; không ép mọi môn vào một layout hoặc lab giống nhau. Không bắt bật âm thanh/mic để học phần cốt lõi.

Dữ liệu chương trình/bài tập tách renderer, chia pack lớp–môn/chương và version/checksum, tải theo nhu cầu. Search worker và cache chỉ nhận nội dung đủ điều kiện công bố. Có loading/retry và rollback pack lỗi mà không mất bài làm.

Tiến trình lưu theo tài khoản và hồ sơ người học; đánh giá lại trần 1.000 progress/mastery/attempt, 500 lỗi hiện có. Thiết kế IndexedDB/server phân mảnh, aggregate nhỏ và chính sách archive rõ; không cắt dữ liệu hợp lệ chỉ vì normalize hay nâng phiên bản. Lưu ID/phiên bản/đáp án/ghi chú/thời gian cần thiết, không nhân cả giáo trình vào mỗi save.

Kiểm tra offline queue, quota, corrupt/future schema, migration gián đoạn, đồng bộ lặp, conflict409, nhiều tab và đổi tài khoản. Phân biệt đã lưu trên thiết bị/chờ đồng bộ/đã đồng bộ/xung đột. Có backup/import/export có phiên bản. Chỉ công bố đồng bộ đa thiết bị khi đã thử với backend thật.

## 9. Kiểm thử, nghiệm thu và phát hành

Lập hai bảng kiểm: **nội dung theo ma trận outcome** và **chức năng theo route/luồng người dùng**. Bản ghi công khai phải có nội dung, nguồn, lời giải/rubric, prerequisite và bài kiểm tra phù hợp; không có ID treo, liên kết sai lớp, chương rỗng hoặc số liệu tiến độ bịa.

Chạy `npm run test:learning`, kiểm thử tích hợp và release tests phù hợp. Thêm test hành vi: chấm đúng/sai/tương đương, giữ dấu chính tả, câu mơ hồ, nhiều lời giải, rubric, đề đóng băng, timer sau reload, nộp idempotent, chấm từng phần, không sửa sau nộp, learner/account isolation và quyền server. Có test âm tính chứng minh bấm Next/keyword/đổi seed không tạo thành thạo giả hoặc độ phủ giả.

Kiểm tra trình duyệt mọi cặp lớp–môn hợp lệ; chạy xuyên chương và mô hình hoạt động. Thử người mới ở tiểu học, THCS, THPT; người mất gốc quay về tiên quyết; người nâng cao; học sinh thi thử rồi chữa sai; giáo viên giao/chấm; phụ huynh xem đúng quyền; mất mạng rồi đồng bộ lại. Tự động hóa kiểm tra toàn bộ pack, kiểm tra biên tập chuyên môn và playtest cần có bằng chứng riêng.

Chụp/mở xem ảnh runtime của các khối lớp, nhóm môn, bài thực hành, bài viết, đề thi, màn chữa bài và mobile. Chỉnh lại phần khó đọc/khó thao tác. Đo tải tới bài học dùng được, dung lượng pack, tìm kiếm và độ bền lưu; không lấy ảnh đẹp hay test schema làm chứng cứ dạy học tốt.

Làm theo đợt môn–khối, mỗi đợt có nội dung, chức năng, kiểm thử và bảng trạng thái. Tiếp tục các phần đã xác định; không dừng sau dashboard hoặc vài bài mẫu rồi báo “toàn bộ đã hoàn thiện”. Nếu còn thiếu nguồn, quyền hoặc kiểm chứng chuyên môn, liệt kê chính xác phần thiếu, không giảm mẫu số hay bịa phê duyệt.

Sau khi các thay đổi được kiểm tra và đủ điều kiện phát hành: rà diff, cập nhật loader/manifest/Service Worker đúng release, commit/push nhánh hiện tại không force-push; kiểm tra CI/deployment và tài nguyên thật. Báo commit/link, ma trận độ phủ theo lớp/môn, nội dung mới, chức năng đã sửa, bằng chứng QA và những giới hạn còn lại. Bằng chứng kỹ thuật không thay thế đánh giá chất lượng học thuật hoặc kết quả học tập dài hạn.

**Bắt đầu từ audit nội dung thật và ma trận chương trình; hoàn thiện cả kiến thức lẫn hành trình học–luyện–thi–chữa sai.**

---

Nguồn khởi đầu để tra cứu lại khi triển khai:

- [Chương trình GDPT – Thông tư 32/2018 và lịch sử hiệu lực](https://vbpl.moj.gov.vn/bogiaoducdaotao/Pages/vbpq-toanvan.aspx?ItemID=146721).
- [Thông tư 17/2025 sửa đổi chương trình](https://vanban.chinhphu.vn/?pageid=27160&docid=215347).
- [NXBGDVN: sách năm học 2026–2027 và các bản cập nhật](https://nxbgd.vn/bai-viet/nha-xuat-ban-giao-duc-viet-nam-thong-bao-ve-viec-su-dung-sach-giao-khoa-nam-hoc-2026-2027).
- [Sách điện tử Hành trang số](https://hanhtrangso.nxbgd.vn/sach-dien-tu) và [danh mục sách tham khảo của NXBGDVN](https://nxbgd.vn/chuyen-muc/sach-tham-khao).
- [Quy chế thi THPT – Thông tư 24/2024](https://vanban.chinhphu.vn/?pageid=27160&docid=212206) và [Thông tư 13/2026 sửa đổi](https://vanban.chinhphu.vn/?pageid=27160&docid=217189); tìm văn bản hợp nhất/cập nhật mới hơn cho đúng năm thi.
- [IES/WWC: Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1).

Phạm vi nghiên cứu khi soạn prompt: đã đọc cấu trúc project và các trang chính thức nêu trên ở mức nguồn chương trình/quy chế/thông báo/hướng dẫn. Chưa kiểm chứng toàn bộ sách, chương trình từng môn hoặc từng quy định chấm thi. Trang Hành trang số cần JavaScript; không coi việc mở trang giới thiệu là đã đọc các sách bên trong. Những việc này thuộc audit nội dung bắt buộc của đợt triển khai.
