# Notifications Test Notes

## Verified successfully

- Targeted notification tests passed:
  - `src/notifications/notifications.service.spec.ts`
  - `src/notifications/email.service.spec.ts`
  - `src/notifications/whatsapp.service.spec.ts`
- API build passed with `npx nest build`
- Database schema was pushed successfully with:
  - `npx prisma db push --schema apps/api/prisma/schema.prisma`

## Manual environment issue detected

The live SMTP verification using the currently provided mailbox credentials failed with:

- `535 Authentication Failed`

## What to check

1. Confirm the mailbox app password is still valid for the sender mailbox.
   - The password was intentionally not left in the tracked `.env` file.
2. Confirm the intended SMTP provider:
   - If you want direct Zoho SMTP, verify host/port/security for your Zoho region.
   - If you want SendPulse SMTP, replace the SMTP env values with the SendPulse SMTP credentials instead of the mailbox app password.
3. Confirm SMTP access is enabled for the mailbox and not restricted by policy/IP.

## Current code state

The backend is ready for SMTP once valid credentials are supplied. No code change should be needed after correcting the mail configuration.
