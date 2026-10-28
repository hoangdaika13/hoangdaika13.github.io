# HH School University — kiểm kê nguồn 28/10/2026

Bản 1068 chỉ nhập metadata thư mục công khai và lưu liên kết. Không nhập toàn văn giáo trình, hình, video, bài thi, notebook hoặc mã nguồn bên ngoài. Nội dung sáu chuỗi học được biên soạn nguyên bản bằng tiếng Việt và đang chờ thẩm định.

## Phạm vi xác minh

- UIT: đọc hai bảng chương trình, giữ mã/tên/tín chỉ hiển thị; chống trùng mã theo từng chương trình. 85 mã ngành Kỹ thuật Phần mềm khóa 2025 và 91 mã ngành Khoa học Dữ liệu khóa 2024. Chưa nhập toàn bộ quy tắc tốt nghiệp, phân kỳ, loại bắt buộc/tự chọn hoặc chuẩn đầu ra.
- MIT OCW, CS50, Data 8 và Full Stack Open: đối chiếu trang khóa học/đề cương và điều kiện nguồn; không nhận là toàn bộ nội dung các khóa học này. Mỗi chuỗi HH ghi rõ các chủ đề còn thiếu.
- Open Textbook Library: dùng API đọc thư mục công khai, tìm ba đầu sách cho mỗi nhóm ngành và chống trùng ID; còn 47 sách duy nhất trên 16 nhóm. Chỉ nhập tiêu đề, tác giả, metadata giấy phép và URL, không sao chép mô tả/review hoặc nội dung sách. Lựa chọn đầu sách chưa được giảng viên thẩm định về mức phù hợp. [API chính thức](https://open.umn.edu/opentextbooks/api-docs/index.html).
- SoICT/HUST và UEH hiện chỉ có liên kết cổng; chưa nhập chương trình/khóa riêng. Open Yale, TU Delft và OpenStax là điểm truy cập nguồn; chưa đọc và nhập toàn bộ môn trên các hệ thống đó.
- GitHub: kiểm tra liên hệ từ trang môn/trường được lưu ở verificationUrl, đọc metadata repo/commit/license và ghim SHA. Không thực thi lệnh trong README hoặc tải/chạy mã repo. Bài làm sinh viên không được trộn thành nguồn chính thức.

## Chương trình gốc

- [Kỹ thuật Phần mềm — 2025](https://daa.uit.edu.vn/content/cu-nhan-nganh-ky-thuat-phan-mem-ap-dung-tu-khoa-20-2025): 85 mã môn; phiên bản Khóa 20 — 2025.
- [Khoa học Dữ liệu — 2024](https://daa.uit.edu.vn/content/cu-nhan-khoa-hoc-nganh-khoa-hoc-du-lieu-ap-dung-tu-khoa-19-2024): 91 mã môn; phiên bản Khóa 19 — 2024.

## GitHub được ghim

| Repo | Branch / file | Commit SHA | Khai báo API | Đối chiếu từ khóa học |
|---|---|---|---|---|
| [mitmath/1806](https://github.com/mitmath/1806) | master / README.md | `469ddbc94b68bbe7a121b503605c6683b94dabcc` | NOASSERTION | [Nguồn xác nhận](https://web.mit.edu/18.06/www/) |
| [cs50/python-cs50](https://github.com/cs50/python-cs50) | main / README.md | `c9f86eff2ba951768957d5289b35716deb4a0c43` | GPL-3.0 | [Nguồn xác nhận](https://cs50.harvard.edu/x/) |
| [data-8/textbook](https://github.com/data-8/textbook) | main / README.md | `41a47b89e03bf8edd1bed013b1ab225220212823` | NOASSERTION | [Nguồn xác nhận](https://data8.org/) |
| [data-8/materials-fa26](https://github.com/data-8/materials-fa26) | main / README.md | `12ba662cbffd10b46692267307e2211e2a6f96d9` | NOASSERTION | [Nguồn xác nhận](https://data8.org/) |
| [fullstack-hy2020/fullstack-hy2020.github.io](https://github.com/fullstack-hy2020/fullstack-hy2020.github.io) | source / README.md | `9c24482abcf387699d0f36bcdff5811dbe2ce5a7` | NOASSERTION | [Nguồn xác nhận](https://fullstackopen.com/en/part0/general_info/) |

`NOASSERTION` nghĩa là API chưa xác định giấy phép, không phải quyền tái sử dụng. GPL-3.0 của thư viện CS50 không tự áp dụng cho bài giảng hoặc tài sản khác. Sách Data 8 công bố CC BY-NC-ND 4.0; Full Stack Open công bố điều kiện văn bản và mã nguồn riêng. OpenStax cần đối chiếu điều kiện CC BY-NC-SA cùng ấn bản và tài sản cụ thể. Bản phát hành này giữ tất cả nguồn ngoài ở chế độ chỉ liên kết.

## Danh mục tài liệu và phạm vi quyền

| Tài liệu | Đơn vị | Loại | Khai báo quyền tại nguồn | Phạm vi tích hợp |
|---|---|---|---|---|
| [MIT 18.06 — Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/pages/syllabus/) | MIT | course-source | CC BY-NC-SA 4.0 | link-only |
| [MIT 14.01 — Principles of Microeconomics](https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2023/pages/syllabus/) | MIT | course-source | CC BY-NC-SA 4.0 | link-only |
| [MIT 6.002 — Circuits and Electronics](https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/) | MIT | course-source | CC BY-NC-SA 4.0 | link-only |
| [CS50 — Introduction to Computer Science](https://cs50.harvard.edu/x/syllabus/) | Harvard | course-source | CC BY-NC-SA 4.0 | link-only |
| [Data 8 — Foundations of Data Science](https://data8.org/) | UC Berkeley | course-source | Sách: CC BY-NC-ND 4.0; từng repo có điều kiện riêng | link-only |
| [Full Stack Open](https://fullstackopen.com/en/part0/general_info/) | University of Helsinki | course-source | Tài liệu: CC BY-NC-SA 3.0; kiểm tra từng file | link-only |
| [Citing sources](https://libguides.mit.edu/citing) | MIT Libraries | course-source | Chưa xác minh quyền tái phân phối | link-only |
| [Open Textbook Library](https://open.umn.edu/opentextbooks) | Open Education Network | course-source | Từng sách có giấy phép riêng | link-only |
| [TU Delft OpenCourseWare](https://ocw.tudelft.nl/) | TU Delft | course-source | Kiểm tra từng học liệu | link-only |
| [Open Yale Courses](https://oyc.yale.edu/) | Yale | course-source | Kiểm tra từng học liệu | link-only |
| [Chương trình và đào tạo SoICT](https://soict.hust.edu.vn/) | HUST / SoICT | course-source | Chưa xác minh quyền tái phân phối | link-only |
| [Cổng đào tạo UEH](https://daotao.ueh.edu.vn/) | UEH | course-source | Chưa xác minh quyền tái phân phối | link-only |
| [OpenStax — sách đại học](https://openstax.org/subjects) | Rice University / OpenStax | course-source | CC BY-NC-SA; kiểm tra ấn bản và tài sản | link-only |
| [mitmath/1806](https://github.com/mitmath/1806) | mitmath | github | NOASSERTION | link-only |
| [cs50/python-cs50](https://github.com/cs50/python-cs50) | cs50 | github | GPL-3.0 | link-only |
| [data-8/textbook](https://github.com/data-8/textbook) | data-8 | github | NOASSERTION | link-only |
| [data-8/materials-fa26](https://github.com/data-8/materials-fa26) | data-8 | github | NOASSERTION | link-only |
| [fullstack-hy2020/fullstack-hy2020.github.io](https://github.com/fullstack-hy2020/fullstack-hy2020.github.io) | fullstack-hy2020 | github | NOASSERTION | link-only |
| [A First Course in Linear Algebra](https://open.umn.edu/opentextbooks/textbooks/a-first-course-in-linear-algebra) | Open Textbook Library / Open Education Network | textbook | Free Documentation License (GNU) | link-only |
| [Book of Proof](https://open.umn.edu/opentextbooks/textbooks/book-of-proof) | Open Textbook Library / Open Education Network | textbook | Attribution-NoDerivs | link-only |
| [Calculus](https://open.umn.edu/opentextbooks/textbooks/calculus) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Introductory Chemistry](https://open.umn.edu/opentextbooks/textbooks/introductory-chemistry) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [The Basics of General, Organic, and Biological Chemistry](https://open.umn.edu/opentextbooks/textbooks/the-basics-of-general-organic-and-biological-chemistry) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Light and Matter](https://open.umn.edu/opentextbooks/textbooks/light-and-matter) | Open Textbook Library / Open Education Network | textbook | Attribution-ShareAlike | link-only |
| [College Success](https://open.umn.edu/opentextbooks/textbooks/college-success) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Writing for Success](https://open.umn.edu/opentextbooks/textbooks/writing-for-success) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Six Steps To Job Search Success](https://open.umn.edu/opentextbooks/textbooks/six-steps-to-job-search-success) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Electromagnetics](https://open.umn.edu/opentextbooks/textbooks/electromagnetics-vol-1) | Open Textbook Library / Open Education Network | textbook | Attribution-ShareAlike | link-only |
| [Electromagnetics](https://open.umn.edu/opentextbooks/textbooks/electromagnetics-vol-2) | Open Textbook Library / Open Education Network | textbook | Attribution-ShareAlike | link-only |
| [Microwave and RF Design: Amplifiers and Oscillators](https://open.umn.edu/opentextbooks/textbooks/microwave-and-rf-design-amplifiers-and-oscillators) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial | link-only |
| [Basics of Fluid Mechanics](https://open.umn.edu/opentextbooks/textbooks/basics-of-fluid-mechanics) | Open Textbook Library / Open Education Network | textbook | Free Documentation License (GNU) | link-only |
| [Fundamentals of Compressible Flow Mechanics](https://open.umn.edu/opentextbooks/textbooks/fundamentals-of-compressible-flow-mechanics) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Manufacturing Processes](https://open.umn.edu/opentextbooks/textbooks/manufacturing-processes-4-5) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Information Systems - A Manager's Guide to Harnessing Technology](https://open.umn.edu/opentextbooks/textbooks/information-systems-a-manager-s-guide-to-harnessing-technology) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Programming Languages: Application and Interpretation](https://open.umn.edu/opentextbooks/textbooks/programming-languages-application-and-interpretation) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Think Python: How to Think Like a Computer Scientist](https://open.umn.edu/opentextbooks/textbooks/think-python-how-to-think-like-a-computer-scientist) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial | link-only |
| [Building Maintenance & Construction: Tools and Maintenance Tasks](https://open.umn.edu/opentextbooks/textbooks/building-maintenance-construction-tools-and-maintenance-tasks) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Fundamentals of Infrastructure Management](https://open.umn.edu/opentextbooks/textbooks/fundamentals-of-infrastructure-management) | Open Textbook Library / Open Education Network | textbook | Attribution-ShareAlike | link-only |
| [The Legal and Ethical Environment of Business](https://open.umn.edu/opentextbooks/textbooks/the-legal-and-ethical-environment-of-business) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Introduction to Criminal Law](https://open.umn.edu/opentextbooks/textbooks/criminal-law) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Introduction to Basic Legal Citation](https://open.umn.edu/opentextbooks/textbooks/introduction-to-basic-legal-citation) | Open Textbook Library / Open Education Network | textbook | Attribution-ShareAlike | link-only |
| [Intermediate Financial Accounting](https://open.umn.edu/opentextbooks/textbooks/intermediate-financial-accounting-volume-2) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Communication for Business Success](https://open.umn.edu/opentextbooks/textbooks/business-communication-for-success) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [eMarketing: The Essential Guide to Marketing in a Digital World](https://open.umn.edu/opentextbooks/textbooks/emarketing-the-essential-guide-to-marketing-in-a-digital-world) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [International Trade: Theory and Policy](https://open.umn.edu/opentextbooks/textbooks/international-trade-theory-and-policy) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Microeconomics: Theory Through Applications](https://open.umn.edu/opentextbooks/textbooks/microeconomics-theory-through-applications) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Principles of Economics](https://open.umn.edu/opentextbooks/textbooks/principles-of-economics) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Nursing Care at the End of Life: What Every Clinician Should Know](https://open.umn.edu/opentextbooks/textbooks/nursing-care-at-the-end-of-life-what-every-clinician-should-know) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Creative Clinical Teaching In The Health Professions](https://open.umn.edu/opentextbooks/textbooks/creative-clinical-teaching-in-the-health-professions) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Clinical Procedures for Safer Patient Care](https://open.umn.edu/opentextbooks/textbooks/clinical-procedures-for-safer-patient-care) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Exploring Perspectives: A Concise Guide to Analysis](https://open.umn.edu/opentextbooks/textbooks/exploring-perspectives-a-concise-guide-to-analysis) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Educational Psychology](https://open.umn.edu/opentextbooks/textbooks/educational-psychology) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [The Information Literacy User's Guide: An Open, Online Textbook](https://open.umn.edu/opentextbooks/textbooks/the-information-literacy-user-s-guide-an-open-online-textbook) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Recorridos](https://open.umn.edu/opentextbooks/textbooks/recorridos) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Liberté](https://open.umn.edu/opentextbooks/textbooks/liberte) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Preadvanced Japanese](https://open.umn.edu/opentextbooks/textbooks/preadvanced-japanese) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial | link-only |
| [Genetics, Agriculture, and Biotechnology](https://open.umn.edu/opentextbooks/textbooks/genetics-agriculture-and-biotechnology-2021) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [The Art and Science of Teaching Agriculture: Four Keys to Dynamic Learning](https://open.umn.edu/opentextbooks/textbooks/the-art-and-science-of-teaching-agriculture-four-keys-to-dynamic-learning) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial | link-only |
| [Methods of Teaching Agriculture](https://open.umn.edu/opentextbooks/textbooks/methods-of-teaching-agriculture-third-edition) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial | link-only |
| [Theatrical Worlds](https://open.umn.edu/opentextbooks/textbooks/theatrical-worlds) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-NoDerivs | link-only |
| [Understanding Basic Music Theory](https://open.umn.edu/opentextbooks/textbooks/understanding-basic-music-theory-2013) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [Music and the Child](https://open.umn.edu/opentextbooks/textbooks/music-and-the-child) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Introduction to Tourism and Hospitality in BC](https://open.umn.edu/opentextbooks/textbooks/introduction-to-tourism-and-hospitality-in-bc) | Open Textbook Library / Open Education Network | textbook | Attribution | link-only |
| [The Marketing Map: Navigating the Principles of Marketing for Tourism, Hospitality, and Services](https://open.umn.edu/opentextbooks/textbooks/the-marketing-map-navigating-the-principles-of-marketing-for-tourism-hospitality-and-services) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |
| [Business Ethics and Social Responsibility](https://open.umn.edu/opentextbooks/textbooks/business-ethics-and-social-responsibility) | Open Textbook Library / Open Education Network | textbook | Attribution-NonCommercial-ShareAlike | link-only |

## Truy cập và cập nhật

Kiểm tra ngày 28/10/2026: 64/65 URL trả HTTP 200 qua công cụ HTTP; TU Delft trả lỗi fetch trong Node. Trang TU Delft đọc được qua công cụ web và thông báo đổi nền tảng cuối năm 2026, nhưng chưa xác nhận truy cập ổn định bằng pipeline. [FAQ của TU Delft](https://ocw.tudelft.nl/faq/). HTTP 200 chỉ chứng minh truy cập tại thời điểm kiểm tra, không chứng minh chất lượng nội dung hoặc quyền phân phối. [Audit từng URL](../../data/hh-school/university/link-audit.json).

Chạy `node scripts/import-hh-school-university.js --refresh` chỉ tạo sources.candidate.json (được gitignore). Biên tập viên so sánh metadata, chương trình, giấy phép và thay đổi nguồn trước khi thay sources.json. Chạy lại `node scripts/build-hh-school-university.js`, `node scripts/report-hh-school-university.js` và kiểm thử để tạo pack/manifest SHA-256 và ma trận. Build từ bản pin hiện tại không gọi mạng và cho kết quả byte giống nhau.

sources.json lưu bản pin, ngày kiểm tra và thông tin GitHub; catalogue.json bổ sung edition, checkScope và trạng thái linkCheck. Phần nào nguồn không cung cấp hoặc chưa kiểm chứng sẽ giữ chưa xác định. Mọi học liệu ngoài vẫn cần rà quyền riêng trước khi quyết định nhập toàn văn hoặc chuyển thể trong tương lai.
