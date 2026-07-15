# Hoangdaika13 Realtime Server

Backend rieng cho:

- Socket.io theo doi nguoi dang online theo consent.
- Messenger HH realtime: phong rieng, nhom, hien dien, dang nhap va dong bo thay doi.
- Dang ky/dang nhap bang email + password.
- Dang nhap Google/Facebook OAuth khi co Client ID/Secret.
- Luu user/session/event vao MongoDB.
- API cho 37 module AI Super Platform: module records/actions, helpdesk, store orders, storage metadata, notification subscriptions va admin overview.

Khong deploy backend nay len GitHub Pages. Hay deploy len Render, Railway, Fly.io hoac VPS Node.js.

## Bien moi truong can co

Copy `.env.example` thanh `.env` khi chay local.

Quan trong:

- `MONGODB_URI`: connection string MongoDB Atlas.
- `JWT_SECRET`: chuoi random dai.
- `FRONTEND_URL`: `https://hoangdaika13.github.io`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: tao trong Google Cloud Console.
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`: tao trong Meta for Developers.

## Chay local

```powershell
cd realtime-server
npm install
npm run start
```

## Gan vao frontend

Sau khi deploy backend, sua `config.js`:

```js
window.HH_REALTIME_URL = "https://your-realtime-server.example.com";
window.HH_SOCKET_URL = "https://your-persistent-node-server.example.com";
```

`HH_SOCKET_URL` phai la may chu Node chay lien tuc (Render, Railway hoac VPS), khong phai Vercel Functions. Neu de trong, Messenger van dong bo bang REST polling de khong mat tin nhan.
May chu Socket va Vercel API phai dung cung `JWT_SECRET`, `MONGODB_URI` va `MONGODB_DB` de xac minh dung tai khoan va quyen vao phong.

Nguoi dung phai dong y hoac dang nhap thi frontend moi gui thong tin truy cap.

## API module da co

- `GET /api/platform/summary`
- `GET /api/modules/:moduleId/items`
- `POST /api/modules/:moduleId/items`
- `GET /api/modules/:moduleId/actions`
- `POST /api/modules/:moduleId/actions`
- `GET /api/store/products`
- `POST /api/store/orders`
- `POST /api/helpdesk/tickets`
- `GET /api/helpdesk/tickets`
- `POST /api/storage/files`
- `GET /api/storage/files`
- `POST /api/notifications/subscribe`
- `GET /api/admin/overview` voi `Authorization: Bearer ADMIN_TOKEN`

Luu y: Store hien tao order `pending_manual_payment`, chua thu tien that. Cloud Storage hien luu payload nho, file lon can S3/R2/GridFS. Email/push/Discord/Telegram can provider key rieng truoc khi gui that.
