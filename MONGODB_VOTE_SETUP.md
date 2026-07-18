# Ket noi vote voi MongoDB Atlas

GitHub Pages chi chay HTML/CSS/JS tinh, khong the ket noi truc tiep MongoDB an toan.
Repo nay da co san API serverless trong `api/votes.js` de deploy len Vercel.

## Buoc 1: Lay MongoDB connection string

Trong MongoDB Atlas:

1. Vao cluster cua ban.
2. Chon `Connect`.
3. Chon `Drivers`.
4. Copy connection string dang:
   `mongodb+srv://USER:PASSWORD@cluster...mongodb.net/?retryWrites=true&w=majority`
5. Voi cluster hien tai cua ban, template dang la:
   `mongodb+srv://dungnguyen29082000_db_user:<db_password>@cluster0.k6k6m13.mongodb.net/?appName=Cluster0`
6. Thay `<db_password>` bang password that cua database user `dungnguyen29082000_db_user`.

Khong dua connection string nay vao HTML, GitHub, hoac chat cong khai.

## Buoc 2: Deploy backend len Vercel

1. Import repo `hoangdaika13.github.io` vao Vercel.
2. Them Environment Variables:
   - `MONGODB_URI`: connection string MongoDB Atlas
   - `MONGODB_DB`: `hoangdaika13_site`
   - `MONGODB_COLLECTION`: `votes`
   - `SITE_ID`: `nhhoang13all.xyz`
   - `ALLOWED_ORIGIN`: `https://nhhoang13all.xyz`
3. Deploy.
4. API se co dang:
   `https://ten-du-an-vercel.vercel.app/api/votes`

## Buoc 3: Gan API vao web GitHub Pages

Mo `config.js` va sua:

```js
window.HH_VOTE_API_URL = "https://ten-du-an-vercel.vercel.app/api/votes";
```

Sau do commit va Push origin.

## Kiem tra

Mo:

`https://ten-du-an-vercel.vercel.app/api/votes`

Neu tra ve:

```json
{"likes":0,"votes":[0,0,0,0,0]}
```

la backend da ket noi MongoDB thanh cong.
