# Deploying the Frontend to Vercel

The marketplace frontend is the only thing in the repo that goes to Vercel. The
backend (FastAPI) and worker (Rust) deploy elsewhere.

## One-time Vercel setup

1. **Create a project** on vercel.com → Import the GitHub repo.
2. **Set Root Directory** to `web/` (Vercel project Settings → General → Root
   Directory). With `web/vercel.json` present, framework + commands are detected
   automatically.
3. **Environment variable** (optional): `NEXT_PUBLIC_API_URL`. If not set, the
   frontend ships in **public preview mode**:
   - `/`, `/browse`, `/offerings/[id]`, `/pricing` render with seed data
   - `/auth/login` shows a "marketplace API isn't live yet" notice and disables submit
4. **Trigger first deploy** — Vercel autodetects Next.js 16 + Turbopack.

## Local check that the public-preview build works

```bash
cd web
unset NEXT_PUBLIC_API_URL
pnpm install --frozen-lockfile
pnpm build
```

Should succeed. The build prerenders `/` and `/pricing` statically; everything
else is server-rendered on demand and falls back to `lib/seed.ts` when the
API is unreachable.

## Once the backend is live

1. Set `NEXT_PUBLIC_API_URL=https://api.your-domain.com` in Vercel project
   environment variables (Production + Preview, your call).
2. Redeploy. The preview banner on `/auth/login` disappears, sign-in works,
   browse/offerings hit the real API.

## CI smoke

`pnpm build` in `web/` exercises the worst case (no API set) on every PR via
Vercel's preview build. If the build fails, the seed fallback or a server-only
import is the usual culprit.

## Vercel CLI deploys from your machine

```bash
cd web
pnpm dlx vercel link        # one-off
pnpm dlx vercel             # preview deploy
pnpm dlx vercel --prod      # production deploy
```
