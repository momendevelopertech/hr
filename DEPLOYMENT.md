# Deployment Guide

## Prerequisites

1. PostgreSQL with PostGIS enabled.
1. Redis instance.
1. Cloudinary account.
1. SMTP credentials for email.
1. WHAPI token for WhatsApp.
1. RSA keys for JWT (RS256).

## Environment

Set the required variables in `.env`:

`DATABASE_URL`  
`REDIS_URL`  
`JWT_PRIVATE_KEY`  
`JWT_PUBLIC_KEY`  
`CLOUDINARY_CLOUD_NAME`  
`CLOUDINARY_API_KEY`  
`CLOUDINARY_API_SECRET`  
`WHAPI_TOKEN`  
`MAIL_HOST`  
`MAIL_PORT`  
`MAIL_USER`  
`MAIL_PASS`  
`FRONTEND_URL`  
`NEXT_PUBLIC_API_URL`  
`NEXT_PUBLIC_PUSHER_KEY`  
`NEXT_PUBLIC_PUSHER_CLUSTER`  
`PUSHER_APP_ID`  
`PUSHER_KEY`  
`PUSHER_SECRET`  
`PUSHER_CLUSTER`  
`CSRF_SECRET`  

## Local Run (Without Docker)

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Frontend: `http://localhost:3000`  
API: `http://localhost:3001/api`  
Swagger: `http://localhost:3001/api/docs`

If Redis is down locally, API will continue working with cache disabled.

## Docker Run

```bash
docker compose up --build -d
```

## Vercel (Frontend)

Deploy `apps/web` on Vercel.

Set in Vercel project env vars:

- `NEXT_PUBLIC_API_URL=https://<your-api-domain>/api`
- `NEXT_PUBLIC_PUSHER_KEY=your_pusher_key`
- `NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster`

## Backend Deployment

Deploy `apps/api` separately (Render/Railway/Fly.io/VM).  
Do not deploy Nest API on the same Vercel frontend project.

## Notes

1. For production, use real TLS termination and rotate secrets regularly.
1. Ensure `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are set; the API will refuse to start in production without them.
