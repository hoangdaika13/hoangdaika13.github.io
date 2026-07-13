# Thiết lập Google và Facebook OAuth

Code đăng nhập đã hoàn chỉnh. Client Secret chỉ được lưu trong Vercel Environment Variables, không lưu trong HTML hoặc GitHub.

## URL cần dùng

- Website: `https://hoangdaika13.github.io`
- Backend: `https://hoangdaika13githubio.vercel.app`
- Google callback: `https://hoangdaika13githubio.vercel.app/api/auth/google/callback`
- Facebook callback: `https://hoangdaika13githubio.vercel.app/api/auth/facebook/callback`
- Privacy: `https://hoangdaika13.github.io/privacy.html`
- Terms: `https://hoangdaika13.github.io/terms.html`
- Data deletion: `https://hoangdaika13.github.io/data-deletion.html`

## Google Cloud

1. Mở `https://console.cloud.google.com/`, tạo hoặc chọn project.
2. Mở **Google Auth Platform > Branding**, nhập tên `HH Platform`, email hỗ trợ, website, Privacy và Terms URL.
3. Trong **Audience**, chọn **External** và thêm Gmail của bạn vào Test users khi đang thử nghiệm.
4. Mở **Clients > Create client > Web application**.
5. Authorized JavaScript origins:
   - `https://hoangdaika13.github.io`
   - `https://hoangdaika13githubio.vercel.app`
6. Authorized redirect URI:
   - `https://hoangdaika13githubio.vercel.app/api/auth/google/callback`
7. Lưu lại **Client ID** và **Client Secret**.

## Meta for Developers

1. Mở `https://developers.facebook.com/apps/`, chọn **Create App**.
2. Chọn use case xác thực người dùng bằng Facebook và thêm Facebook Login.
3. **Settings > Basic**:
   - App Domains: `hoangdaika13.github.io`
   - Privacy Policy URL: `https://hoangdaika13.github.io/privacy.html`
   - Terms URL: `https://hoangdaika13.github.io/terms.html`
   - User Data Deletion URL: `https://hoangdaika13.github.io/data-deletion.html`
4. **Facebook Login > Settings**: bật Client OAuth Login và Web OAuth Login.
5. Valid OAuth Redirect URI:
   - `https://hoangdaika13githubio.vercel.app/api/auth/facebook/callback`
6. **Settings > Basic**: lấy App ID, bấm Show để xem App Secret.
7. Development mode chỉ cho admin/developer/tester đăng nhập. Chuyển sang Live sau khi Meta chấp thuận các yêu cầu cần thiết.

## Vercel

Mở project `hoangdaika13githubio` > **Settings > Environment Variables**, thêm cho Production:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=https://hoangdaika13githubio.vercel.app/api/auth/google/callback
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
FACEBOOK_CALLBACK_URL=https://hoangdaika13githubio.vercel.app/api/auth/facebook/callback
FACEBOOK_GRAPH_VERSION=v23.0
FRONTEND_URL=https://hoangdaika13.github.io
ALLOWED_ORIGINS=https://hoangdaika13.github.io,https://hoangdaika13githubio.vercel.app
```

Redeploy bản Production mới nhất. Kiểm tra:

`https://hoangdaika13githubio.vercel.app/api/auth/providers`

Khi hoàn tất, kết quả có `"google":true` và `"facebook":true`; hai nút trên website sẽ tự bật.

## Bảo mật

- Không gửi Client Secret qua chat hoặc commit vào GitHub.
- OAuth dùng state có chữ ký, nonce cookie HttpOnly và danh sách domain chuyển hướng cho phép.
- Google chỉ xin `openid email profile`; Facebook chỉ xin `email, public_profile`.
- Mật khẩu tự tạo được băm một chiều và không xuất hiện trong Admin Panel.
