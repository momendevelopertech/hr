# Notifications Delivery Setup

## Required steps after pulling these changes

1. Run `npm run db:generate`
2. Run `npm run db:push`
3. Restart the API server

Run these commands from the repository root so Prisma can read the root `.env` file.

## Recommended SMTP environment variables

The backend now reads SMTP settings from `.env` using these variables:

- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_SECURE`
- `MAIL_REQUIRE_TLS`
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `SENDER_EMAIL`
- `SENDER_NAME`
- `MAIL_POOL_MAX_CONNECTIONS`
- `MAIL_POOL_MAX_MESSAGES`
- `MAIL_TLS_REJECT_UNAUTHORIZED`

## Notes

- `MAIL_FROM` has priority over `SENDER_EMAIL` and `SENDER_NAME`.
- If `MAIL_FROM` is empty, the app falls back to `SENDER_NAME <SENDER_EMAIL>`.
- Delivery logs are stored in the new `NotificationDelivery` table.
- If the database schema is not updated yet, external sending still works, but delivery logs will be skipped until `db:push` is executed.
- WhatsApp still uses the existing Evolution API configuration from env or settings.

## Optional provider swap

The implementation is SMTP-based so you can point it to Zoho SMTP, SendPulse SMTP, or another SMTP provider just by changing the mail env values.
