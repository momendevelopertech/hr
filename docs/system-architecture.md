# System Architecture

## Overview

SPHINX HR is a monorepo with a Next.js 14 frontend (`apps/web`) and a NestJS API (`apps/api`). The backend uses Prisma with PostgreSQL as the primary datastore, Redis for caching, Pusher for real-time updates, and Cloudinary for file uploads. The frontend is multilingual (Arabic RTL and English LTR) and uses cookie-based authentication with CSRF protection.

## Architecture Pattern

- Backend: Modular, layered NestJS architecture (controllers → services → Prisma data access).
- Frontend: Next.js App Router with page-level routing and client components for interactive screens.
- Cross-cutting concerns: centralized error handling, RBAC, audit logging, notifications, and caching.

## High-Level Data Flow

Browser
→ Next.js (UI, i18n, API client)
→ NestJS API (`/api`)
→ PostgreSQL (core data)
→ Redis (cache)
→ Pusher (realtime)
→ Cloudinary (uploads)

## Backend Modules and Responsibilities

- `auth`: Login, refresh, logout, password reset, CSRF token issuance.
- `users`: User CRUD, stats, history, leave balance updates, deactivation.
- `departments`: Department CRUD and branch linkage.
- `branches`: Branch listing for filtering and assignment.
- `leaves`: Leave requests and balances, workflow approvals.
- `permissions`: Permission requests and cycle tracking.
- `forms`: Dynamic form builder and submissions workflow.
- `notifications`: In-app notifications and broadcast events.
- `chat`: Internal messaging and unread counts.
- `reports`: Aggregated reports and Excel exports.
- `settings`: Work schedule settings and global data reset.
- `lateness`: Lateness entries and conversion to permissions.
- `notes`: Personal notes attached to employees.
- `audit`: Security and activity logs.
- `pdf`: PDF rendering for request records.
- `cloudinary`: File uploads and media handling.
- `redis`: Cache access and helpers.

## Frontend Areas

- `app/[locale]`: Page routes (dashboard, requests, employees, departments, forms, reports, settings, notifications, chat).
- `components`: Feature clients and shared UI blocks.
- `lib`: API client, auth helpers, search normalization, Pusher hooks.
- `messages`: i18n strings for Arabic and English.

## Core Workflows

### Authentication

1. Client requests `GET /auth/csrf`.
2. Client sends credentials to `POST /auth/login`.
3. API sets `access_token` and `refresh_token` HttpOnly cookies.
4. Client uses cookies for authenticated calls.
5. On `401`, client calls `POST /auth/refresh` and retries.

### Leave and Permission Requests

1. Employee submits request.
2. Secretary verifies.
3. Manager approves.
4. HR finalizes.
5. Notifications and audit logs are generated at each step.

### Notifications

- Server creates in-app notifications per event.
- Pusher sends realtime updates to relevant users.

### Reports

- API computes filtered datasets.
- Excel exports generated server-side.

## Runtime Topology

**Web**
- Next.js app served by Vercel (edge + serverless).
- Static assets and PWA service worker delivered from `apps/web/public`.

**API**
- NestJS app running behind a reverse proxy.
- Prisma connects to PostgreSQL.
- Redis used for cache and rate-limit storage.
- Pusher for real-time updates.
- Cloudinary for uploads.
- Email/WhatsApp providers for notifications.

## Data Flow Details

### Auth Flow (Cookie + CSRF)
1. Client calls `GET /auth/csrf` to fetch a CSRF token and store it in memory.
2. Client posts credentials to `POST /auth/login` with `X-CSRF-Token`.
3. API sets `access_token` and `refresh_token` HttpOnly cookies.
4. Client performs authenticated calls using cookies.
5. On `401`, client calls `POST /auth/refresh` and retries.

### Requests & Approvals
1. Employee submits leave/permission/form request.
2. Secretary verifies.
3. Manager approves.
4. HR finalizes.
5. Audit log + notifications emitted at each step.

### Reporting
1. Frontend requests filtered reports with pagination.
2. API aggregates data and applies role-based scoping.
3. Excel exports are generated server-side on demand.

## Key Architecture Decisions

- Cookie-based auth to reduce token exposure in the browser.
- CSRF protection for all mutating endpoints.
- RBAC enforced at controller level via guards.
- Prisma used as a data access layer (thin ORM abstraction).
- Redis-based caching for frequently accessed reports and lists.
- Pusher-based real-time notifications to reduce polling needs.

## Inconsistencies and Open Decisions

- Search normalization logic exists in both API and web (`search-normalization.ts`). Consider extracting to a shared package.
- Background polling in several pages could be centralized via a single data refresh manager.
- Both `react-query` and `@tanstack/react-query` are listed as dependencies but are not used in the UI code.

## Error Handling and Observability

- Backend uses a global exception filter for consistent JSON error responses.
- Frontend wraps API errors into `AppApiError` for consistent handling.
- Recommend adding structured request logging and optional tracing in production.

