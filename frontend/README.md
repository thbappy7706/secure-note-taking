# Secure Notes frontend

React 19 + Vite single-page app for the secure note-taking API. Node.js 22.

Features: register/login, personal note CRUD with pagination, and — for admins — user
management, all-notes view, users grouped by interests, and posts lookup.

## Local development

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:5173
```

The app reads the API base URL from `VITE_API_BASE_URL` (default
`http://localhost:4000/api`). Start the backend from `../backend` on port 4000 first, and
make sure its `CORS_ORIGINS` includes `http://localhost:5173`.

## Production build

```bash
npm run build      # writes dist/
npm run preview    # serve the build locally on :4173
```

## Deploy to Vercel

1. Push this folder to its own GitHub repository (or import the monorepo and set the
   **Root Directory** to `frontend`).
2. Import the repository in Vercel. Vite is auto-detected; `vercel.json` sets the build
   command, output directory and SPA rewrite.
3. Add the environment variable:
   `VITE_API_BASE_URL=https://<your-backend>.onrender.com/api`
4. Deploy. Copy the production URL and add it to the backend's `CORS_ORIGINS`.

## Deploy to Netlify

1. **Add new site → Import an existing project**, choose the repository.
2. Base directory `frontend` (if using the monorepo), build `npm run build`, publish
   `dist` — `netlify.toml` already declares these.
3. Add `VITE_API_BASE_URL` under **Site settings → Environment variables**.
4. Deploy, then add the Netlify URL to the backend's `CORS_ORIGINS`.

Every Vercel/Netlify preview deployment has a different origin. Add preview URLs to
`CORS_ORIGINS` (comma separated) or use a stable production URL only.
