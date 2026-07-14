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

Các key có thể thuộc cùng một Google Cloud Project, nhưng nên tạo key riêng cho từng dịch vụ để giới hạn API restriction chính xác. Việc tách key không làm tăng số Vercel Function.

Gateway có timeout, kiểm tra tham số, SafeSearch, rate limit và cache CDN. API danh sách người dùng đã được gộp vào `GET /api/platform/summary?view=users` để tổng số file thực thi trong `/api` còn đúng 12.
