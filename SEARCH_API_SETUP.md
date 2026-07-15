# Google + YouTube Search Gateway

Toàn bộ Google Search và YouTube Data API dùng chung một Vercel Function động:

- `GET /api/search/google?q=AI`
- `GET /api/search/google?q=design&kind=images`
- `GET /api/search/youtube?q=music`
- `GET /api/search/youtube?action=videos&id=VIDEO_ID`
- `GET /api/search/youtube?action=channels&id=CHANNEL_ID`
- `GET /api/search/youtube?action=playlist-items&playlistId=PLAYLIST_ID`
- `GET /api/search/google?health=1`

## Biến môi trường Vercel

- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `YOUTUBE_API_KEY`

## Agent Search / Vertex AI Search

Khi có đủ các biến sau, gateway sẽ ưu tiên `searchLite` của Agent Search thay cho Custom Search JSON API:

- `VERTEX_SEARCH_PROJECT_ID`
- `VERTEX_SEARCH_LOCATION=global`
- `VERTEX_SEARCH_APP_ID`
- `VERTEX_SEARCH_API_KEY` (có thể dùng chung giá trị với `GOOGLE_SEARCH_API_KEY`)

Website data store cần gắn với app bật Enterprise Edition. `searchLite` chỉ tìm website công khai và không hỗ trợ tìm ảnh. Backend tự động quay về Programmable Search nếu chưa có đủ biến Vertex.

## Privacy Shield và YouTube Studio

- Video luôn phát qua `youtube-nocookie.com` và API key chỉ tồn tại trên Vercel.
- Privacy Shield không lưu lịch sử xem trong HH và ẩn kết quả tự ghi rõ `#ad`, `paid promotion`, `được tài trợ` hoặc `nội dung quảng cáo`.
- Website không can thiệp hoặc loại bỏ quảng cáo do YouTube chèn trong trình phát chính thức.
- Tìm kiếm hỗ trợ thời điểm đăng, phụ đề, trạng thái livestream, độ dài, chất lượng và sắp xếp.
- Hàng đợi, tự phát, tốc độ phát, chế độ rạp, mini player, thư viện yêu thích và lịch sử được lưu cục bộ trên thiết bị.

Các key có thể thuộc cùng một Google Cloud Project, nhưng nên tạo key riêng cho từng dịch vụ để giới hạn API restriction chính xác. Việc tách key không làm tăng số Vercel Function.

Gateway có timeout, kiểm tra tham số, SafeSearch, rate limit và cache CDN. API danh sách người dùng đã được gộp vào `GET /api/platform/summary?view=users` để tổng số file thực thi trong `/api` còn đúng 12.
