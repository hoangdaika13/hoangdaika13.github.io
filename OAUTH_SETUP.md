# Thiết lập đăng nhập Google

HH Neon Platform chỉ dùng Google OAuth và tài khoản email. Client Secret phải được lưu trong Vercel Environment Variables, không đặt trong HTML, JavaScript phía trình duyệt hoặc GitHub.

## URL chính thức

- Website: `https://hoang8.com`
- Website www: `https://www.hoang8.com`
- Backend: `https://hoang8.com`
- Google callback: `https://hoang8.com/api/auth/google/callback`
- Privacy: `https://hoang8.com/privacy.html`
- Terms: `https://hoang8.com/terms.html`

## Google Cloud

1. Mở `https://console.cloud.google.com/` và chọn project đang dùng.
2. Trong **Google Auth Platform > Branding**, đặt tên `Nhhoang · HH Neon Platform`, email hỗ trợ, website, Privacy và Terms URL theo domain mới.
3. Trong **Audience**, chọn **External**. Nếu ứng dụng còn ở Testing, thêm Gmail cần đăng nhập vào Test users.
4. Trong **Clients**, mở OAuth client loại **Web application**.
5. Authorized JavaScript origins:
   - `https://hoang8.com`
   - `https://www.hoang8.com`
   - `https://hoangdaika13-github-io.vercel.app`
6. Authorized redirect URI phải khớp chính xác:
   - `https://hoang8.com/api/auth/google/callback`
7. Lưu Client ID và Client Secret vào Vercel.

## Vercel

Trong project backend, đặt các biến cho Production:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://hoang8.com/api/auth/google/callback
FRONTEND_URL=https://hoang8.com
ALLOWED_ORIGINS=https://hoang8.com,https://www.hoang8.com,https://hoangdaika13-github-io.vercel.app
```

Sau khi redeploy, kiểm tra `https://hoang8.com/api/auth/providers`. Kết quả phải có `"google": true` và callback Google đúng URL phía trên.

## Bảo mật

- OAuth dùng state có chữ ký, nonce cookie HttpOnly, Secure và danh sách domain chuyển hướng cho phép.
- Ứng dụng chỉ xin scope `openid email profile`.
- Luồng đăng nhập Facebook đã bị loại bỏ khỏi giao diện, API và realtime server.
- Không gửi Client Secret qua chat hoặc commit vào GitHub.
