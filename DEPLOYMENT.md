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
`NEXT_PUBLIC_SOCKET_URL`  
`CSRF_SECRET`  

## Build and Run

```bash
docker compose up --build -d
```

## Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

## Notes

1. For production, use real TLS termination and rotate secrets regularly.
1. Ensure `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are set; the API will refuse to start in production without them.
