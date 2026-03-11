# Chat Module Integration Notes

## Backend
1. Generate prisma client after pulling changes:
   - `npm run -w apps/api prisma:generate`
2. Apply schema updates to DB:
   - `npm run -w apps/api prisma:push`
3. Run API:
   - `npm run -w apps/api dev`

### REST Endpoints
- `GET /api/chat/employees?search=`
- `GET /api/chat/chats`
- `GET /api/chat/conversation/:employeeId`
- `POST /api/chat/messages`
- `PATCH /api/chat/messages/read/:employeeId`

### Realtime Events (Pusher)
- Channel: `user-{userId}`
- Events:
  - `receive_message`
  - `message_read`

## Frontend
1. Run web app:
   - `npm run -w apps/web dev`
2. Open:
   - `/en/chat` or `/ar/chat`

The chat page appears in nav and supports employee search, unread counts, conversation history, and realtime messaging.
