# HH University — mở rộng ảnh trường thật, bản 1082

Đối chiếu ngày 04/11/2026. Bộ ảnh hiện gắn đúng **57 hồ sơ trường/cơ sở**, gồm **45 đại học/học viện và 12 cao đẳng** trong danh mục 959 hồ sơ. Bổ sung 27 hồ sơ so với bản 1081, trong đó có 11 cao đẳng. Đây là phạm vi ảnh đã xác minh, không phải xác nhận mọi hồ sơ trong danh mục đều đang hoạt động.

Có **170 WebP cục bộ, 12.973.012 byte**. 80 biến thể mới bổ sung cho 27 ảnh; ảnh nguồn nhỏ chỉ có hai kích thước, không phóng lớn để tạo thêm biến thể. 30 ảnh và toàn bộ 90 WebP của bản 1081 giữ nguyên byte/checksum. Danh sách cơ sở và ảnh nguồn được tuyển chọn riêng; builder chỉ tải các mục đã được duyệt.

Mỗi ảnh có nguồn Wikimedia Commons, tác giả, giấy phép, thời điểm nguồn ghi, liên kết trường, bằng chứng nhận diện, SHA-1/SHA-256 ảnh gốc và SHA-256 từng WebP tại [manifest](../../assets/university/campus-photos-v1.json). Tác giả/giấy phép và việc thu nhỏ/chuyển WebP vẫn xuất hiện trong thẻ và hồ sơ trường. Cả ảnh CC BY-SA đã đổi định dạng vẫn chịu giấy phép tương ứng.

## Đối chiếu và lựa chọn

Đã đọc metadata nguồn của toàn bộ 28 lựa chọn mới ban đầu và kiểm tra các trang trường/cơ quan chính thức. Ví dụ: [Cao đẳng Công thương Hà Nội](https://www.hcit.edu.vn/gioi-thieu-ve-truong), [Cao đẳng Lý Tự Trọng TP.HCM](https://lttc.edu.vn/), [Cao đẳng Điện lực miền Trung](https://cdmt.vn/index.aspx), [Cao đẳng Thương mại trên danh bạ Bộ Công Thương](https://moit.gov.vn/don-vi-su-nghiep/khoi-truong/truong-cao-dang-thuong-mai), [lịch sử Cao đẳng Thái Nguyên](https://www.tnc.edu.vn/gioi-thieu/lich-su.3205). Liên kết nguồn là thông tin để tiếp tục đối chiếu, không phải bảo đảm mọi nguồn ngoài luôn truy cập được.

Một ảnh Khoa học Tự nhiên có nguồn tác giả chưa rõ đã được thay bằng [ảnh sân trường có tác giả trungydang và CC BY 3.0](https://commons.wikimedia.org/wiki/File:San_truong_Dh_Khoa_Hoc_Tu_Nhien.q5-hcmvn_-dyt_-_panoramio.jpg). Ảnh KHXH&NV được đổi từ khu ăn uống sang mặt tiền có tên trường rõ. Loại phối cảnh kiến trúc Cao đẳng Viễn Đông khỏi bộ ảnh thật sau khi kiểm tra hình ảnh; không dùng bản dựng làm ảnh thực tế.

Ảnh và địa danh giữ theo thời điểm nguồn. Hồ sơ Cao đẳng Kinh tế – Tài chính Thái Nguyên có ghi chú tên cũ và trường kế thừa; không gộp ID, đổi điểm chuẩn hoặc tự xác nhận tên hiện tại từ một ảnh cũ. Ngày chụp được lưu nguyên thông tin nguồn, không suy ra từ tên file.

## Giữ tài sản đã phát hành và kiểm chứng

[Baseline 1081](campus-photo-baseline-1081.json) ghim 30 mã ảnh và 90 checksum. Builder kiểm tra các file đã có trước khi tái sử dụng; đổi ảnh nguồn đã phát hành cần phiên bản/tên tài sản mới. Test xác nhận 90 file cũ giữ nguyên, không có file ảnh mồ côi ngoài manifest.

- 6/6 kiểm thử `tests/hh-university-campus.test.js` đạt: gắn đúng ID, giấy phép/tác giả, toàn bộ 170 checksum và tỷ lệ, 90 file cũ, nguồn/fallback và bộ lọc lưu theo tài khoản.
- Pillow giải mã thực tế đủ 170 WebP và đối chiếu đúng kích thước khai báo.
- Đã xem contact sheet 27 ảnh mới và mở riêng ảnh mặt tiền KHXH&NV sau khi chọn lại.
- Syntax JS/Python và `git diff --check` cho phần ảnh đạt.
- Không có file WebP chưa được manifest khai báo. Năm file mới chưa phát hành đã được xóa khi đổi lựa chọn: hai biến thể Viễn Đông và ba biến thể KHXH&NV cũ; ba biến thể KHXH&NV sau đó được dựng lại từ ảnh mặt tiền mới. Không xóa hoặc thay byte bất cứ file 1081 nào.

Runtime vẫn dùng schema `HHUniversityCampus.VERSION=1`, ngày kiểm tra 2026-11-04; URL script phát hành cần `hh-university-campus.js?v=2`. Giữ nguyên API `catalog/find/url/picture/credit/hero` để các giao diện hiện có tiếp tục hoạt động.

Tái tạo: `python scripts/sync-hh-university-photos.py`. Đầu vào được duyệt tại [campus-photo-selections-v1.json](campus-photo-selections-v1.json). Script chỉ nhận HTTPS từ các host Commons được giới hạn, kiểm tra redirect/giới hạn byte/hash nguồn/giấy phép và tác giả, giữ ảnh PNG/JPEG gốc trong `.study-local/` ngoài Git. Production chỉ phục vụ WebP đã đóng gói.

## 27 hồ sơ mới

| Hồ sơ | Trường | Ảnh nguồn | Tác giả | Giấy phép |
| --- | --- | --- | --- | --- |
| vn-ts-94 | Trường Cao Đẳng Lý Tự Trọng TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:H%C3%ACnh_1,_c%E1%BB%95ng_tr%C6%B0%E1%BB%9Dng_Cao_%C4%90%E1%BA%B3ng_K%E1%BB%B9_Thu%E1%BA%ADt_L%C3%BD_T%E1%BB%B1_Tr%E1%BB%8Dng_TP._H%E1%BB%93_Ch%C3%AD_Minh.JPG) | Khoakinhteltt | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-217 | Trường Cao Đẳng Điện Lực Miền Trung | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_%C4%90i%E1%BB%87n_l%E1%BB%B1c_mi%E1%BB%81n_Trung,_H%E1%BB%99i_An,_Qu%E1%BA%A3ng_Nam.jpeg) | Linhcandng ( thảo luận ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-hocmai-884fb378b6eec1 | Cao Đẳng Công Nghệ Viettronics | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_C%C3%B4ng_ngh%E1%BB%87_Viettronics.JPG) | Kinh nghiệm - bán không ai mua, mua không ai bán ( thảo luận ) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| vn-ts-1528 | Trường Cao đẳng Công thương Hà Nội | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_C%C3%B4ng_th%C6%B0%C6%A1ng_H%C3%A0_N%E1%BB%99i,_V%C5%A9_Tr%E1%BB%8Dng_Ph%E1%BB%A5ng,_H%C3%A0_N%E1%BB%99i_001.JPG) | Phan Minh Tuấn | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-44 | Trường Cao Đẳng Cộng Đồng Hà Nội | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_C%E1%BB%99ng_%C4%91%E1%BB%93ng_H%C3%A0_N%E1%BB%99i,_Trung_K%C3%ADnh,_H%C3%A0_N%E1%BB%99i_001.JPG) | Phan Minh Tuấn | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-57 | Trường Cao Đẳng Dược Trung Ương | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_D%C6%B0%E1%BB%A3c_Trung_%C6%B0%C6%A1ng,_tr%C3%AAn_%C4%91%C6%B0%E1%BB%9Dng_Nguy%E1%BB%85n_L%C6%B0%C6%A1ng_B%E1%BA%B1ng,_th%C3%A0nh_ph%E1%BB%91_H%E1%BA%A3i_D%C6%B0%C6%A1ng,_t%E1%BB%89nh_H%E1%BA%A3i_D%C6%B0%C6%A1ng.jpg) | Nguoivietbao | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-1455 | Trường Cao đẳng Giao thông vận tải Trung ương V | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_Giao_th%C3%B4ng_V%E1%BA%ADn_t%E1%BA%A3i_Trung_%C6%B0%C6%A1ng_V.jpeg) | Linhcandng ( thảo luận ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-colleges-07c3e090551d2b | Trường Cao đẳng Thương mại Đà Nẵng | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_Th%C6%B0%C6%A1ng_m%E1%BA%A1i_%C4%90%C3%A0_N%E1%BA%B5ng.jpeg) | Linhcandng ( thảo luận ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-ts-1456 | Trường Cao đẳng Văn hóa – Nghệ thuật Đà Nẵng | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_V%C4%83n_h%C3%B3a_Ngh%E1%BB%87_thu%E1%BA%ADt,_%C4%90%C3%A0_N%E1%BA%B5ng.jpeg) | Linhcandng ( thảo luận ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-ts-515 | Trường Cao Đẳng Y Tế Hà Đông | [Commons](https://commons.wikimedia.org/wiki/File:Cdythadong.jpg) | Trường Cao đẳng Y tế Hà Đông | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-hocmai-07ce7e4ffc5ce2 | Cao Đẳng Kinh Tế – Tài Chính Thái Nguyên | [Commons](https://commons.wikimedia.org/wiki/File:C%E1%BB%95ng_tr%C6%B0%E1%BB%9Dng_Cao_%C4%91%E1%BA%B3ng_Kinh_t%E1%BA%BF_T%C3%A0i_ch%C3%ADnh_Th%C3%A1i_Nguy%C3%AAn.jpg) | vi:User:Hoàng Lương | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-ts-308 | Đại Học Công Nghiệp Hà Nội | [Commons](https://commons.wikimedia.org/wiki/File:Hanoi_University_of_Industry_11-02-2025.jpg) | Hainotdeptrai | [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| vn-moet-3584 | TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH | [Commons](https://commons.wikimedia.org/wiki/File:ToaNhaTrungTam.jpg) | Adoreplus | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-347 | Trường Đại Học Khoa Học Tự Nhiên TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:San_truong_Dh_Khoa_Hoc_Tu_Nhien.q5-hcmvn_-dyt_-_panoramio.jpg) | trungydang | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| vn-ts-349 | Trường Đại Học Khoa Học Xã Hội và Nhân Văn TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:VNU-HCM_university_of_social_sciences_and_humanities_2.jpg) | Syced | [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) |
| vn-ts-376 | Trường Đại Học Mở TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:Ho_Chi_Minh_City_Open_University.jpg) | Vano111ru | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-361 | Trường Đại Học Kiến Trúc TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:Truong_Dai_hoc_Kien_truc,_tp_hcmvn_-_panoramio.jpg) | trungydang | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| vn-ts-334 | Trường Đại Học Hoa Sen | [Commons](https://commons.wikimedia.org/wiki/File:H%C3%ACnh_%C4%91hhs3-.jpg) | NAnhNgọc111 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-322 | Trường Đại Học Quốc Tế Hồng Bàng | [Commons](https://commons.wikimedia.org/wiki/File:HIU_University.jpg) | Congnamphuong | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-310 | Trường Đại Học Công Nghiệp TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:University_of_Industry_School,_Ho_Chi_Minh_City.jpg) | Pham Thuy Ho | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-ts-369 | Trường Đại Học Luật TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_%C4%90%E1%BA%A1i_h%E1%BB%8Dc_Lu%E1%BA%ADt,B%E1%BA%BFn_V%C3%A2n_%C4%90%E1%BB%93n,_qu%E1%BA%ADn_4,_tp_Hcm_-_panoramio.jpg) | trungydang | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) |
| vn-ts-265 | Trường Đại học Kinh Tế Luật TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:To%C3%A0_nh%C3%A0_h%E1%BB%8Dc_t%E1%BA%ADp_B1_v%C3%A0_to%C3%A0_nh%C3%A0_th%C6%B0_vi%E1%BB%87n_B2_UEL.jpg) | Thkd0610 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-375 | Trường Đại Học Mỏ Địa Chất | [Commons](https://commons.wikimedia.org/wiki/File:Campus_universitaire.jpg) | Guerinf | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-360 | Trường Đại Học Kiến Trúc Hà Nội | [Commons](https://commons.wikimedia.org/wiki/File:%C4%90%E1%BA%A1i_h%E1%BB%8Dc_Ki%E1%BA%BFn_tr%C3%BAc_1_-_NKS.jpg) | NKSTTSSHNVN | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
| vn-ts-344 | Trường Đại Học Khoa Học Huế | [Commons](https://commons.wikimedia.org/wiki/File:%C4%90%E1%BA%A1i_h%E1%BB%8Dc_Khoa_h%E1%BB%8Dc_Hu%E1%BA%BF.jpg) | Lưu Ly ( thảo luận ) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |
| vn-ts-363 | Trường Đại học Công Nghệ TPHCM | [Commons](https://commons.wikimedia.org/wiki/File:Tvhutech1.jpg) | Hoakylan | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| vn-ts-353 | Trường Đại Học Kinh Tế – Đại Học Đà Nẵng | [Commons](https://commons.wikimedia.org/wiki/File:Tr%C6%B0%E1%BB%9Dng_%C4%90%E1%BA%A1i_h%E1%BB%8Dc_Kinh_t%E1%BA%BF_%C4%90%C3%A0_N%E1%BA%B5ng.jpeg) | Linhcandng ( thảo luận ) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
