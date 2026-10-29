# Deploy Meadowlight (GitHub + Vercel + Supabase)

## Already done

| Piece | URL |
|---|---|
| GitHub | https://github.com/j-roylance/meadowlight |
| Vercel production | https://meadowlight-gold.vercel.app |
| Vercel project | linked to the GitHub repo (auto-deploys on push to `main`) |

Without Supabase env vars, the live site runs **local demo** in each visitor’s browser.

## Finish Supabase (accounts + shared maps)

### 1. Create a hosted project

1. Open [https://supabase.com/dashboard/new/new-project](https://supabase.com/dashboard/new/new-project)
2. Name it `meadowlight`, pick a region, set a DB password (save it).
3. Wait until the project is ready.

### 2. Apply migrations

From this repo (after `supabase login` with an [access token](https://supabase.com/dashboard/account/tokens)):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # from account tokens page
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor in order.

### 3. Auth settings

In Supabase → Authentication → Providers → Email:

- Enable Email
- Disable “Confirm email” for easier OTP testing, or keep it and use the mailer

In Authentication → URL configuration:

- Site URL: `https://meadowlight-gold.vercel.app`
- Redirect URLs: `https://meadowlight-gold.vercel.app/**`

### 4. Wire Vercel env vars

Project Settings → API → copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**)

Then:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

Or set them in the Vercel dashboard → Project → Settings → Environment Variables, then redeploy.

### 5. Verify

1. Open the production URL → email OTP sign-in.
2. Create a city, refresh, confirm it persists.
3. Second account / private window → appears under Maps; portal/send works.
