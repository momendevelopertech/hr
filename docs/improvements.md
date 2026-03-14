# Improvement Plan (Actionable)

This document lists prioritized improvements and tracks what has been implemented.

## Critical Issues

- Stop unauthorized background polling after logout or session expiry.
- Ensure CSRF + cookie settings are consistent across environments.
- Add basic unit coverage for shared normalization logic.

## Security Fixes

- Enforce HttpOnly cookies for auth tokens (already in place).
- Ensure `CSRF_SECRET` and `REFRESH_TOKEN_SECRET` are set in production.
- Add health checks and monitoring for auth/refresh failures.
- Consider configuring strict `CSP` and request logging in production.

## Performance Optimizations

- Avoid background polling when unauthenticated.
- Prefer incremental refresh (Pusher) over frequent polling where possible.
- Remove unused frontend dependencies to reduce bundle size.

## Refactoring Tasks

- Extract duplicated search-normalization logic into a shared package.
- Consolidate background refresh logic into a shared hook.
- Standardize pagination and filtering across list screens.

## Testing Improvements

- Add unit tests for shared utilities.
- Add API integration tests for list endpoints with pagination.
- Introduce frontend smoke tests (Playwright) for login + dashboard.

## Implemented Changes (This Pass)

- Suppressed auth errors in background refresh handlers to avoid console spam.
- Added `search-normalization` unit tests in the API.
- Extended architecture, API, and operations documentation.
