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


## Test Accounts

| Role | Email | Username | Password |
|---|---|---|---|
| SUPER_ADMIN | `superadmin@sphinx.com` | `super-admin` | `Admin@123456` |
| HR_ADMIN | `hradmin@sphinx.com` | `hr-admin` | `HrAdmin@123` |
| SECRETARY (Alexandria) | `secretary.alex@sphinx.com` | `secretary-alex` | `Sec@123` |
| SECRETARY (Cairo) | `secretary.cairo@sphinx.com` | `secretary-cairo` | `Sec@123` |
| MANAGER (Alexandria ERC) | `manager.alex.erc@sphinx.com` | `manager-alex-erc` | `Manager@123` |
| MANAGER (Alexandria SPHINX) | `manager.alex.sphinx@sphinx.com` | `manager-alex-sphinx` | `Manager@123` |
| MANAGER (Cairo ERC) | `manager.cairo.erc@sphinx.com` | `manager-cairo-erc` | `Manager@123` |
| MANAGER (Cairo SPHINX) | `manager.cairo.sphinx@sphinx.com` | `manager-cairo-sphinx` | `Manager@123` |
| EMPLOYEE (Alexandria ERC) | `momen.alex.erc@sphinx.com` | `momen-alex-erc` | `Emp@123456` |
| EMPLOYEE (Alexandria ERC) | `ahmed.alex.erc@sphinx.com` | `ahmed-alex-erc` | `Emp@123456` |
| EMPLOYEE (Alexandria ERC) | `sara.alex.erc@sphinx.com` | `sara-alex-erc` | `Emp@123456` |
| EMPLOYEE (Alexandria SPHINX) | `ali.alex.sphinx@sphinx.com` | `ali-alex-sphinx` | `Emp@123456` |
| EMPLOYEE (Alexandria SPHINX) | `nada.alex.sphinx@sphinx.com` | `nada-alex-sphinx` | `Emp@123456` |
| EMPLOYEE (Cairo ERC) | `khaled.cairo.erc@sphinx.com` | `khaled-cairo-erc` | `Emp@123456` |
| EMPLOYEE (Cairo ERC) | `mariam.cairo.erc@sphinx.com` | `mariam-cairo-erc` | `Emp@123456` |
| EMPLOYEE (Cairo SPHINX) | `omar.cairo.sphinx@sphinx.com` | `omar-cairo-sphinx` | `Emp@123456` |

> Note: database enum uses `BRANCH_SECRETARY` as the internal role for Secretary accounts.


## Notes

The API is available at `http://localhost:3001/api` and Swagger docs at `http://localhost:3001/api/docs`. The web app runs on `http://localhost:3000`.
