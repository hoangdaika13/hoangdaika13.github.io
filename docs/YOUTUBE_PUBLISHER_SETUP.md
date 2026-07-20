# HH YouTube Publisher setup

The publisher uploads video bytes directly from the visitor's device to YouTube over HTTPS. The Vercel API only creates OAuth and resumable upload sessions, so large video files do not pass through Vercel.

## 1. Google Cloud

1. Open the Google Cloud project used by HH Platform.
2. Enable **YouTube Data API v3**.
3. Open **Google Auth Platform > Data Access** and add:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
4. Open the Web OAuth client and add this exact authorized redirect URI:

   `https://hoangdaika13githubio.vercel.app/api/youtube/oauth/callback`

5. Add the site domains and required developer contact information to the OAuth consent screen.
6. Move the app to production when it is ready for users. Google may require OAuth verification for public access to YouTube scopes.

## 2. Vercel environment variables

Add these variables to Production, Preview, and Development, then redeploy:

```text
GOOGLE_CLIENT_ID=<web OAuth client id>
GOOGLE_CLIENT_SECRET=<web OAuth client secret>
YOUTUBE_CALLBACK_URL=https://hoangdaika13githubio.vercel.app/api/youtube/oauth/callback
YOUTUBE_TOKEN_ENCRYPTION_KEY=<at least 32 random characters>
MONGODB_URI=<MongoDB Atlas connection string>
MONGODB_DB=hoangdaika13_site
JWT_SECRET=<existing HH authentication secret>
PUBLIC_SITE_URL=https://nhhoang13all.xyz
FRONTEND_URL=https://nhhoang13all.xyz
```

Generate the encryption secret locally with PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Never put `GOOGLE_CLIENT_SECRET`, refresh tokens, or `YOUTUBE_TOKEN_ENCRYPTION_KEY` in browser JavaScript or Git.

## 3. Google and YouTube constraints

- Scheduled publishing is sent as a private video with a future `status.publishAt` value.
- Uploads from an unverified API project may remain private until the project completes YouTube's API audit.
- A custom thumbnail requires a channel that is eligible to upload custom thumbnails.
- The UI can pause and resume uploads by querying the last byte accepted by YouTube's resumable upload endpoint.
- Users must upload only media they own or are authorized to publish.
