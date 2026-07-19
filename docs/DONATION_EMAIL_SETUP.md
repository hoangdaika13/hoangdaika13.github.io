# Donation confirmation email

The donation flow uses the existing `api/donations.js` Vercel Function, so it does not increase the Hobby function count.

## Production configuration

1. In payOS, configure the payment webhook as:

   `https://hoangdaika13githubio.vercel.app/api/donations?provider=payos`

2. Verify `nhhoang13all.xyz` in Resend and create a sending-only API key.
3. Add these Production environment variables in Vercel:

   - `RESEND_API_KEY`
   - `DONATION_FROM_EMAIL=Nhhoang <donate@nhhoang13all.xyz>`
   - `DONATION_REPLY_TO` (optional)
   - the existing `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`

4. Redeploy the project after changing environment variables.

## Delivery rules

- A payOS receipt is sent only after the signed webhook is valid, the order exists, and the amount matches.
- A manual transfer receipt is sent only after an authenticated owner changes the donation to `verified`.
- MongoDB holds a short delivery lease and a permanent `receipt.sentAt` marker.
- Resend receives `Idempotency-Key: donation-thanks/<donation-id>` as a second duplicate-send guard.
- Donor email is never returned by the public donation feed. The private status response only returns a masked address.
- Delivery errors never revert a verified payment; owners can retry failed delivery from the support admin panel.
