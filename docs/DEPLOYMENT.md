# Deployment guide

This takes you from an empty Supabase account to the site running on Vercel with your own private login. Allow about 30 minutes.

> Supabase and Vercel occasionally rename dashboard menus. If a label below doesn't match exactly, look for the closest equivalent.

## 1. Create the Supabase project

1. Sign in at <https://supabase.com> and create a **new project**. Use a dedicated project for this app: the first account in the project becomes the owner.
2. Pick the region closest to you (for the Philippines, **Southeast Asia (Singapore)**).
3. Save the database password somewhere safe. The app doesn't need it, but you will for database backups.

## 2. Initialise the database

### Option A: SQL Editor (no tools needed)

1. Open **SQL Editor → New query**.
2. Paste the full contents of `supabase/migrations/20261021000001_schema.sql` and click **Run**.
3. Open a new query, paste `supabase/migrations/20261021000002_security.sql`, and click **Run**.
4. Open a new query, paste `supabase/migrations/20261021000003_discovery.sql`, and click **Run**.

### Option B: Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations create:

| Object | Purpose |
| --- | --- |
| `fragrances` | Fragrance profiles. Readable without login **only** when `is_public = true`. |
| `collection_items` | Your private records: status, rating, notes, bottle, price, spray overrides. |
| `wear_logs` | Your private wear log. |
| `user_settings` | Theme, currency, low-bottle threshold, spray preferences. |
| `app_owners` | Who may write. The first account to sign up is added automatically. |
| `api_usage`, `api_rate_limits` | Search counters for the fragrance-database proxy. Only the server can write; the owner can read usage. |
| Storage `fragrance-images` | Reference images, public by URL; only the owner can upload. |
| Storage `bottle-photos` | Private photos, served through signed URLs. |

### Verify the policies (recommended)

Paste `supabase/tests/rls_verification.sql` into a new SQL Editor query and run it. It impersonates a signed-out visitor, a stranger account and the owner, then **rolls everything back**. The final result row must read **"All RLS checks passed"**. Any failure stops with an error starting `FAIL:`.

## 3. Create your owner account

1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your email and a strong password (a long passphrase is ideal) and tick **Auto Confirm User**.
3. Because this is the first account, the database marks it as the owner. To confirm, run this in the SQL Editor:
   ```sql
   select u.email from public.app_owners o join auth.users u on u.id = o.user_id;
   ```

**If you created your account before running the migrations:** the security migration claims the account automatically when it is the only user. If there were several users, set the owner by hand:

```sql
insert into public.app_owners (user_id)
select id from auth.users where email = 'you@example.com';
insert into public.user_settings (user_id)
select id from auth.users where email = 'you@example.com' on conflict do nothing;
```

## 4. Lock down authentication

1. **Turn off public sign-ups:** Authentication → Sign In / Providers (or Auth Settings) → turn **off** "Allow new users to sign up". Your account keeps working; nobody else can register. Even if someone did, RLS gives them no access, but there's no reason to allow it.
2. **Set the URLs:** Authentication → URL Configuration.
   - **Site URL:** your production URL, for example `https://sillage.vercel.app` or your custom domain.
   - **Redirect URLs:** add
     - `https://<your-domain>/reset-password`
     - `http://localhost:5173/reset-password` (local development)
     - `http://localhost:4173/reset-password` (local preview of the production build)
   Password-reset emails only redirect to URLs on this list.
3. Optional: under **Authentication → Emails** you can customise the reset-password email. The free tier's built-in mailer is rate-limited (only a few emails per hour). That's fine for password resets; for more, configure your own SMTP.

## 5. Configure environment variables locally

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API** (or **API Keys**):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The **anon** (legacy JWT) or **publishable** (`sb_publishable_…`) key |
| `VITE_SITE_URL` | Optional. Leave blank locally; set to your production URL in Vercel. |

**Never** put the `service_role` or `sb_secret_…` key in a `VITE_` variable. Anything starting with `VITE_` is shipped to every visitor's browser. The app refuses to start cloud mode if it detects a secret key there, but rotate it immediately if that ever happens. The only place the secret key belongs is the server-only `SUPABASE_SERVICE_ROLE_KEY` described in step 6.

Then:

```bash
npm install
npm run dev
npm run verify:rls   # probes your project as a signed-out visitor; all checks should PASS
```

Sign in at <http://localhost:5173/login>.

## 6. Connect the fragrance database (Fragella)

This powers **Discover** (public browsing and search) and the "Find it in the database" search when adding a perfume. Without it the site still works, but you add perfumes by hand.

1. Create an account at <https://api.fragella.com> and choose a plan:
   - **Free** (20 requests/month) is enough to test the connection, not for regular browsing.
   - **Pay as you go** (about $2/month plus $0.005 per request) or **Basic** ($12/month for 5,000 requests) suit personal use.
   Check the current prices on their site; these were the published rates in October 2026.
2. Copy your API key.
3. In Supabase → **Project Settings → API** (or **API Keys**), copy the **service_role** key (legacy) or create a **secret** key (`sb_secret_…`). The search proxy uses it only to record usage and enforce limits. It is a server-side secret.
4. Add these **without** the `VITE_` prefix: in `.env.local` for local development, and in Vercel → Settings → Environment Variables (Production and Preview):

   | Variable | Value |
   | --- | --- |
   | `FRAGELLA_API_KEY` | Your Fragella key |
   | `SUPABASE_SERVICE_ROLE_KEY` | The Supabase service-role or secret key |
   | `DISCOVER_MONTHLY_CAP` | Most uncached searches allowed per month across all visitors (default 1000) |
   | `DISCOVER_RATE_PER_MINUTE` | Per-visitor limit per minute (default 20) |
   | `DISCOVER_RATE_PER_DAY` | Per-visitor limit per day (default 300) |
   | `RATE_LIMIT_SALT` | Optional random string used when hashing visitor IPs |

5. Redeploy. In the journal, **Settings → Fragrance database** should say **Connected**, with search limits **enforced in Supabase**.

How spending is kept under control:
- The key stays on the server. Browsers call `/api/discover/*` (Vercel functions in `api/`), never Fragella directly.
- Successful responses are cached by Vercel's CDN for 24 hours. The same search or brand page from anyone, on any device, doesn't use a request.
- Each visitor (hashed IP) is rate-limited per minute and per day. Once the monthly cap is reached, live search pauses until the next month (Philippine time). Saved fragrances and everything else keep working.
- In production the proxy refuses to call Fragella at all if the Supabase key is missing, so limits can't be silently skipped.
- Set the cap a bit below your Fragella plan's allowance. Repeated searches are free thanks to caching, so the cap only counts new ones.

Local development: with the same variables in `.env.local`, `npm run dev` serves the `api/` functions itself. Without the Supabase service key it uses in-memory limits (development only).

Brand shelves (Designer, Niche, Middle Eastern, Indonesian) are defined in `src/lib/discover/brands.ts`. Add or rename houses there. If a name doesn't match the database exactly, the page falls back to a text search.

## 7. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.gitignore` already excludes `.env*` (except `.env.example`), `node_modules`, `dist` and exported backup files (`sillage-backup-*.json`). A private repository is recommended but not required, since no secrets are committed.

## 8. Deploy on Vercel

1. At <https://vercel.com>: **Add New → Project → Import** your GitHub repository.
2. The framework is detected as **Vite**. `vercel.json` already sets the build command (`npm run build`), the output directory (`dist`), SPA rewrites (so refreshing `/app/collection` works) and security headers.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL` (your Vercel or custom URL) for **Production** and **Preview**, plus the server-only variables from step 6 (`FRAGELLA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and, optionally, the limits). The functions in `api/` are deployed automatically.
4. Click **Deploy**.
5. Go back to Supabase → Authentication → URL Configuration and make sure the **Site URL** and **Redirect URLs** match the deployed domain.

Every push to `main` redeploys automatically. Pull requests get preview URLs; add those domains to the Supabase redirect list too if you want password reset to work on previews (sign-in works without it).

> **Changing environment variables requires a redeploy.** Vite bakes `VITE_*` values in at build time.

## 9. Custom domain (optional)

1. Vercel → Project → **Settings → Domains → Add**, and enter your domain.
2. At your DNS provider, add the records Vercel shows (usually an `A` record to `76.76.21.21` for the apex domain, or a `CNAME` to `cname.vercel-dns.com` for a subdomain).
3. Wait for the certificate (usually minutes).
4. Update `VITE_SITE_URL` in Vercel and **redeploy**.
5. Update Supabase **Site URL** and add `https://<domain>/reset-password` to the **Redirect URLs**.

## Costs and usage limits

Both services have free tiers that comfortably cover a personal collection. Figures change, so check the current pricing pages before relying on them.

**Supabase Free** (at the time of writing):
- About 500 MB database, 1 GB file storage, 5 GB egress per month, and up to two active free projects.
- **Projects pause after about a week without activity.** The site then shows "can't reach the server" errors until you open the Supabase dashboard and click **Restore**. Visiting the site regularly keeps it active; the Pro plan never pauses.
- No downloadable automatic backups on Free. Use the JSON export and the steps in [BACKUP.md](BACKUP.md).
- The built-in email sender is heavily rate-limited (only a few emails per hour). Configure custom SMTP if you need more.

**Vercel Hobby:**
- Free for personal, non-commercial use, with a generous monthly bandwidth allowance for a site like this. Function invocations for the search proxy fit well within the Hobby allowance.

**Fragella API** (the only paid part, and optional):
- Free: 20 requests/month. Pay as you go: about $2/month plus $0.005 per request. Basic: $12/month for 5,000 requests. Pro: $49/month for 20,000 (published rates, October 2026).
- Typical personal use is a few hundred new searches a month, because repeated searches and brand pages are served from the 24-hour cache. `DISCOVER_MONTHLY_CAP` puts a hard ceiling on it.
- Fragella's terms forbid mirroring large parts of their data. The app only stores the fragrances you add to your journal, which is within normal use.

**Estimated storage use:** text records are tiny (thousands of perfumes fit in a few MB). Images are the main cost; uploads are capped at 5 MB each, so compress photos (a 1000 px wide WebP or JPEG is plenty).

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Blue "Local preview" banner on the deployed site | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing in Vercel, or added after the last build. Add them and **redeploy**. |
| Red banner about a secret key | You used the service-role or secret key. Replace it with the anon or publishable key, redeploy, and **rotate the secret** in Supabase. |
| "Email or password is incorrect" | Check the user exists and is confirmed (Authentication → Users). Reset the password from the dashboard if needed. |
| Signed in but "This journal is private" | The account isn't in `app_owners`. Run the owner SQL in step 3. |
| "…was blocked by the database permissions" | You're not signed in as the owner, or your session expired. Sign out and back in. If it persists, re-run the security migration and `rls_verification.sql`. |
| 404 when refreshing `/app/...` | `vercel.json` is missing from the deployment, or the output directory isn't `dist`. |
| Password-reset link opens the home page or errors | The domain isn't in Supabase **Redirect URLs**, or the link expired (request a new one and open it on the same device). |
| "Can't reach the server" everywhere | The Supabase project is paused (Free tier). Restore it from the dashboard. Also check your connection. |
| Images don't show | External image sites may block hotlinking. Upload the image instead, or use another https link. Check the `fragrance-images` bucket exists. |
| Upload fails with a permission error | Storage policies are missing. Re-run the security migration. Files must be images of 5 MB or less. |
| Using a custom Supabase domain | Add it to `connect-src` in the Content-Security-Policy in `vercel.json`. |
| Discover says "Live search isn't connected yet" | `FRAGELLA_API_KEY` missing, or in production `SUPABASE_SERVICE_ROLE_KEY` missing. Add it in Vercel and redeploy. Settings → Fragrance database shows which. |
| "The fragrance database rejected the API key" | Wrong or revoked Fragella key. Copy it again from api.fragella.com. |
| "Search safeguards aren't configured" | The quota function call failed. Check `SUPABASE_SERVICE_ROLE_KEY` and that migration 3 ran. Vercel function logs show the reason. |
| "Live database searches are paused until next month" | `DISCOVER_MONTHLY_CAP` reached. Raise it (and your Fragella plan if needed), then redeploy. |
| "The fragrance database's request allowance is used up" | Your Fragella plan's monthly requests ran out. Upgrade the plan or wait for the reset. |
| A brand shelf shows "Closest matches" or nothing | The database spells the brand differently or doesn't carry it. Edit the name in `src/lib/discover/brands.ts`. Coverage of Indonesian houses is thinner than for designer brands. |
| `npm run build` fails on Vercel only | Make sure the Node.js version in Vercel project settings is 20 or later. |
