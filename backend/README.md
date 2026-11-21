# Secure Note-Taking API (backend)

Express 4 + Mongoose 8 REST API. Node.js 22, JWT auth, bcrypt password hashing,
role-based access control, pagination on every list, a minimal index set and two
aggregation pipelines. The React frontend lives in a separate repository/folder and
talks to this API over CORS.

## Local setup

```bash
cp .env.example .env          # then set JWT_SECRET
npm install
npm run seed:admin -- "Admin" admin@example.com "AdminPass123!"
npm run dev                   # http://localhost:4000
```

`MONGO_URI` defaults to `mongodb://127.0.0.1:27017/secure_note_taking`.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP port |
| `MONGO_URI` | No | local MongoDB | Connection string (use MongoDB Atlas in production) |
| `JWT_SECRET` | **Yes** | – | HMAC secret for JWTs; the app refuses to boot without it |
| `JWT_EXPIRES_IN` | No | `1h` | Access-token lifetime |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing cost |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:4173` | Comma-separated allowed browser origins (`*` allows all) |

## API

Base path `/api`. Authenticated requests send `Authorization: Bearer <token>`.
Errors: `{ "error": { "message": "...", "details"?: [...] } }`.

### Auth

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | `{ name, email, password, interests? }` → user + JWT. Always a `user`. |
| `POST` | `/auth/login` | Public | `{ email, password }` → user + JWT. |

### Users

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/users/me` | Authenticated | Current profile |
| `GET` | `/users` | Admin | Paginated user list, newest first |
| `POST` | `/users` | Admin | `{ name, email, password, role?, interests? }` |
| `PATCH` | `/users/:id` | Admin | Update `name`, `email`, `password`, `role`, `interests` |
| `DELETE` | `/users/:id` | Admin | Delete user; cascades notes/posts |
| `GET` | `/users/grouped-by-interests` | Admin | Scenario 1 – users grouped by interest, paginated |
| `GET` | `/users/:id/posts` | Authenticated | Scenario 2 – a user's posts via `$lookup`, paginated |

### Notes

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/notes` | User: own; admin: all | Paginated. Admin may filter `?userId=<id>` |
| `POST` | `/notes` | Authenticated | `{ title, content }`, owner is the caller |
| `GET` | `/notes/:id` | Owner or admin | Fetch one note |
| `PATCH` | `/notes/:id` | Owner or admin | Update `title` and/or `content` |
| `DELETE` | `/notes/:id` | Owner or admin | Delete a note |

### Posts

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/posts` | Authenticated | `{ title, content }`; posts are visible to all signed-in users |

`GET /api/health` reports API/database status and is used as the Render health check.

### Pagination

Every list accepts `page` (default `1`) and `limit` (default `20`, max `100`) and returns:

```json
{
  "data": [],
  "pagination": {
    "page": 1, "limit": 20, "total": 42,
    "totalPages": 3, "hasNextPage": true, "hasPrevPage": false
  }
}
```

## Indexes (intentionally minimal)

Declared with `schema.index(...)` next to each model.

| Model | Index | Serves |
| --- | --- | --- |
| User | `{ email: 1 }` unique | Login lookup + unique accounts |
| User | `{ createdAt: -1, _id: -1 }` | Admin user list, newest first |
| User | `{ interests: 1 }` (multikey) | Scenario 1 grouping key |
| Note | `{ owner: 1, createdAt: -1, _id: -1 }` | A user's notes, admin `?userId=`, cascade delete |
| Note | `{ createdAt: -1, _id: -1 }` | Admin all-notes list, newest first |
| Post | `{ author: 1, createdAt: -1, _id: -1 }` | Scenario 2 `$lookup` foreign field + sort |

Everything fetched by `_id` uses MongoDB's built-in `_id` index. The smoke test asserts
this exact set, so an accidental extra index fails the test.

## Aggregations

- **Scenario 1** (`GET /users/grouped-by-interests`): one `User.aggregate()` call,
  `$unwind` → `$group` → `$sort` → `$facet` (data + total count) → `$project`.
- **Scenario 2** (`GET /users/:id/posts`): one pipeline with `$lookup` on `author`,
  paginating inside the lookup and using a second `$lookup` + `$count` for totals.

## Security

bcrypt cost 12, hashes never serialized (`select: false` + `toJSON`), registration cannot
self-assign admin, JWTs re-checked against the database on every request, per-row note
authorization, mandatory `JWT_SECRET`, validated inputs, 32 KB body limit, `helmet`,
`x-powered-by` disabled, API responses `Cache-Control: no-store`, admin cannot delete
themselves.

## Tests

Needs a MongoDB instance (the test drops its own database):

```bash
MONGO_URI="mongodb://127.0.0.1:27017/secure_note_taking_test" npm test
```

Covers auth, RBAC, ownership, pagination bounds, admin operations, both aggregations,
CORS, cascade deletion, the exact index set and index plans for note listings.

## Deploy to Render

1. Create a free MongoDB Atlas cluster, a database user and allow network access
   (`0.0.0.0/0` for Render's free tier). Copy the `mongodb+srv://` URI.
2. Push this folder to its own GitHub repository (see the root README for the
   `git subtree` commands if you keep the monorepo).
3. In Render: **New → Blueprint**, select the repository. `render.yaml` is detected.
   Alternatively create a Web Service with build `npm ci`, start `npm start`,
   health check `/api/health`, Node 22.
4. Set `MONGO_URI` and `CORS_ORIGINS` (your deployed frontend URL, e.g.
   `https://your-app.vercel.app`). `JWT_SECRET` is generated by the blueprint.
5. Seed an admin from your machine against Atlas:
   ```bash
   MONGO_URI="mongodb+srv://..." npm run seed:admin -- "Admin" admin@example.com "StrongPassword123"
   ```
6. Check `https://<service>.onrender.com/api/health`.

Free-tier services spin down when idle, so the first request after inactivity is slow.
