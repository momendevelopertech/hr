# Operations and Development

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Provide database, Redis, Cloudinary, email, and WhatsApp credentials.
3. Set `FRONTEND_URL` and public API settings for the web app.

Critical environment variables are documented in `DEPLOYMENT.md`.

## Local Development

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Swagger (dev): `http://localhost:3001/api/docs`

For local WhatsApp / Evolution recovery after a reboot, see `docs/whatsapp-evolution-runbook.md`.

## Deployment Process

- Frontend: deploy `apps/web` to Vercel.
- Backend: deploy `apps/api` to Render/Railway/Fly.io/VM.
- Use HTTPS in production and enable secure cookies.

## Development Guidelines

- Keep controllers thin; put business logic in services.
- Prefer DTOs for validation and consistent inputs.
- Use `AuditService` for security-sensitive operations.
- Use i18n messages from `messages/en.json` and `messages/ar.json`.
- Avoid hard-coded text in UI and services.

## Error Handling Strategy

- API uses `HttpExceptionFilter` for consistent JSON errors.
- Frontend wraps API errors in `AppApiError` to standardize messages.
- Always prefer structured errors over raw strings.

## Security Considerations

- Cookie auth with CSRF protection is required for mutating requests.
- RBAC is enforced via `RolesGuard`.
- Use `AUTH_COOKIE_MODE`, `AUTH_COOKIE_DOMAIN`, and `AUTH_COOKIE_SAMESITE` to align with deployment.
- Set `REFRESH_TOKEN_SECRET` to a strong random value to hash refresh tokens at rest.
- Refresh sessions are bound to IP and user-agent; changes will require re-login.
- Rotate secrets regularly and keep them out of git.
- Rate limits are controlled through Nest Throttler.
- Report endpoints can be cached with `REPORTS_CACHE_TTL` (seconds).

For deeper guidance, see `docs/auth-cookie-hardening.md`.

## Environment Variables (Required)

Backend:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
- `REFRESH_TOKEN_SECRET`
- `CSRF_SECRET`
- `FRONTEND_URL`
- `AUTH_COOKIE_MODE`, `AUTH_COOKIE_DOMAIN`, `AUTH_COOKIE_SAMESITE`
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
- `CLOUDINARY_URL` (or cloud name/key/secret)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (email)

Frontend:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_VERSION` (optional, used for cache invalidation)
- `NEXT_PUBLIC_PWA_DEBUG` (optional)

## Deployment Checklist

- Run database migrations and seed if required.
- Verify CORS origins match `FRONTEND_URL`.
- Validate cookies are secure and SameSite configured for production.
- Ensure `NODE_ENV=production` and logging level is correct.
- Confirm Redis connectivity for cache and rate limiting.

## Monitoring & Logging

- Enable structured logs on the API (HTTP + background jobs).
- Track 4xx/5xx rates and response latency.
- Add uptime checks for `/api/health` (consider adding a health route).
- Add error tracking (Sentry/Datadog) in both web and API.

## Development Guidelines (Extended)

- Prefer adding a DTO + validator for any new request input.
- Keep Prisma queries scoped and paginated.
- Do not store tokens in localStorage; rely on HttpOnly cookies.
- Avoid adding new background polling; prefer Pusher events or WebSocket.
