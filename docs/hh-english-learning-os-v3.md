# HH English Learning OS V3

## Mục tiêu

Learning OS V3 hợp nhất các chức năng HH English đã có thành một vòng học rõ ràng:

`Hôm nay → Lộ trình → Luyện tập → Khám phá → Tiến độ`

Hệ thống tiếp tục dùng 69 bài CEFR, 70 Career paths, Vocabulary Explorer 30K, Listening/Reading Galaxy, Voice Studio và CEFR Skill Graph hiện hữu. Không thay hoặc tự nâng trạng thái kiểm duyệt của nội dung.

## Luồng mới

- Trang **Hôm nay** lấy nhiệm vụ từ bài chưa hoàn thành, SRS đến hạn, lỗi đã lưu và checkpoint gần nhất.
- Người học chọn phiên 5, 15 hoặc 30 phút. Đây là lựa chọn cục bộ, không phải dự đoán AI.
- Lesson Player có 12 bước tuần tự. Hoàn thành và bỏ qua được lưu khác nhau.
- Câu trả lời sai được đưa vào Error Clinic; câu đúng tạo review evidence.
- Vốn từ tách thành `recognition`, `recall` và `active`. Trạng thái active cần cả production và delayed recall.

## Migration và lưu trữ

- Legacy key được giữ để tương thích: `hh.english.state.v1`.
- Key chính mới: `hh.english.state.v3:{ownerId}:{learnerProfileId}`.
- Khi chưa có key mới, dữ liệu legacy của đúng scope được sao chép sang V3; không xóa bản cũ.
- Hồ sơ mặc định là `default`. Tên scope chỉ nhận chữ, số, `_` và `-`.
- Khách dùng anonymous ID của thiết bị và chỉ được báo là **đã lưu trên thiết bị**.

## Đồng bộ máy chủ

Endpoint: `GET|PUT|DELETE /api/store/english-learning`

Backend chạy qua dynamic Store gateway để không tăng số Vercel Functions. Mỗi bản ghi MongoDB được khóa bằng:

- `ownerId` lấy từ session phía server.
- `learnerProfileId` đã validate.
- `revision` chống ghi đè thay đổi mới hơn.
- `clientMutationId` chống gửi trùng.

Các field giống secret, token, cookie, API key và ownership do client gửi đều bị loại. Xóa dữ liệu server yêu cầu header `X-HH-Confirm-Delete` khớp learner profile.

Biến môi trường dùng lại từ platform:

- `MONGODB_URI`
- `MONGODB_DB`
- `JWT_SECRET` tối thiểu 32 ký tự
- `ALLOWED_ORIGINS` khi chạy ngoài các domain mặc định

Không có các biến này, học offline vẫn hoạt động; UI không được báo đã đồng bộ.

## Nội dung chưa được giả lập

- Speech-to-text chỉ được gọi là độ phủ transcript, không phải điểm phát âm tuyệt đối.
- AI Tutor không được báo hoạt động nếu provider chưa được cấu hình và cấp quota.
- IELTS/TOEIC/Cambridge không được tự gán band hoặc chứng chỉ.
- Từ chưa có nghĩa/CEFR kiểm duyệt chỉ hiện như term index.
- PDF dùng print stylesheet và hộp thoại in/lưu PDF của trình duyệt; CSV và JSON được tạo trực tiếp trên thiết bị.

## Kiểm thử

- `npm run test:english`
- `npm run test:security:full`
- `node --test tests/dynamic-navigation-contract.test.js tests/performance-loading-contract.test.js`
- `npm audit --omit=dev --audit-level=moderate`
- `npx vercel build`

Browser QA tối thiểu: desktop, 375px, 320px, reload giữa bài, câu đúng/sai, Error Clinic, cuộn dọc và không tràn ngang.

## Rollback

Để tắt Learning OS V3 mà không xóa dữ liệu:

1. Gỡ `english-learning-os.css` và `english-learning-os.js` khỏi nhóm `english` trong `performance-loader.js` và `sw.js`.
2. Khôi phục renderer/navigation trước đó trong `english-learning.js`.
3. Không xóa các key `hh.english.state.v3:*`; chúng không ảnh hưởng renderer cũ.
4. Có thể giữ service `englishLearningSync` không được route tới, hoặc gỡ nhánh `resource === "english-learning"` khỏi Store gateway.
