# internly

A weekly working journal for your internship, with a reminder to reflect every week.

## Tech stack

| Part | Choice |
|---|---|
| Backend | NestJS, TypeORM, PostgreSQL |
| Frontend | React (Vite), TanStack Query, Tailwind CSS |
| Notes editor | TipTap |
| Auth | Google OAuth 2.0 (Passport), JWT in an httpOnly cookie |
| Tests | Vitest (unit + e2e against a real test database), Playwright for UI checks |

## Infrastructure

| Service | Used for |
|---|---|
| [Render](https://render.com) | Hosting: one web service, where NestJS serves the built React app |
| [Neon](https://neon.tech) | PostgreSQL (separate dev, test and prod databases) |
| Google Cloud | OAuth client for sign-in |
| [Cloudinary](https://cloudinary.com) | Image uploads in notes |
| [Resend](https://resend.com) | The Friday reminder email |
| [OpenRouter](https://openrouter.ai) | Free AI models for the "refine" button |

## Project structure

```
internly/
├── api/                    NestJS backend
│   ├── src/
│   │   ├── auth/           Google login
│   │   ├── internship/     internship setup and weeks
│   │   ├── tasks/          tasks and carry-over
│   │   ├── reflection/     weekly reflection
│   │   ├── notes/          notes and image upload
│   │   ├── email/          Friday reminder email
│   │   ├── ai/             refine endpoint
│   │   └── migrations/     database migrations
│   └── test/               e2e tests
├── web/                    React frontend
│   └── src/                pages, components, styles
├── package.json            build/start scripts used by Render
└── .env.example            environment variables
```

## Run it locally

You need Node 24 and two PostgreSQL databases (one for dev, one that the tests may wipe). Neon's free tier works.

1. **Configure.** Copy `.env.example` to `.env` at the repo root and fill it in. Locally, `APP_ENV=development`, `APP_URL=http://localhost:5173`, and `GOOGLE_CALLBACK_URL=http://localhost:5173/api/auth/google/callback`. Add that callback URL to your Google OAuth client, and put your Gmail in `ALLOWED_EMAILS`.

2. **Install and migrate.**
   ```
   npm --prefix api install
   npm --prefix web install
   npm --prefix api run migration:run
   ```

3. **Start both servers** (two terminals):
   ```
   npm --prefix api run start:dev    # API on http://localhost:3000
   npm --prefix web run dev          # app on http://localhost:5173
   ```
   Open http://localhost:5173. Vite forwards `/api` to the API. Sign in with Google, then set up your internship (company, start and end date).

**Tests:** `npm --prefix api test` runs the unit and e2e tests against `TEST_DATABASE_URL`. It refuses to run unless `APP_ENV=development`.

**Production build:** `npm run build`, then `npm start`. This runs the migrations and serves the app and the API on one port. Render uses these same two commands.
