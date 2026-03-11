# SPHINX HR System

Enterprise HR Management System for SPHINX. The stack is a Next.js 14 app with a NestJS API, Prisma, PostgreSQL, Redis, Pusher Channels, and Cloudinary uploads. The system supports Arabic (RTL) and English (LTR), PWA installation, and real-time notifications.

## Monorepo Structure

`apps/web` Next.js frontend  
`apps/api` NestJS backend  

## Quick Start (Local)

1. Copy `.env.example` to `.env` and fill secrets.
1. Install dependencies from repo root.
1. Prepare database.
1. Run frontend and backend.

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

If Redis is not available locally, the API now falls back to direct DB reads (cache disabled), so core endpoints still work.

## Docker

```bash
docker compose up --build
```

## Vercel

Deploy `apps/web` to Vercel as the frontend app.

Required Vercel environment variables:

- `NEXT_PUBLIC_API_URL` (your deployed API URL + `/api`)
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`

The NestJS API (`apps/api`) should be deployed as a separate service (for example Render/Railway/Fly.io) because it needs a long-running Node server, PostgreSQL, and Redis.

## Default Logins (Seed)

Super Admin: `superadmin@sphinx.com` / `Admin@123456`  
HR Admin: `hradmin@sphinx.com` / `HrAdmin@123`  
Manager: `manager@sphinx.com` / `Manager@123`  
Employee: `employee@sphinx.com` / `Emp@123456`  

## Notes

The API is available at `http://localhost:3001/api` and Swagger docs at `http://localhost:3001/api/docs`. The web app runs on `http://localhost:3000`.
