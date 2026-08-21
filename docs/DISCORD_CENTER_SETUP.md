# Discord Center setup

Discord Center uses two separate, official Discord identities:

- User OAuth (`identify guilds`) links an HH account and lists the servers that user belongs to.
- HH Discord Bot reads and sends messages only in servers/channels where administrators granted it access.

The website never automates a personal Discord user token and never exposes a client secret, refresh token or bot token to browser JavaScript.

## 1. Create the Discord application

1. Open <https://discord.com/developers/applications> and create an application.
2. In **OAuth2**, add this exact redirect URL:

   `https://hoang8.com/api/discord/oauth/callback`

3. Create a bot for the application.
4. Enable **Message Content Intent** only if Discord permits it for the application and channel history should include message text.

Official references:

- <https://docs.discord.com/developers/platform/oauth2-and-permissions>
- <https://docs.discord.com/developers/resources/user>
- <https://docs.discord.com/developers/resources/channel>
- <https://docs.discord.com/developers/resources/message>

## 2. Configure Vercel environment variables

Add these server-only values to Production, Preview and the environments that should support Discord:

```text
DISCORD_CLIENT_ID=<Application ID>
DISCORD_CLIENT_SECRET=<OAuth2 client secret>
DISCORD_CALLBACK_URL=https://hoang8.com/api/discord/oauth/callback
DISCORD_TOKEN_ENCRYPTION_KEY=<random secret of at least 32 characters>
DISCORD_BOT_TOKEN=<bot token>
DISCORD_MESSAGE_CONTENT_ENABLED=true
```

`DISCORD_BOT_PUBLIC_KEY` is reserved for future Discord interaction webhooks and may remain blank in the REST-first release.

After changing Vercel variables, redeploy the site. Never place these values in `config.js`, `discord-hub.js`, Git history, screenshots or support messages.

## 3. Connect and install

1. Sign in to an HH account.
2. Open `#/discord` and choose **Kết nối Discord**.
3. Approve only `identify` and `guilds`.
4. Choose **Thêm bot HH**, select a server and confirm the displayed permissions. Existing installations must run this step again after the Discord Center 2.0 upgrade so Discord can add reaction, attachment and public-thread permissions.
5. In Discord server settings, restrict the bot role and channel overrides to the channels that should be accessible from HH Platform.

Discord Center 2.0 requests only these bot capabilities: view channels, read history, send messages, embed links, attach files, add reactions, create public threads and send in threads. It does not request Administrator, Manage Server, Manage Channels, Manage Roles, Kick Members, Ban Members or View Audit Log.

The workspace supports replies, reactions, active threads, pagination, safe attachments up to 1.5 MB, editing/deleting messages created by HH Bot, per-device drafts/unread state, browser notifications and a user-scoped 90-day action ledger. Open channels use adaptive polling every 5 seconds and fall back to 12 seconds when backgrounded; this is described as Live Sync rather than Discord Gateway realtime.

Voice/video, direct messages and full Discord client embedding are intentionally not claimed. A future persistent Gateway service can add realtime events without moving bot credentials into browser code.
