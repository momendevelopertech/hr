# SPHINX HR System

Enterprise HR Management System for SPHINX. The stack is a Next.js 14 app with a NestJS API, Prisma, PostgreSQL, Redis, Socket.io, and Cloudinary uploads. The system supports Arabic (RTL) and English (LTR), PWA installation, and real-time notifications.

## Monorepo Structure

`apps/web` Next.js frontend  
`apps/api` NestJS backend  

## Quick Start (Local)

1. Copy `.env.example` to `.env` and fill secrets.
1. Install dependencies from repo root.
1. Start services.

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

## Docker

```bash
docker compose up --build
```

## Default Logins (Seed)

Super Admin: `superadmin@sphinx.com` / `Admin@123456`  
HR Admin: `hradmin@sphinx.com` / `HrAdmin@123`  
Manager: `manager@sphinx.com` / `Manager@123`  
Employee: `employee@sphinx.com` / `Emp@123456`  

## Notes

The API is available at `http://localhost:3001/api` and Swagger docs at `http://localhost:3001/api/docs`. The web app runs on `http://localhost:3000`.
