# Prompt triển khai All Game: thêm 100 game đa thể loại, nâng chất lượng toàn thư viện

Hãy trực tiếp mở rộng All Game của website hoang8.com bằng **100 game mới có cơ chế khác biệt**, đồng thời nâng cấp chất lượng giao diện và trải nghiệm bên trong thư viện hiện có.

Baseline đã được đọc từ code khi soạn yêu cầu là **109 game**, release 1061, commit `6f457b0`. Mục tiêu tương ứng là **209 game hoàn chỉnh**. Khi triển khai, xác minh lại baseline thực tế; nếu repository đã có thêm game, bảo toàn chúng và thêm đủ 100 game chưa có, không ép danh mục quay về 209.

Đọc project, triển khai, kiểm thử, xem ảnh và sửa tiếp tới khi hoàn thành. Đây là yêu cầu triển khai thực tế, không dừng ở việc lập danh sách, dựng mockup hoặc tạo màn giới thiệu.

## 1. Kiểm tra kiến trúc và chống trùng trước khi viết game

- Đọc `AGENTS.md`, trạng thái Git và các hướng dẫn áp dụng. Giữ nguyên thay đổi ngoài phạm vi đang có của người dùng.
- Đọc `index.html`, phần All Game trong `script.js` và `performance-loader.js`, `sw.js`, `all-game.js`, các catalog, `all-game-scenes.js`, `all-game-studio-core.js`, `all-game-studio-art.js`, `all-game.css`, toàn bộ bundle luật liên quan, tài liệu và QA hiện có.
- Hiểu API `create/step/describe/draw`, quyền sở hữu RAF/timer, input, routing, pause/resume, account, checkpoint, record theo độ khó/phiên bản luật, tải bundle và cập nhật cache.
- Xuất baseline từ catalog và đối chiếu engine thực sự đăng ký. Giữ ID, route, yêu thích, kỷ lục và điểm tiếp tục của tất cả game cũ.
- Tạo bảng thiết kế 100 game gồm: ID, tên, nhóm/thẻ, input, vòng chơi chính, mục tiêu, tài nguyên, tiến triển, thắng/thua/hòa, game cũ gần nhất, game mới gần nhất và khác biệt cơ chế cụ thể với từng game gần nhất.
- Đọc luật của các game gần nhau để so sánh. Metadata khác chữ hoặc ID khác nhau không chứng minh đó là game khác.
- Không tính đổi tên, thay skin, thêm tốc độ, tăng kích thước bàn, thay câu hỏi, thêm người chơi hoặc thay đường đua đơn thuần là một game mới. Nếu một ý tưởng chỉ là chế độ của game đang có, đưa nó vào game đó và thay ứng viên bằng một cơ chế khác để vẫn đủ 100 game mới.

Danh sách bên dưới đã được đối chiếu ở mức catalog và định hướng thiết kế; vẫn phải kiểm tra engine khi triển khai. Có quyền thay ứng viên trùng bằng ý tưởng tốt hơn, cập nhật bảng lý do, giữ mức đa dạng và đủ số lượng.

## 2. Nghiên cứu nguồn và quyền sử dụng

Tham khảo cơ chế, hướng dẫn, phản hồi, cấu trúc vòng chơi và cách trình bày mục tiêu từ các trang nguồn trực tiếp sau. Các tên thương mại là tài liệu nghiên cứu; tên, nhân vật, bản đồ, giao diện và media của hoang8.com phải có thiết kế riêng.

- Y8 Sports: https://www.y8.com/categories/sports — phân biệt thể thao chơi cả trận với mini game chỉ sút/ném một lần.
- Y8 8 Ball Pool: https://www.y8.com/games/8_ball_pool_html5
- Y8 Swimming Pro: https://www.y8.com/games/swimming_pro
- Y8 Shop Empire: https://www.y8.com/games/shop_empire
- Y8 Goodgame Big Farm: https://www.y8.com/games/goodgame_big_farm
- Y8 Papa’s Freezeria: https://www.y8.com/games/papa_s_freezeria
- Y8 Fireboy and Watergirl: https://www.y8.com/games/fireboy_and_watergirl_forest_temple
- Y8 Friday Night Funkin: https://www.y8.com/games/friday_night_funkin
- Y8 DJ Mixer: https://www.y8.com/games/dj_mixer và tài liệu tính năng Mixxx: https://mixxx.org/features/ — tham khảo ý tưởng trộn nhạc, tempo, cue, EQ và crossfader; tự viết game/audio, không lấy mã, UI hoặc media của Mixxx.
- Y8 Solitaire Collection: https://www.y8.com/games/solitaire_collection_klondike_spider_freecell
- Y8 Uno Online: https://www.y8.com/games/uno_online
- Y8 Cut the Rope: https://www.y8.com/games/cut_the_rope
- Y8 Wheely 8: https://www.y8.com/games/wheely_8_aliens
- Game24h: https://game24h.vn/game-bai-c168.html và https://game24h.vn/phieu-luu-c110.html
- Game24h Thần tượng âm nhạc: https://game24h.vn/tinh-diem/than-tuong-am-nhac-c145g2623b16.html — chỉ xác nhận đây là quiz nhận diện ca sĩ; mô tả trang chưa đủ để khẳng định cơ chế audio cụ thể.

Đọc thêm README, LICENSE và mã liên quan của:

- https://github.com/boardgameio/boardgame.io — phase, turn order, move/state và giới hạn thông tin riêng của người chơi; nghiên cứu kiến trúc, không buộc thay host bằng boardgame.io.
- https://github.com/cwilso/metronome — clock và lập lịch Web Audio; không đo nhịp bằng số frame hoặc độ trễ `setTimeout` đơn thuần.
- https://github.com/liabru/matter-js — constraint, va chạm và vật lý; chỉ thêm dependency nếu có nhu cầu đo được, không nhập engine để đổi tên một demo.
- https://github.com/OpenTTD/OpenTTD — kinh tế và thời gian vận chuyển; chỉ tham khảo thiết kế trong scope này, không sao chép/port mã GPL vào project.
- https://github.com/ncase/trust — tutorial qua tương tác, payoff và bot có trí nhớ. Chú ý README có ngoại lệ giấy phép media; không coi mọi âm thanh là CC0.
- https://github.com/jakesgordon/javascript-pong — AI phản ứng có sai số và spin; All Game đã có Paddle Duel, vì vậy không tạo thêm bản Pong đổi hình.

Tái kiểm tra giấy phép tại thời điểm sử dụng. Mã nguồn, artwork, nhạc, font, bộ từ và nội dung cốt truyện có thể có giấy phép khác nhau. Nếu dùng mã permissive, ghi nguồn/file/commit, giữ notice và thực hiện điều kiện giấy phép. Không tự suy ra quyền media từ license code. Ưu tiên tự viết luật, dữ liệu, SVG/Canvas và âm thanh tổng hợp.

Một số trang Game24h có lúc timeout và một số game nguồn còn dùng Flash/desktop. Ghi rõ truy cập được gì; không nói đã chơi hay đã kiểm chứng mobile nếu chỉ đọc mô tả hoặc chỉ mục. Không nhúng iframe, tải bản game thương mại hoặc sao chép tài sản để đủ số lượng.

## 3. Danh sách 100 game đề xuất, chia 20 nhóm

Tên dưới đây là tên làm việc riêng cho hoang8.com. Giữ ID ổn định sau khi công bố. Mỗi dòng mô tả cơ chế bắt buộc, không phải chỉ gợi ý bối cảnh.

### A. Thể thao đồng đội và thi đấu trên sân

01. **Futsal Sắc Màu** (`futsal-match`) — Trận 3v3 hai hiệp với chuyền, chạy chỗ, đổi cầu thủ, tranh bóng, sút và thủ môn AI; kết quả theo bàn thắng, có xử lý hòa. Không chỉ dựng lại Penalty Kick.
02. **Bóng Rổ Phố Hội** (`street-hoops`) — Trận 2v2 có dẫn bóng, chuyền, cướp, rebound, chắn người và đồng hồ tấn công; quản lý sở hữu bóng, thắng theo điểm khi hết trận. Khác Basket Shot chỉ ném rổ.
03. **Quần Vợt Ánh Dương** (`court-tennis`) — Giao bóng, di chuyển người trên sân, đánh bổng/cắt/xoáy, tính trong–ngoài và lỗi giao; có game/set, rally và AI chọn vị trí. Không đổi skin thanh đỡ của Paddle Duel.
04. **Bóng Chuyền Bờ Biển** (`beach-volley`) — Đỡ–chuyền–đập và chắn trong đội hai người, tối đa ba chạm, có đổi quyền giao; thắng set theo luật công bố, không chỉ bật bóng qua lại.
05. **Bóng Chày Ba Hiệp** (`diamond-baseball`) — Ném/chọn kiểu bóng, đánh đúng vùng tiếp xúc, chạy và giữ gôn, phòng thủ chọn điểm ném; triển khai strike/ball/out và kết quả ba hiệp.

### B. Thể thao chính xác và kỹ năng ngoài trời

06. **Bowling Mười Lượt** (`tenpin-bowling`) — Điều góc, lực và xoáy bóng, va chạm nhiều pin; tính đúng mười frame, strike/spare và bóng thưởng; có mục tiêu điểm hoặc đấu AI.
07. **Bi-a Tám Bóng** (`eight-ball`) — Bi cái có điểm chạm, lực và spin, va chạm bi/băng/lỗ; phân nhóm bi, đổi lượt, phạm lỗi và bi số tám theo biến thể luật được ghi rõ.
08. **Curling Băng Lam** (`curling-end`) — Thả đá với lực/xoáy, quét băng có ngân sách để đổi trượt; chọn bảo vệ, draw hoặc takeout qua các end và chấm đá gần tâm đúng luật.
09. **Đường Bơi Vô Địch** (`swim-meet`) — Phối hợp nhịp quạt, nhịp thở, sức bền, xuất phát và quay đầu trong nhiều cự ly; chiến thuật phân phối sức và kết quả đua thật, không chỉ bấm nhịp để cộng điểm.
10. **Skatepark Liên Hoàn** (`skate-line`) — Ollie, xoay ván, grind có thăng bằng và tiếp đất đúng hướng; nối trick khác loại, mất combo khi ngã, hoàn thành tuyến nhiệm vụ. Không thay mô tô bằng ván trên cùng bộ điều khiển.

### C. Phương tiện và vận hành chuyên biệt

11. **Hải Trình Buồm Gió** (`sail-regatta`) — Chỉnh buồm theo hướng gió, tack, layline và vượt phao đúng thứ tự; chọn đường và tránh vùng mất gió để thắng chặng. Không chỉ thay xe drift bằng thuyền.
12. **Bến Đỗ Rơ-moóc** (`trailer-docking`) — Điều xe kéo có khớp nối, lùi lái, góc gập và va chạm khi đưa rơ-moóc vào bãi; hoàn thành các bến với giới hạn thời gian/hư hại.
13. **Hạ Cánh Trăng Non** (`lunar-lander`) — Điều góc thân và lực đẩy có nhiên liệu hữu hạn; chân tiếp đất, vận tốc ngang/dọc và độ nghiêng quyết định an toàn, hỏng hoặc mất tàu; có nhiều bãi đáp.
14. **Điều Hành Không Lưu** (`air-traffic-control`) — Vẽ lộ trình, xếp tầng cao độ, giữ vòng chờ và cho tiếp cận/hủy hạ cánh; khoảng cách an toàn, nhiên liệu và wake separation tạo quyết định khác mạng ray cố định.
15. **Đường Pit Quyết Định** (`pit-strategy`) — Điều đội đua qua các stint bằng lựa chọn lốp, tải nhiên liệu, pit window, thời tiết và rủi ro hư hại; mô phỏng đối thủ và thời gian vòng, kết thúc theo thứ hạng thực.

### D. Game bài có luật và đối thủ

16. **Solitaire Hoàng Hôn** (`klondike-table`) — Klondike với tableau kín/mở, xếp giảm luân màu, stock/waste, nền theo chất và undo; có ván seed giải được và báo đúng khi mắc, không tự nhận mọi deal ngẫu nhiên đều thắng được.
17. **Rummy Kết Chuỗi** (`rummy-meld`) — Rút–bỏ bài, lập bộ/chuỗi, tính deadwood và knock/gin theo luật công bố; AI quyết định từ tay bài của mình và thông tin đã lộ.
18. **Bài Né Điểm** (`hearts-table`) — Bốn người, chuyền bài, theo chất, breaking hearts, lá phạt và shooting the moon; đấu qua số ván/mốc điểm với bot không xem bài kín của người khác.
19. **Bích Đồng Đội** (`spades-partners`) — Đấu trick theo đội, dự báo số trick, chất chủ, overtrick/bag và phạt hụt hợp đồng; AI phối hợp bằng thông tin công khai, không trao đổi bài bí mật.
20. **Sắc Bài Đổi Chiều** (`chromatic-shedding`) — Bộ bài và mỹ thuật riêng: đánh theo màu/biểu tượng, rút, bỏ lượt, đổi chiều và chọn màu; công bố tương tác hiệu ứng và luật kết ván, không dùng thương hiệu/artwork UNO.

### E. Bàn cờ và trò chơi bàn truyền thống

21. **Domino Khóa Đầu** (`domino-chain`) — Nối số ở hai đầu, rút hoặc bỏ theo biến thể, suy luận quân địch và khóa bàn; chấm số còn trên tay, có hòa/kết thúc hữu hạn.
22. **Backgammon Song Lộ** (`backgammon-race`) — Di chuyển bằng xúc xắc, đánh quân lẻ, vào lại từ bar và bear-off; kiểm tra nước đi hợp lệ, dùng đủ xúc xắc khi luật bắt buộc và phân biệt kết quả thắng.
23. **Carrom Quân Sáng** (`carrom-pocket`) — Búng striker theo vị trí/lực/điểm chạm, đưa quân vào lỗ, xử lý queen và lượt cover; có foul, đổi lượt và kết quả ván, khác ngắm một quả bóng vào lỗ.
24. **Cờ Tướng Sơn Hà** (`xiangqi-river`) — Đủ luật cung/sông, chân mã/mắt tượng, pháo ăn qua ngòi, hai tướng không đối mặt, chiếu/bí nước và luật hòa trong phạm vi công bố; AI chỉ đi hợp lệ.
25. **Shogi Lá Phong** (`shogi-drops`) — Di chuyển, phong cấp, quân bắt về tay và thả quân, kiểm tra chiếu, nifu và các cấm thả tốt được hỗ trợ; công bố luật lặp/hòa, có AI cục bộ thực.

### F. Âm nhạc và sáng tác tương tác

26. **DJ Chuyển Đoạn** (`dj-transition`) — Hai deck có tempo/phase riêng, cue, jog/pitch, crossfader và EQ; căn hai bản nhạc tự tạo rồi chuyển đoạn đúng ô nhịp, giữ nhịp và mức âm trong dung sai qua các nhiệm vụ. Không phải thêm lane cho Rhythm Tap.
27. **Ban Nhạc Vòng Lặp** (`loop-band`) — Xếp lớp trống, bass, giai điệu trên lưới ô nhịp; đáp ứng mục tiêu tiết tấu, hòa âm và giới hạn lớp, nghe sản phẩm thật và chấm từ dữ liệu nốt.
28. **Cao Độ Phiêu Du** (`pitch-glider`) — Điều khiển cao độ liên tục bằng phím hoặc chạm để bám đường giai điệu, giữ trường độ và lấy hơi; điểm dựa trên sai số cao độ/thời lượng, không bắt buộc micro.
29. **Xưởng Hòa Âm** (`harmony-workshop`) — Chọn/đảo hợp âm hỗ trợ melody với âm chung, độ căng và cadence; có nhiều đáp án hợp lệ theo tiêu chí công bố, không chấm âm nhạc theo một thang “AI” giả.
30. **Nhạc Trưởng Tí Hon** (`orchestra-cues`) — Ra hiệu từng bè vào/ra, đổi tempo và cường độ, đọc score ngắn; giữ các bè đồng bộ và hoàn thành tiết mục, khác tự đặt nốt vào sequencer.

### G. Logic và suy luận ràng buộc

31. **Vòng Dây Logic** (`slither-loop`) — Vẽ một vòng kín duy nhất đúng số cạnh quanh ô; kiểm tra giao điểm, nhánh và vòng con, có puzzle xác nhận lời giải.
32. **Quần Đảo Cầu Đôi** (`hashi-islands`) — Nối đảo đúng bậc bằng một/hai cầu ngang dọc, không giao cắt và toàn mạng liên thông; không chỉ đổi bản đồ Hex.
33. **Đảo Và Biển** (`nurikabe-coast`) — Phân đảo đúng diện tích, đảo không chạm cạnh, biển liên thông và không có biển 2×2; dữ liệu màn được solver kiểm chứng.
34. **Ô Tổng Kakuro** (`kakuro-sums`) — Điền số không lặp trong từng run, thỏa tổng giao ngang/dọc; gợi ý giải thích bằng ràng buộc tổng, không mở rộng Sudoku rồi đổi tên.
35. **Hồ Sơ Suy Luận** (`logic-grid`) — Kết hợp mệnh đề loại trừ, thứ tự và quan hệ người–vật–thời gian; người chơi đánh dấu grid, suy ra ánh xạ hoàn chỉnh được kiểm chứng nhất quán.

### H. Vật lý và cơ cấu giải đố

36. **Cắt Dây Đón Sao** (`rope-cut-puzzle`) — Chọn thứ tự/thời điểm cắt nhiều dây, dùng quán tính, vật cản và bệ bật để đưa kiện tới đích; mô phỏng thật, không chạy hoạt ảnh kết quả cố định.
37. **Cổng Nước Thủy Tinh** (`fluid-gates`) — Điều van, bể và phao theo mực/áp suất/lưu lượng hữu hạn, hạn chế tràn và chia đúng lượng; thuật toán nước đơn giản nhưng bảo toàn lượng trong phạm vi mô hình.
38. **Xưởng Bánh Răng** (`gearworks`) — Lắp bánh răng, truyền chiều/tỷ số, clutch và giới hạn mô-men để đồng bộ nhiều trục đầu ra; phát hiện mạch truyền mâu thuẫn hoặc kẹt.
39. **Đối Trọng Cân Bằng** (`counterweight-rig`) — Lắp ròng rọc/đòn bẩy và chọn điểm treo để cân tải hoặc nâng kiện với năng lượng giới hạn; lực và mô-men quyết định kết quả, không tính lại như thanh giàn cầu.
40. **Cỗ Máy Dây Chuyền** (`domino-machine`) — Sắp domino, chốt, đòn gạt và khoảng hở, chạy một lần để kích chuỗi theo thứ tự; có va chạm, lỗi đứt chuỗi và budget linh kiện.

### I. Dịch vụ, xây dựng và thiết kế khu vui chơi

41. **Trung Tâm Thương Mại Tầng Mây** (`vertical-mall`) — Xây cửa hàng/lối đi/thang máy, bố trí nhân sự, xử lý hàng đợi và nhu cầu khách; đạt lợi nhuận và hài lòng qua chiến dịch ngày hữu hạn.
42. **Phòng Khám Thú Cưng** (`pet-care-clinic`) — Quan sát cue của game, phân loại ca, đặt lịch trạm chăm sóc, nhân sự và vệ sinh; phục vụ đúng nhu cầu dưới giới hạn công suất, tránh thất bại do quá tải.
43. **Khách Sạn Mùa Lễ** (`hotel-manager`) — Đặt phòng, dọn phòng, bảo trì và dịch vụ theo lịch khách; quản lý room state, giờ check-in/out, nhân viên, hủy đặt và mục tiêu đánh giá.
44. **Nhà Ga Hàng Không** (`airport-terminal`) — Tổ chức quầy, hàng đợi, an ninh, cửa lên máy bay và luồng hành khách; kết nối đúng chuyến trong giới hạn thời gian, khác điều đường bay ngoài trời.
45. **Xưởng Tàu Lượn** (`coaster-designer`) — Thiết kế đường ray có dốc/cong, đoạn kéo và phanh trong ngân sách; chạy thử đoàn xe với vận tốc theo trọng lực, năng lượng và giới hạn gia tốc của mô hình game. Hoàn thành vòng an toàn và tiêu chí trải nghiệm, không dựng lại mall bằng skin công viên.

### J. Sản xuất, tài nguyên và hạ tầng

46. **Tiệm Bánh Theo Mẻ** (`bakery-shift`) — Lập kế hoạch định lượng, lên men, lò dùng chung, mẻ bánh và thời điểm giao; tối ưu kế hoạch batch/hạn dùng, không lặp thao tác chọn nguyên liệu của Café Orders.
47. **Nông Trại Luân Canh** (`seasonal-farm`) — Chọn lịch gieo/thu, luân canh, dinh dưỡng đất, nước và kho qua các mùa; quyết định hôm nay ảnh hưởng vụ sau, không chỉ thêm chậu cho Garden Care.
48. **Xưởng Cắt Gỗ** (`woodcut-planner`) — Chọn sơ đồ cắt stock có chiều dài/thớ/kerf, ghép chi tiết đúng kích thước và hạn chế phế liệu; không dùng lại quy trình nung–gõ–tôi của Lò Rèn.
49. **Lưới Điện Bình Minh** (`power-grid`) — Điều độ nguồn có giới hạn tốc độ tăng/giảm công suất, dự phòng và quyết định tích/xả pin trước tải đỉnh; cân cung–cầu tức thời, tổn hao/sự cố và chi phí qua các ca của mô hình game.
50. **Thành Phố Nguồn Nước** (`water-utility`) — Quy hoạch lấy nước, chuỗi xử lý, bể và mạng cấp; chất lượng phải di chuyển theo dòng, pha trộn và thay đổi theo thời gian lưu, ảnh hưởng quyết định xử lý/cấp nước qua các ngày. Không chỉ thay đơn vị điện thành lít.

### K. Khám phá, truyện và điều tra

51. **Vụ Án Nhà Ga** (`station-detective`) — Khám hiện trường, gắn chứng cứ vào timeline và đối chiếu lời khai; kết luận phải có lập luận từ dữ liệu truyện, có đúng/sai và nhiều nhánh tiếp cận.
52. **Căn Phòng Cổ Vật** (`relic-room`) — Point-and-click với inventory, dùng/kết hợp vật phẩm và chuỗi trạng thái môi trường; các phòng có logic nhân quả, lời giải truy vết được, có hint tăng dần.
53. **Ngày Lặp Lại** (`clockloop-story`) — NPC theo lịch trong vòng lặp, hành động thay đổi sự kiện, tri thức giữ qua lần lặp; phá chuỗi nguyên nhân để mở kết cục, không chỉ replay cùng màn.
54. **Sứ Giả Hòa Ước** (`treaty-dialogue`) — Chọn lời nói, tiết lộ chứng cứ và nhượng bộ dưới ràng buộc cam kết; quan hệ/thông tin làm đổi nhánh và kết thúc, không chỉ đoán đáp án thoại.
55. **Nhà Vẽ Bản Đồ** (`cartographer-expedition`) — Khám phá tự do, xác định vị trí từ phương hướng/landmark và ghi bản đồ; quản lý tiếp tế, kiểm chứng tuyến và quay về với bản khảo sát đạt chuẩn.

### L. Nhập vai, phiêu lưu hệ thống và sinh tồn

56. **Biệt Đội Cổ Tích** (`party-jrpg`) — Người chơi điều lệnh đội theo initiative, vai trò, mana, trạng thái và phối hợp kỹ năng; tiến triển trang bị qua các trận/boss. Không phải auto battler đổi hình hoặc Dungeon một nhân vật.
57. **Thành Trì Mở Lối** (`ability-gated-quest`) — Bản đồ liên thông có backtracking, kỹ năng mới thật sự đổi khả năng di chuyển/tương tác và mở gate; có boss/kết thúc. Không chỉ thêm vài level cho Orbit Runner.
58. **Trại Dã Ngoại Sinh Tồn** (`survivor-camp`) — Điều nhân vật thu thập, craft, giữ khô/ấm, ăn và trú qua ngày đêm trên bản đồ; vật phẩm và điều kiện môi trường liên kết, khác phân công lao động của Thuộc Địa.
59. **Bạn Đồng Hành Tinh Linh** (`creature-tamer`) — Quan sát hành vi, bố trí mồi/bẫy và điều kiện môi trường để kết bạn với sinh vật nguyên bản ngoài trận; dùng năng lực loài giải thử thách habitat và mở vùng. Cơ chế chính là hệ bắt/chăm/tương tác môi trường, không tuyển đội rồi lặp JRPG theo lượt.
60. **Dấu Vết Rừng Sâu** (`wildlife-tracker`) — Suy dấu chân, tiếng động, gió và hành vi loài để chọn điểm tiếp cận/chụp ảnh; thông tin thiếu và thời gian làm đổi lộ trình, mục tiêu quan sát thay vì chỉ bắn/né lính gác.

### M. Hành động với cơ chế điều khiển mới

61. **Người Giữ Khoảnh Khắc** (`rewind-warden`) — Ghi trạng thái chiến trường trong cửa sổ hữu hạn, tua lại với tài nguyên giới hạn và một số đối tượng kháng tua; chọn thời điểm sửa sai để vượt màn. Khác truyện giữ tri thức qua ngày lặp.
62. **Chiến Trường Từng Nhịp** (`time-slice-arena`) — Thời gian thế giới tiến theo hành động của người chơi; lập đường qua đạn, tận dụng địa hình và đạn hữu hạn. Cơ chế time coupling phải thật, không chỉ nút slow motion.
63. **Pháp Ấn Nét Vẽ** (`rune-gesture`) — Vẽ hoặc nhập mẫu ấn qua các điểm điều khiển, nhận dạng hình học có tiêu chí rõ; phối hợp thuộc tính phép và cooldown theo tình huống. Có cách điều khiển bàn phím tương đương, không nhận dạng giả.
64. **Người Dẫn Đàn Sáng** (`swarm-conductor`) — Điều trường dẫn để đàn agent tuân separation/cohesion/alignment, đổi đội hình vượt chướng ngại và bảo toàn quân; không click ra lệnh RTS cho từng đơn vị.
65. **Đấu Trường Màu Mực** (`paint-skirmish`) — Phủ mặt sàn bằng mực ảnh hưởng tốc độ, ẩn nấp và hồi tài nguyên của hai phe; kiểm soát không gian gắn với di chuyển/chiến đấu, khác flood-fill khép đường của Chiếm Vùng.

### N. Hợp tác với vai trò phụ thuộc nhau

66. **Hai Người Giữ Đền** (`twin-keepers`) — Hai nhân vật có năng lực khác nhau, công tắc cần giữ, đường riêng và chướng ngại bổ sung; phối hợp đồng thời hoặc solo đổi vai, không chỉ nhân đôi nhân vật chạy màn.
67. **Chuyên Gia Và Người Tháo Gỡ** (`manual-defuse`) — Một vai có manual/khóa giải, một vai có bảng thiết bị; mô-đun thay đổi theo seed, thông tin riêng buộc trao đổi. Có chế độ luyện đổi vai, quy tắc chia sẻ màn hình/chuyền máy rõ.
68. **Phi Hành Đoàn Hai Vai** (`crew-coop`) — Một vai lái, một vai phân điện/chữa hệ thống; nhiệt, oxy và công suất liên kết với thao tác lái qua sự cố có lời giải. Solo đổi vai phải sử dụng được trên mobile.
69. **Chuyến Hàng Hai Người** (`cargo-duo`) — Hai nhân vật giữ hai tay cầm của kiện cồng kềnh, xoay qua cửa, nhả/đổi điểm nắm và chia lực; có vật lý tải và giới hạn hư hại, khác móc treo một dây.
70. **Bếp Đôi Nhộn Nhịp** (`kitchen-coop`) — Vai nấu và vai tiếp vận có quyền tương tác khác nhau, chuyển vật qua trạm, phối hợp đường đi và xử lý cháy/thức ăn hỏng theo thời gian thực; khác lập kế hoạch theo mẻ của Tiệm Bánh.

### O. Máy tính, tín hiệu và kỹ thuật

71. **Mạch Số Từ Cổng** (`logic-circuit`) — Lắp AND/OR/NOT, clock và phần tử nhớ để thỏa bảng chân trị/timeline; mô phỏng tín hiệu song song, phát hiện vòng không ổn định, khác thông dịch lệnh Drone.
72. **Trạm Chuyển Gói** (`packet-router`) — Chọn route/queue/QoS cho gói có địa chỉ, TTL và deadline trên mạng dung lượng hữu hạn; đo mất gói/độ trễ từ mô phỏng, không dùng network thật hoặc chiếm trạm bằng quân.
73. **Quỹ Đạo Hẹn Gặp** (`orbital-transfer`) — Lập thời điểm và hướng đốt động cơ để chuyển quỹ đạo, rendezvous và dock với ngân sách delta-v; dùng chuyển động trọng lực, không một đường tròn cố định thu vật phẩm.
74. **Bàn Thấu Kính** (`lens-bench`) — Phối nhiều thấu kính hội tụ/phân kỳ, chọn khoảng cách để tạo ảnh thật/ảo, chiều ảnh và đường tia tới đích; kiểm chứng bằng mô hình quang học có phạm vi rõ, khác nối ống hoặc chụp ảnh bố cục.
75. **Định Vị Radar** (`radar-triangulation`) — Chọn phép đo từ trạm, suy ra khoảng cách/hướng và quỹ đạo từ tín hiệu có nhiễu; quản lý ngân sách đo, đạt sai số định vị mục tiêu qua các tình huống.

### P. Khoa học học qua mô hình

76. **Phòng Phản Ứng** (`reaction-lab`) — Định lượng chất, chọn trình tự và nhiệt của mô hình phản ứng trong game để đạt sản phẩm; lượng chất và điều kiện tác động thật tới kết quả, không chỉ quiz tên nguyên tố.
77. **Vườn Di Truyền** (`genetics-garden`) — Lai, đọc tỉ lệ đời con và suy luận kiểu gen ẩn, dùng phép lai kiểm chứng dưới ngân sách thế hệ; dữ liệu seed và luật xác suất có thể kiểm tra.
78. **Biên Niên Địa Tầng** (`geology-strata`) — Dựng thứ tự các lớp, đứt gãy, xâm nhập và xói mòn từ mặt cắt; chuỗi sự kiện phải tái tạo dấu vết quan sát, có bài toán xác nhận được.
79. **Hành Trình Nhiệt** (`thermal-transit`) — Bố trí dẫn/cách nhiệt và nguồn nóng/lạnh để điều chuyển pha, mở lối cho kiện hàng trong thời hạn; bảo toàn năng lượng theo mô hình đơn giản, không làm lại thanh nhiệt rèn.
80. **Tinh Thể Đối Xứng** (`crystal-symmetry`) — Thao tác phép quay/phản chiếu/dịch trên motif để khớp mạng tinh thể và phân biệt cấu hình; chấm bằng phép biến đổi hình học, có mục tiêu màn hữu hạn.

### Q. Ngôn ngữ, từ và nhập liệu

81. **Ô Chữ Tiếng Việt** (`vietnamese-crossword`) — Điền từ từ clue, dùng các giao điểm để suy luận; chuẩn hóa dấu/ký tự theo luật công bố, dữ liệu câu đố nguyên bản có lời giải, khác quét Word Search.
82. **Bàn Ghép Từ** (`word-tiles`) — Rack chữ, đặt từ giao nhau, ô thưởng, đổi chữ và đối thủ theo lượt; từ điển cho phép rõ nguồn/phạm vi, chấp nhận từ dựa dữ liệu thật, không bịa xác thực.
83. **Dệt Câu Chuyện** (`sentence-weaver`) — Ghép mảnh câu dưới ràng buộc cú pháp, ngữ nghĩa và thứ tự sự kiện; nhiều phương án đúng được mô tả/kiểm tra rõ, khác bấm số theo thứ tự hoặc chọn đáp án quiz.
84. **Xưởng Mật Thư** (`cipher-workbench`) — Ánh xạ chữ của cryptogram từ mẫu lặp, tần suất và ngữ cảnh; thay một ký tự cập nhật toàn bản mã, kiểm chứng lời giải từ văn bản gốc, khác Mastermind màu/vị trí.
85. **Tốc Ký Chòm Sao** (`typing-constellation`) — Gõ văn bản và sửa lỗi trong các chặng có deadline; điểm từ tốc độ/độ chính xác thật, xử lý composition/IME tiếng Việt, không chặn phím nhập như điều khiển game.

### R. Sáng tạo và thư giãn có mục tiêu

86. **Bàn Xoay Gốm** (`pottery-wheel`) — Điều profile bán kính, thành dày và cân bằng khi tạo hình liên tục; đáp ứng đơn hàng bằng sai số hình học và độ bền, khác chuỗi gõ phôi/độ nóng của Lò Rèn.
87. **Kính Ghép Bình Minh** (`stained-glass`) — Xoay/đặt các mảnh đa giác liên tục, ghép đường biên và phối lớp kính trong để đạt hình/màu mục tiêu; không chỉ đổi hình công trình trên lưới Ghép Mảnh.
88. **Nghệ Nhân Bonsai** (`bonsai-topiary`) — Cắt/uốn nhánh, đọc phân bố ánh sáng, sức sống và phản ứng mọc chồi qua mùa để tạo silhouette; không chỉ tưới cây theo tài nguyên.
89. **Nhiếp Ảnh Phối Cảnh** (`perspective-camera`) — Đổi vị trí/hướng máy, tiêu cự và thời gian phơi trong cảnh tự tạo; dùng che khuất/parallax, tỷ lệ chủ thể, bố cục và nhòe chuyển động để đạt đơn hàng. Tiêu chí được tính từ scene/model rõ ràng, không điểm AI giả hay lặp puzzle lắp thấu kính.
90. **Xưởng In Bốn Màu** (`print-register`) — Căn đăng ký các bản màu, chọn lượng mực và mô phỏng chồng màu trừ; sửa lệch lớp và đạt dung sai màu/hình, khác tô từng pixel của Pixel Painter.

### S. Classic và giải đố không gian

91. **Bộ Ba Thuộc Tính** (`attribute-triads`) — Tìm ba lá mà từng thuộc tính đều giống hết hoặc khác hết, thay bộ trên bàn khi cần; thông tin mở và tổ hợp ba, không ghép hai ảnh giống nhau bằng trí nhớ.
92. **Mở Lối Bãi Xe** (`sliding-block-escape`) — Trượt các khối dài theo trục riêng để mở đường cho xe đích; xét bố cục, khóa và số bước tối ưu, khác một ô trống của Sliding Tiles hoặc người đẩy thùng.
93. **Chuỗi Bi Hồi Lưu** (`marble-chain`) — Bắn chèn vào chuỗi một chiều đang di chuyển, tạo nhóm, đóng khoảng trống và chain combo trước khi chuỗi tới cổng; khác lưới Bubble Reactor neo ở trần.
94. **Lập Phương Sắc Màu** (`twist-cube`) — Xoay mặt khối 2×2, theo dõi hoán vị/hướng cubie và giải về trạng thái đồng màu; scramble phải sinh từ phép xoay hợp lệ, có undo/hướng dẫn.
95. **Hộp Tia Bí Mật** (`blackbox-rays`) — Thăm dò từ mép, suy vị trí vật ẩn bằng luật hút/lệch/phản tia và số lượt đo; đánh dấu nghiệm rồi kiểm chứng, khác lắp đường ống hoặc bắn tàu cố định.

### T. Dự đoán, tâm lý và party theo lượt

96. **Xúc Xắc Nói Thật** (`liars-dice`) — Các tay xúc xắc ẩn, đấu mức số lượng/mặt và quyết định tố; luật reveal, mất xúc xắc và bot suy luận từ thông tin của mình, khác xúc xắc chiến đấu phân vai.
97. **Phòng Thí Nghiệm Niềm Tin** (`trust-lab`) — Chọn hợp tác/phản bội với bot có chiến lược và trí nhớ công bố qua nhiều lượt, thay đổi payoff/nhiễu để đạt mục tiêu; khác truyện chọn thoại và quan hệ nhân vật.
98. **Thế Tay Đồng Thời** (`gesture-tactics`) — Chọn kín một trong các thế có quan hệ thắng/thua, quản lý năng lượng/cooldown và đọc lịch sử đối thủ; reveal đồng thời có luật minh bạch, không để bot nhìn lựa chọn vừa khóa.
99. **Lễ Hội Chọn Bài** (`festival-draft`) — Chọn một lá rồi chuyền tay bài, xây tableau và tranh tài nguyên chung qua nhiều vòng; score từ engine/set objective, khác mua quân, đấu giá hoặc deck-building đánh quái.
100. **Đoán Khoảng Tự Tin** (`confidence-estimator`) — Quan sát cảnh mô phỏng rồi chọn khoảng ước lượng và mức tự tin, chấm cân bằng độ hẹp/phủ giá trị thật; nhiều vòng với bot công bố, không phải quiz đổi chủ đề.

## 4. Chốt khác biệt của các cặp dễ bị tính trùng

- Futsal/Hoops phải có đồng đội, sở hữu bóng, phòng thủ và trận đấu; thêm AI chạy nền cho màn penalty/ném rổ không đủ.
- Tennis phải có người trên sân, giao bóng, loại cú đánh và điểm game/set; không Pong đổi hình. Bowling/Bi-a/Carrom/Curling có luật lượt, nhiều vật va chạm và cách chấm khác nhau; không dùng cùng một màn bi mục tiêu rồi đổi artwork.
- Các game bài khác nhau ở luật đánh/ăn trick/xếp bộ/lượt/hợp đồng; giao diện bàn hoặc bộ chia bài có thể dùng chung, bộ luật không được giả lập bằng cùng một hàm đổi nhãn.
- Cờ Tướng/Shogi khác cờ vua bằng luật và quyết định thực; thêm bộ quân mới lên renderer cờ vua không được tính hoàn thành.
- Năm game nhạc phải lần lượt có beatmatching giữa hai deck, sequencer, cao độ liên tục, hòa âm và điều phối bè. Nâng Rhythm Tap thêm lane/hold/release có thể làm như nâng cấp game cũ, không tính vào 100 game mới.
- Logic Circuit mô phỏng tín hiệu/nhớ, Drone chạy chương trình, Gearworks truyền chuyển động; không thay các nút của một interpreter rồi đếm thêm game.
- Rope Cut khác Grapple ở việc cắt topology của hệ dây để giải một cấu hình vật lý; Cargo Duo cần hai điểm nắm phụ thuộc nhau. Nếu chỉ dùng lại nhân vật đu dây, thay ứng viên.
- Physics Fluid Gates là giải cấu hình/phân lượng từng phòng; Water Utility là quản lý mạng/công suất/chất lượng theo thời gian. Nếu implementation giống nhau chỉ khác map, hợp nhất và thay một ứng viên.
- Bakery là lập kế hoạch batch/stock/oven; Kitchen Co-op là điều người có vai trò và luồng chuyển vật theo thời gian thực. Nếu chỉ đổi số người, không tính hai game.
- Mall/Hotel/Airport phải có mô hình quyết định riêng về không gian/thang máy, lịch phòng và flow/chuyến. Xưởng Tàu Lượn phải là thiết kế track và thử động lực học, không mall đổi thành công viên. Không dùng một hàng đợi rồi đổi tên khách/cửa hàng để tính nhiều game.
- Metroidvania cần kỹ năng mới làm thay đổi tập hành động và bản đồ có gate/backtracking; không chỉ nối dài Orbit Runner. JRPG cần đội do người chơi ra lệnh và tương tác trạng thái; không auto battler đổi art.
- Creature Tamer tập trung bắt/kết bạn ngoài trận và dùng năng lực loài giải môi trường. Nếu chủ yếu là tuyển đội đánh theo lượt, xem đó là campaign của JRPG và thay ứng viên.
- Clockloop Story thay nhân quả/lịch NPC nhờ tri thức giữ lại; Rewind Warden phục hồi state chiến trường bằng ngân sách; Time Slice ghép tiến thời gian với input. Nếu không làm được ba hệ khác nhau, thay các ứng viên trùng.
- Crystal Symmetry là thao tác nhóm biến đổi; Stained Glass là ghép hình/tính lớp kính; Twist Cube là hoán vị/hướng cubie. Không cùng một puzzle xoay mảnh đổi tên.
- Lens Bench giải hệ nhiều thấu kính và đường tia; Perspective Camera giải bố cục/che khuất/nhòe chuyển động bằng góc nhìn. Không tính hai UI điều tiêu cự là hai game.
- Khác biệt phải thể hiện bằng gameplay và test tài nguyên/luật/đầu ra, không chỉ tồn tại trong bảng mô tả.

## 5. Chuẩn hoàn chỉnh của từng game mới

- Mục tiêu rõ trước khi chơi, tutorial ngắn qua hình/thao tác và luật truy cập được trong ván.
- Start, pause/resume khi phù hợp, restart, kết thúc thắng/thua/hòa/đạt mục tiêu và quay thư viện đều dùng được.
- Puzzle có dữ liệu màn hoặc generator được solver kiểm chứng; không sinh seed vô nghiệm rồi xem đó là thử thách. Không áp điều này một cách sai lệch cho game ngẫu nhiên có luật không bảo đảm thắng; phải mô tả đúng xác suất và khả năng mắc.
- Game đối kháng có AI hợp lệ, không xem bài/thông tin kín hoặc đọc input đã khóa. Nếu cần commit/reveal, thời điểm bot khóa quyết định phải có thể kiểm thử.
- Độ khó thay đổi tham số hoặc chiến thuật được ghi rõ. Không gắn ba tên độ khó lên cùng một cách chơi; nếu chỉ có một mức thì trình bày trung thực.
- Game campaign có tối thiểu ba màn/chặng có khác biệt quyết định; game thể thao/bàn/bài có một trận/ván đầy đủ và khả năng chơi lại có ý nghĩa. Cốt truyện có state, điều kiện nhánh và kết cục thực; không chỉ bấm Next qua văn bản.
- Game sáng tạo/thư giãn vẫn có thử thách hoặc mục tiêu đánh giá minh bạch nếu hiển thị kết quả; sandbox tùy chọn không được giả thành chiến thắng.
- Co-op có solo đổi vai hoặc chế độ luyện sử dụng được, cộng local nhiều người khi phù hợp. Công bố số người, thiết bị, cách giấu thông tin và hạn chế. Không hiện “online/đã ghép phòng/người thật” nếu không có hệ thống thật; không cần dựng backend multiplayer trong scope này.
- Nhạc dùng dữ liệu nốt/track/chart và âm thanh nguyên bản hoặc có quyền rõ. Chỉ khởi tạo audio sau thao tác; có mute/volume và lựa chọn cue hình ảnh. Audio dùng clock riêng chính xác và được host quản lý lịch phát/cleanup; pause phải dừng cả âm đã lên lịch và đóng băng scoring, resume đúng offset và không phát bù hàng loạt. Không serialize AudioNode vào checkpoint.
- Nội dung STEM/ngôn ngữ dùng nguồn chuyên môn hoặc dữ liệu biên soạn có thể kiểm chứng; mô tả rõ phần nào là mô hình đơn giản hóa của game, không bịa kiến thức để hợp thức hóa điểm số.
- Tất cả thống kê, điểm, sao, lời gợi ý và thành tích lấy từ logic/state thật. Không tạo leaderboard hoặc nhãn “AI phân tích” giả.

## 6. Nâng cấp thiết kế toàn All Game

Định hướng **Premium Colorful Arcade**: rực rỡ nhưng dễ đọc, có chất liệu 2D, phân cấp rõ và từng nhóm có bản sắc. Giữ xanh điện `#4776FF`, cyan `#25D9F8`, tím `#9361FF`, hồng `#FF66B3`, coral `#FF8066`, vàng `#FFD166`; nền indigo, mặt sáng/tối có vai trò rõ. Màu nguy hiểm/đồng minh/mục tiêu phải đi kèm hình dạng/nhãn.

### Thư viện

- Số lượng sinh từ catalog đã hoàn thành; bổ sung taxonomy theo nhiều tag, không ép game co-op âm nhạc vào một nhãn duy nhất. 20 nhóm đề xuất là cách kiểm kê, không bắt buộc làm thành 20 nút dài trên mobile.
- Hero mobile gọn; ưu tiên nhìn thấy game, có nút nhảy tới danh mục. Collections có chủ đích như Thể thao, Bài & cờ, Co-op, Sáng tạo, Chơi nhanh, Campaign và Tiếp tục; “tiếp tục” dựa checkpoint thật.
- Tìm kiếm tiếng Việt, filter kết hợp genre/input/số người/thời lượng, favorite/recent và sort; phân biệt không kết quả, chưa có yêu thích, chưa có phiên tiếp tục và lỗi tải.
- Mỗi game có key art phản ánh đúng sân chơi/nhân vật/vật thể và cơ chế. Có thể dùng SVG hoặc render ảnh từ một state tiêu biểu; không dùng một poster rồi thay tiêu đề cho 100 game.
- Kiểm tra contrast CTA/metadata trên cả thẻ sáng và tối, tên dài, focus, hover và loading/error/retry. Hình ảnh đẹp không được làm nút chơi khó thấy.

### Bên trong cả game mới và game cũ

- Nâng bảng chơi, nhân vật, quân bài, bóng, vật thể/công trình và hiệu ứng; ghi rõ cải tiến cụ thể cho các game cũ, không chỉ thay nền trang danh mục.
- Hệ design token và thành phần dùng chung cho HUD, thanh tài nguyên, command dock, lựa chọn, tutorial, kết quả, bản đồ cấp và progress. Bản sắc riêng của game nằm ở renderer/cảnh/vật thể và thông tin luật.
- Dùng cả hình/âm báo ngắn cho va chạm, chọn, scoring, warning và thành công; hiệu ứng không che mục tiêu hay kéo dài thời gian chờ. Giảm chuyển động tắt hiệu ứng trang trí mà giữ cue cần thiết.
- Không tô mọi vật bằng glow. Chú trọng silhouette, chất liệu, viền sáng/bóng, trạng thái có thể đọc ngay và bố cục vùng chơi lớn nhất có thể.

## 7. Kiến trúc, hiệu năng, input và dữ liệu

- Giữ vanilla JS và mount/lifecycle hiện có trừ khi chứng minh cần thay đổi. Luật/state, AI, dữ liệu và renderer tách ở mức phù hợp; chia bundle theo nhóm, tải theo nhu cầu.
- Host sở hữu RAF, timer, scheduler audio và sự kiện. Turn-based/idle/prep không chạy RAF liên tục; có sự kiện mới mới vẽ/cập nhật. Engine không tự tạo vòng lặp ngoài lifecycle.
- Pause khi hidden/blur; resume bằng thao tác rõ. Rời game phải hủy listener, timer, voice/audio, pointer capture, worker nếu có và tài nguyên liên quan. Thumbnail không chạy đồng thời animation loop.
- Thiết kế giới hạn particles/entities/history và chi phí mô phỏng. Đo tải thư viện/bundle, thời gian frame và vòng lặp sau unmount; không tuyên bố 60fps trên mọi máy khi chưa đo.
- Desktop 1440×900, tablet 768×1024, mobile 375×812; thử zoom 200%, DPR cao và reduced motion. Không tràn ngang trang hoặc giấu các nút quan trọng.
- Nút/vùng tương tác UI tối thiểu 44px. Bàn nhiều ô có phóng/thu/cuộn nội bộ và marker bàn phím; phân biệt vuốt cuộn với chạm chọn, không gây nước đi/xây công trình nhầm.
- Chuột/chạm quy đổi đúng sau resize, DPR, phóng bàn và fullscreen. Điều khiển nhập văn bản không bị hotkey gameplay chiếm phím; hỗ trợ IME và focus/Tab hợp lý.
- Giữ dữ liệu cũ, record theo account/game/difficulty/rules, checkpoint có giới hạn và xử lý hỏng/quota. Chỉ lưu state động/ID dữ liệu, không nhét ảnh/âm thanh/campaign text nguyên khối vào localStorage.
- **Rà lại giới hạn kích thước storage khi từ 109 lên trên 200 game.** Tính worst-case serialized records/favorites/history; giới hạn đọc, normalize và giới hạn ghi phải tương thích. Không để dữ liệu hợp lệ tăng kích thước rồi bị coi là hỏng và reset toàn bộ. Có test dữ liệu tối đa và migration/backward compatibility.
- Không tự nhận có cloud sync/đa thiết bị. Nếu thực sự cần thêm persistence khác, giữ migration và mô tả đúng phạm vi hiện hữu.

## 8. Thực hiện theo đợt, kiểm thử và tự đánh giá

Lập kế hoạch 20 đợt, mỗi đợt khoảng năm game hoặc theo dependency thích hợp. Một đợt phải có luật, renderer, input, dữ liệu màn, UI, test và ảnh hoàn chỉnh trước khi tính các game đó vào số lượng hoàn thành. Tiếp tục qua các đợt cho tới đủ phạm vi; không đăng ký 100 placeholder rồi báo đạt.

Tài liệu theo dõi tối thiểu:

1. Baseline thực tế và mapping ID/route/engine của mọi game cũ.
2. Bảng 100 cơ chế và cả hai đối chiếu game cũ/game mới gần nhất.
3. Spec ngắn, biến thể luật, giới hạn AI, tham số độ khó và điều kiện kết thúc từng game.
4. Checklist nâng cấp hình ảnh và QA cho toàn thư viện.
5. Nguồn đã đọc, ngày đọc, license theo phần, file/commit thực dùng và notice.
6. Log kiểm tra, ảnh đại diện, điều đã xác minh và giới hạn chưa kiểm chứng.

Chạy bộ test hiện có liên quan trước/sau; thêm test luật có giá trị cho mỗi engine mới. Ưu tiên invariant, nước đi, bảo toàn tài nguyên, va chạm, scoring, thông tin kín, state serialization và điều kiện kết thúc. Không viết test chỉ kiểm tra tên game, số lượng entry hoặc tự gán `status='won'` rồi xem là chứng minh game chơi được.

Với mỗi game mới:

- Kiểm chứng input chính làm thay đổi state/tài nguyên/luật thực.
- Kiểm chứng thắng/thua/hòa phù hợp từ tình huống hợp lệ. Ghi rõ fixture gần cuối khác với chơi trọn từ fresh state.
- Puzzle/campaign phải có chứng cứ giải được qua chuỗi action hợp lệ từ đầu cho mỗi màn bắt buộc; ít nhất một seed/trận hoàn chỉnh cho game có hệ thống ngẫu nhiên/AI, cộng các seed/mức khó đại diện. Không thay luật hoặc dựng state không thể đạt để làm test qua.
- Âm nhạc: timing ở nhiều frame rate, latency offset, độ lệch phase/tempo, thời lượng nốt, pause/resume và tắt tiếng không làm sai kết quả; không phát bù âm cũ sau pause. Bài/cờ: legality, kết ván, khả năng chơi tới kết thúc, bot không nhìn thông tin riêng.
- Trong Chromium thật từ shell: mở, start, điều khiển chính, pause/resume, restart, chuyển game, Back/Forward, mất focus/hidden và reload checkpoint. Làm đủ tất cả route; kiểm tra tablet/mobile và các trường hợp input đặc biệt.
- Kiểm tra error/retry khi bundle lỗi, quota/corrupt data, phân tách account và difficulty, vòng lặp/audio/listener sau unmount, không có JS/CSP error chưa xử lý.

Chụp thư viện ở ba kích thước, ít nhất một ảnh đang chơi cho từng game mới và các nhóm game cũ sau nâng cấp; tạo contact sheet theo nhóm để xem tính thống nhất/khác biệt. Tự mở ảnh xem, sửa chữ khó đọc, vật thể khó phân biệt, bảng quá nhỏ hoặc điều khiển bất tiện rồi chụp lại. Không dùng mockup thay bằng chứng runtime.

Phân biệt test đạt, bỏ qua, lỗi có sẵn và chưa chạy. Không nói đã thử iOS/Android vật lý nếu chỉ dùng emulation; không nói đã chơi tay tất cả campaign nếu chứng cứ là engine solver hoặc fixture.

## 9. Tiêu chí bàn giao và phát hành

- Đủ 100 game mới thực chất, toàn bộ game cũ hoạt động và có nâng cấp hình ảnh; số lượng lấy từ baseline cộng 100, dự kiến 209.
- Không có nút giả, game chỉ có màn chào, AI bất hợp lệ, badge tiến độ bịa hoặc tính năng mô tả nhưng chưa có.
- Danh mục, sidebar, command search, route, lazy loader, storage và Service Worker khớp nhau; cập nhật version theo trạng thái repository lúc triển khai, không chép cứng số release trong prompt này.
- Rà diff, chỉ stage thay đổi thuộc phạm vi, chạy các kiểm tra bắt buộc rồi commit/push lên remote/nhánh hiện tại theo quy ước project. Không force-push hoặc mang theo thay đổi ngoài phạm vi.
- Kiểm tra trạng thái CI/deployment và tài nguyên thực trên hoang8.com khi có quyền. Nếu gate phụ thuộc vốn đã lỗi, xác định baseline và báo đúng; không gọi toàn bộ CI xanh hoặc tự sửa các dependency không liên quan để che vấn đề.
- Báo commit hash/link, release, tổng game, nhóm đã bổ sung, kết quả test engine/browser, ảnh minh chứng, phạm vi lưu và các giới hạn còn lại.

Bắt đầu bằng việc đọc cấu trúc, xuất danh mục thực tế và lập bảng chống trùng, sau đó triển khai liên tục theo các đợt đã chọn.
