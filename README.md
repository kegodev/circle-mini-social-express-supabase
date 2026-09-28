# Circle — mini social media app

A small social platform built with HTML, CSS, JavaScript, Express.js and Supabase PostgreSQL/Auth. Includes user accounts and editable profiles, a paginated feed, posts, comments, likes and follows.

## Setup

1. The project is configured for the existing Dinglo Supabase project. Its isolated `social_` schema tables are installed there.
2. The included `.env` contains the Dinglo project URL and its public publishable key. Never put a service role or secret key there.
3. Install Node.js 20 or newer. Run `npm install`, then `npm run dev` in this folder. Visit `http://localhost:3000`.
4. In Supabase Auth settings, enable email/password. If email confirmation is on, confirm a new account via email before signing in. For local testing, configure your Auth site URL as `http://localhost:3000`.

The browser uses Supabase Auth for registration and sign-in. Every social data request goes through Express (`/api/*`), which verifies the user token and queries Supabase using that user's identity. PostgreSQL Row Level Security also enforces ownership. Public client credentials are served at `/api/config`; they are designed to be public, with RLS guarding data.

## Core routes

`GET /api/me`, `PATCH /api/me`, `GET /api/profiles?q=`, `GET /api/feed?page=`, `POST /api/posts`, `DELETE /api/posts/:id`, `POST /api/posts/:id/comments`, `DELETE /api/comments/:id`, `PUT/DELETE /api/posts/:id/like`, `GET /api/follows`, `PUT/DELETE /api/profiles/:id/follow`.

## Notes

Express creates a Circle profile on first sign-in, including for an existing Dinglo user. Users can edit the username in Profile. A profile is removed with its Auth account; deleting a post also deletes its comments and likes. No admin credentials are used by the Express server. Deploy Express on a Node.js host; static PHP hosting such as InfinityFree cannot run the server.

## Use on a locked computer with GitHub Codespaces

GitHub Pages cannot host this Express server. A Codespace runs Node.js in a cloud development environment so nothing needs to be installed on your Windows PC.

1. Create a **private** GitHub repository and upload the project contents, including `.devcontainer`. Do not upload `.env` or `node_modules`.
2. On the repository page, select **Code → Codespaces → Create codespace on main**. The container installs dependencies automatically with `npm ci`.
3. In the Codespaces terminal, create `.env` by copying `.env.example` (`cp .env.example .env`). The example already contains Dinglo's URL and public publishable key. Never commit `.env`.
4. Run `npm run dev`. Open the automatically forwarded **port 3000** link from the **Ports** tab. Keep the port private.

Codespaces is for development and preview; stopping the codespace stops the app. For a permanent public website, deploy the Express server to a Node.js host.
