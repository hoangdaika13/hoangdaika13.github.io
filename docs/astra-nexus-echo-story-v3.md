# HH ASTRA · Nexus Echo Memory Canon V3

## Mục tiêu

Nexus Echo V3 giữ một tuyến canon tám chương để multiplayer và save luôn nhất quán, nhưng khiến hành động của người chơi tác động thật tới:

- Memory Codex và các lời khai mâu thuẫn.
- Trust, hội thoại, biểu cảm và kỹ năng phối hợp của bốn nhân vật.
- Boss Codex trước và sau khi hiểu sự thật.
- Nhiệm vụ phụ, banter theo địa điểm và trạng thái H-Central.
- Mức hiểu biết về Hội đồng Helios, Ca đoàn Tro Tàn và Người Gác Khoảng Lặng.

Phản hồi đạo đức không tạo ending giả. Chúng thay đổi quan hệ và cách đội hình đi tới kết thúc canon: biến H-Central thành Kho Lưu Trữ Sống.

## Kiến trúc

`services/astra-story/NexusEchoStoryV3.js` là Story Engine thuần dữ liệu và chuyển trạng thái. Module không phụ thuộc Three.js, DOM hoặc backend nên có thể kiểm thử trực tiếp.

Facade `window.HHAstraNexusEchoStory` cung cấp:

- `createState()` và `normalizeState()`.
- `recordEvent()` cho travel, scan, hunt, boss, restore và talk.
- `startSideQuest()`.
- `chooseResponse()`.
- `syncCompanionBond()`.
- `nextBanter()`.
- `completeChapter()` và `chapterSnapshot()`.

`astral-realms.js` chịu trách nhiệm nối các sự kiện gameplay thật vào engine, lưu `story.narrative` trong save schema 12 và render giao diện.

## Nội dung

- 8 chương canon.
- 8 boss có cơ chế và hai tầng góc nhìn.
- 24 mảnh ký ức: Archive, Echo và Testimony.
- 8 mâu thuẫn cần ít nhất hai nguồn bằng chứng.
- 7 nhiệm vụ phụ nhiều bước.
- 8 dilemma, mỗi dilemma có ba phản hồi nhưng không phân nhánh ending.
- 20 mốc hội thoại Trust cho bốn nhân vật.
- 16 banter gắn với chương và khu vực.
- 8 giai đoạn biến đổi H-Central.

## Quy tắc tiến độ

- Scan mở Archive.
- Hunt mở Echo.
- Boss được combat xác nhận mới mở Testimony và góc nhìn thật trong Boss Codex.
- Nút nhiệm vụ phụ chỉ bắt đầu theo dõi; không tự cộng tiến độ.
- Objective chỉ tăng khi event gameplay đúng loại, đúng khu vực và đúng nhân vật.
- Khi nhận nhiệm vụ muộn, engine đối chiếu scan, hunt, boss, restore và bond đã lưu để không bắt người chơi lặp lại hành động có thật.
- Banter chỉ phát một lần khi đúng chương và khu vực.
- Dữ liệu lạ, ID không tồn tại và giá trị vượt giới hạn bị loại khi normalize.

## Giao diện

- Dock `Ký ức` mở Memory Codex.
- Dock `Trại nghỉ` mở Trust, character arc và banter log.
- `Phe phái` hiển thị học thuyết, cái giá và sự thật bị che giấu của ba phe trung tâm.
- Astral Codex liên kết tới Memory Codex và Trại nghỉ.
- Panel cuộn độc lập, không khóa cuộn toàn website và không giữ Pointer Lock.
- Mobile 375px dùng một cột; dock cuộn ngang và không nằm dưới thẻ đội hình.

## Fallback trung thực

Nếu Story Engine không tải, panel hiển thị `Story Engine chưa kết nối`; không tạo ký ức, Trust, hội thoại hoặc trạng thái giả.
