# Security Assessment Report (Employee Account)

- **Target**: `https://hr-web-ten.vercel.app/`
- **Assessment date**: 2026-03-14
- **Account role tested**: `EMPLOYEE` (Alexandria ERC)
- **Method**: Authenticated black-box testing from browser session + direct API calls using authenticated cookies.
- **Scope note**: This is an application-layer access-control check, not a full penetration test.

## Executive Summary

The tested employee account did **not** gain unauthorized access to known admin/user-management API routes in this session. Main authorization checks looked correct for key endpoints (e.g., `/api/users` returned `403`). However, there are still hardening opportunities around route discoverability, endpoint consistency, and broader abuse protection (rate limiting, centralized authorization enforcement, anomaly logging).

## What was validated

### 1) Authentication and session

- Login with provided employee credentials succeeded.
- Sessionized API calls became available after login (`/api/auth/me`, `/api/leaves`, `/api/permissions`, etc.).

### 2) Access to admin or other employees' data

- `GET /api/users` returned **403 Insufficient permissions** for employee user.
- Guessed admin routes such as `/en/admin`, `/en/dashboard/admin`, `/en/settings/users` were not accessible as admin pages (404 in this deployment).
- `GET /api/chat/chats` returned only chat metadata visible to this user (e.g., HR Admin contact name/role), with no obvious bulk employee directory leak and no email list exposed in tested views.

### 3) Attempted parameter tampering

- Query tampering using `userId` on employee-scoped endpoints (`/api/leaves`, `/api/permissions`) did not return another user's records in this check (responses still reflected the logged-in account data).

## Findings

## Finding A — No direct privilege escalation observed (good)

- **Severity**: Informational
- Employee session could not call admin user list endpoint (`/api/users` -> `403`).
- This indicates role checks are present on at least critical route(s).

## Finding B — Endpoint/path behavior discloses framework/backend structure

- **Severity**: Low
- API responses expose structured backend error payloads including `statusCode`, `path`, `timestamp`.
- While common and useful in development, production should avoid overly revealing internals where possible.

## Finding C — Hardening still recommended despite passing checks

- **Severity**: Medium (defense-in-depth)
- No bypass was found in quick tests, but this does not guarantee absence of IDOR/BOLA on untested endpoints.
- Employee-facing endpoints should explicitly ignore user-controlled ownership parameters and always scope by authenticated user server-side.

## Recommendations

1. **Enforce server-side authorization centrally**
   - Use middleware/guards for role + resource ownership checks on every protected endpoint.
   - Keep deny-by-default policy for new routes.

2. **IDOR/BOLA prevention controls**
   - Never trust `userId` from query/body for employee role.
   - Derive effective user from session/JWT claims on server.
   - Add automated authorization tests for each endpoint and role matrix.

3. **Reduce production error detail**
   - Keep detailed stack/path metadata in logs only.
   - Return minimal client-safe error responses.

4. **Abuse protections**
   - Add login and password-reset rate limiting, IP throttling, and lockout strategy.
   - Add anomaly logging/alerts for repeated forbidden access attempts.

5. **Data minimization in responses**
   - Return only fields required by UI (especially in chat/user payloads).
   - Avoid sending emails/PII unless strictly needed.

## Suggested next test wave

- Role-by-role authorization regression suite (EMPLOYEE / MANAGER / HR_ADMIN / SUPER_ADMIN).
- Forced browsing of all known routes from frontend bundle map.
- API fuzzing for insecure object references across IDs, UUIDs, and pagination cursors.
- Session security checks (token rotation, refresh invalidation, logout revocation).

