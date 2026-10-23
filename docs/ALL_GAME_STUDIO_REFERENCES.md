# All Game Arcade Studio — nguồn tham khảo, release 1061

Ngày đối chiếu: 23/10/2026. Mã luật, AI, bản đồ, Canvas và SVG của 50 game mới được viết trong repository này. Không nhúng iframe, không tải game hoặc tài sản của các nguồn bên dưới, không thêm dependency game engine. Những nguồn này cung cấp ý tưởng về cơ chế và cách tổ chức, không cung cấp nội dung để sao chép.

| Nguồn gốc | Đã khảo sát và áp dụng | Phạm vi truy cập / tái sử dụng |
|---|---|---|
| [Game24h: Chiến tuyến phòng thủ 5](https://game24h.vn/tinh-diem/chien-tuyen-phong-thu-5-c145g2284b16.html) | Phòng thủ theo đợt, ra quyết định giữa các đợt, phân biệt công trình và địch. Pháo Đài Lăng Kính có tuyến, tháp, thông số và hình ảnh riêng. | Đã đọc thông tin trong chỉ mục tìm kiếm; mở trực tiếp có lần timeout. Không kiểm chứng toàn bộ gameplay trên trang. Không lấy mã, bản đồ hoặc hình ảnh. |
| [Game24h: Đặt bom IT 5](https://game24h.vn/2-nguoi-choi/dat-bom-it-5-c126g2340b75.html) | Đường thoát, phá vật cản, thời gian nổ và phản ứng dây chuyền. Đấu Trường Bom dùng bàn 13×9, luật và bot riêng. | Giới hạn truy cập như trên; không lấy tài sản. `game24h.com` không phải nguồn nội dung dùng trong đợt này; nguồn phù hợp là `game24h.vn`. |
| [Y8: Takeover](https://www.y8.com/games/takeover) | Phân biệt khai thác, sản xuất, điều quân và mục tiêu căn cứ. RTS và chiếm trạm được triển khai thành hai hệ luật khác nhau. | Đã đọc trang giới thiệu/điều khiển; không nhúng bản game, lấy mã, tên nhân vật hoặc đồ họa. |
| [Y8: Jacksmith](https://www.y8.com/games/jacksmith) | Chất lượng từng bước chế tạo phải tác động thật tới chiến đấu. Lò Rèn Viễn Chinh tính nhiệt, độ dày, nứt, chất lượng, công/thủ/tốc độ. | Đã đọc trang giới thiệu. Thiết kế vật liệu, profile rèn và công thức chỉ số riêng. |
| [Y8: Stealth Silent Squid](https://www.y8.com/games/stealth_silent_squid) | Tương tác vật lý và môi trường phải ảnh hưởng quyết định chơi; mục tiêu/hướng dẫn cần xuất hiện rõ trước khi chơi. | Đã đọc trang giới thiệu. Không coi trang này là nguồn mã cho mô hình niệm lực hay AI lính gác. |
| [Athena Crisis README](https://github.com/nkzw-tech/athena-crisis), [LICENSE.md](https://github.com/nkzw-tech/athena-crisis/blob/main/LICENSE.md), [Apollo Action.tsx](https://github.com/nkzw-tech/athena-crisis/blob/main/apollo/Action.tsx) | Cách tách state/action, dữ liệu bản đồ, luật/AI và renderer. Các engine mới thuần dữ liệu, host sở hữu vòng lặp; không dùng React hoặc engine của dự án tham khảo. | Mã nguồn có giấy phép MIT, nhưng giấy phép này không mở toàn bộ art, âm nhạc, campaign và nội dung game. Không sao chép mã hoặc tài sản nên không phát sinh thông báo MIT từ nguồn này. |
| [LittleJSArcade README và license](https://github.com/KilledByAPixel/LittleJSArcade) | Vòng chơi ngắn, mô phỏng cập nhật theo thời gian, mô hình vật thể và điều khiển rõ. Dùng các hàm hình học/Canvas gốc của All Game. | Repository nêu MIT với ngoại lệ Twemoji theo CC BY 4.0. Không lấy mã, Twemoji, sprite hoặc âm thanh. |

Không có nghĩa vụ ghi công tài sản bên thứ ba mới phát sinh từ release này vì không phân phối lại mã hoặc tài sản của các nguồn tham khảo. Các thông báo bản quyền vốn có trong repository được giữ nguyên. Ký hiệu quân cờ và biểu tượng chữ trong giao diện được trình duyệt vẽ bằng font hệ thống; minh họa đại diện mới là SVG viết riêng, không dùng bộ Twemoji.

## Kết quả chuyển hóa

- Mục tiêu, điều khiển, tài nguyên và điều kiện kết thúc thuộc từng engine; giao diện chung đọc dữ liệu thật qua `describe()`.
- Địch, đồng minh, nguy hiểm và mục tiêu dùng cả hình dạng/nhãn lẫn màu. Đồ họa gồm mô hình chiến trường, máy móc, biển sâu, rừng, đền và không gian.
- State có seed và được sao chép trước mỗi action. Các bộ test kiểm tra luật độc lập với renderer, sau đó kiểm tra nút và input trong Chromium.
- Không gọi AI, nền tảng game hoặc dịch vụ trả phí bên ngoài. AI đối thủ chạy cục bộ; không tuyên bố sức chơi tương đương engine thi đấu chuyên dụng.

Danh sách, cơ chế và kết quả kiểm tra: [ALL_GAME_STUDIO_UPGRADE.md](ALL_GAME_STUDIO_UPGRADE.md).
