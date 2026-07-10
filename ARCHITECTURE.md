# Hoangdaika13 Neon Portfolio Architecture

Trang web hien tai la portfolio tinh chay tren GitHub Pages, co them API vote tren Vercel va backend realtime rieng trong `realtime-server`.

## Nguyen tac thiet ke

- Trang chu la profile chinh: hero, thong tin lien he, vote, am nhac va danh sach du an.
- Moi tool lon nam rieng trong `projects/<ten-du-an>/` de khong lam roi man hinh chinh.
- Giao dien dung chung phong cach: nen toi, vien 2px, radius 8px, hong neon lam mau chinh, cyan/vang lam mau phu.
- Cac phan can backend that phai hien ro trang thai cau hinh, khong gia vo da chay neu chua co URL backend.

## Module hien co

- `index.html`: trang chu portfolio va cac khoi vote, tai khoan, lien he, nhac nen.
- `script.js`: hieu ung neon, vote MongoDB API, form, am nhac, realtime auth client.
- `styles.css`: theme chung va style rieng cho tung tool.
- `api/votes.js`: API vote/like deploy Vercel, dung MongoDB Atlas.
- `realtime-server/`: server Node.js rieng cho Socket.io, dang ky/dang nhap, OAuth Google/Facebook va tracking co xin phep.

## Backend that

GitHub Pages chi host HTML/CSS/JS tinh. Cac tinh nang sau can backend:

- Like/vote dong bo: da co Vercel endpoint `window.HH_VOTE_API_URL`.
- Online users, login, register, OAuth, event log: can deploy `realtime-server` len Render/Railway/Fly.io/VPS roi gan `window.HH_REALTIME_URL`.
- Admin xem event: goi `GET /api/admin/events` voi `Authorization: Bearer <ADMIN_TOKEN>`.

## Them module moi

1. Tao thu muc rieng trong `projects/` neu la tool lon.
2. Dung class CSS co tien to rieng, tranh selector global.
3. Giu layout theo token chung: nen toi, glow hong/cyan, button `.button`, card radius 8px.
4. Neu module can database/API, tao UI + thong bao cau hinh truoc, sau do moi noi backend.
