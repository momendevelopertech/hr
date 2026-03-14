# API Documentation

## Base URL

- Local API: `http://localhost:3001/api`
- Swagger (dev only): `http://localhost:3001/api/docs`

## Authentication and CSRF

- Auth uses HttpOnly cookies (`access_token`, `refresh_token`).
- Mutating requests require `X-CSRF-Token`.
- Retrieve CSRF token with `GET /auth/csrf`.

## Error Format

All errors follow a consistent JSON shape:

```json
{
  "statusCode": 400,
  "message": "Validation error",
  "path": "/api/...",
  "timestamp": "2026-03-14T00:00:00.000Z"
}
```

## Modules and Key Routes

### Auth

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `GET /auth/me`
- `GET /auth/csrf`

### Users

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/leave-balance`
- `POST /users/:id/reset-data`
- `DELETE /users/:id`
- `GET /users/:id/stats`
- `GET /users/:id/history`

### Departments and Branches

- `GET /departments`
- `POST /departments`
- `PATCH /departments/:id`
- `DELETE /departments/:id`
- `GET /branches`

### Leaves and Permissions

- `GET /leaves`
- `GET /leaves/balances`
- `GET /leaves/absence-deductions`
- `POST /leaves`
- `PATCH /leaves/:id`
- `PATCH /leaves/:id/approve`
- `PATCH /leaves/:id/reject`
- `PATCH /leaves/:id/cancel`
- `POST /leaves/:id/duplicate`
- `DELETE /leaves/:id`

- `GET /permissions`
- `GET /permissions/cycle`
- `POST /permissions`
- `PATCH /permissions/:id`
- `PATCH /permissions/:id/approve`
- `PATCH /permissions/:id/reject`
- `PATCH /permissions/:id/cancel`
- `POST /permissions/:id/duplicate`
- `DELETE /permissions/:id`

### Forms

- `GET /forms`
- `POST /forms`
- `PATCH /forms/:id`
- `DELETE /forms/:id`
- `POST /forms/:id/submit`
- `GET /forms/submissions`
- `PATCH /forms/submissions/:id`
- `PATCH /forms/submissions/:id/approve`
- `PATCH /forms/submissions/:id/reject`
- `PATCH /forms/submissions/:id/cancel`
- `POST /forms/submissions/:id/duplicate`
- `DELETE /forms/submissions/:id`

### Notifications, Chat, Notes, Lateness

- `GET /notifications`
- `GET /notifications/unread`
- `PATCH /notifications/read-all`
- `PATCH /notifications/read/:id`
- `PATCH /notifications/read-type/:type`
- `POST /notifications/announcement`
- `POST /notifications/payroll`

- `GET /chat/chats`
- `GET /chat/employees`
- `GET /chat/conversation/:id`
- `POST /chat/messages`
- `PATCH /chat/messages/read/:id`

- `GET /notes`
- `POST /notes`

- `GET /lateness`
- `POST /lateness`
- `POST /lateness/:id/convert`

### Reports and PDFs

- `GET /reports/leaves`
- `GET /reports/permissions`
- `GET /reports/forms`
- `GET /reports/employee-summary`
- `GET /reports/pending`
- `GET /reports/summary`
- `GET /reports/leaves/excel`
- `GET /reports/permissions/excel`

- `GET /pdf/leave/:id`
- `GET /pdf/permission/:id`
- `GET /pdf/form/:id`

## Pagination and Filtering

Most list endpoints accept:

- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `from` / `to` for date filters (YYYY-MM-DD)
- `status`, `departmentId`, `governorate` and module-specific filters

Example:

```
GET /users?page=1&limit=50&status=active&search=alex
```

## Common Response Shapes

Paginated:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

## Authorization Rules

- `SUPER_ADMIN` and `HR_ADMIN` have global visibility.
- `MANAGER` and `BRANCH_SECRETARY` are scoped to their department/branch.
- Endpoints without explicit `@Roles` typically require authentication.

## Rate Limiting

The API applies rate limits globally via Nest Throttler. Sensitive endpoints like login and reset-password are further guarded by `ThrottlerGuard`.

## Error Codes

- `401` Unauthorized: missing/expired auth.
- `403` Forbidden: role or CSRF failure.
- `404` Not found: missing record.
- `429` Too many requests: throttled.
- `5xx` Internal server error.
