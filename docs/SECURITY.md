# Security model

The site is public; the collection is private. Privacy is enforced by **PostgreSQL Row Level Security (RLS)**, not by hiding pages. Even someone who calls the Supabase API directly with the public anon key gets nothing private back.

## Who can do what

| Actor | Can read | Can write |
| --- | --- | --- |
| Signed-out visitor (anon key) | `fragrances` where `is_public = true` | Nothing |
| Signed-in account that is **not** the owner | Same as a visitor, plus whether they themselves are an owner | Nothing |
| Owner | Their own fragrances (public or not), collection, wear log, settings, storage folder, this month's search usage | The same: create, update and delete, only on rows they own |
| Server-side search proxy (service role) | The key itself bypasses RLS, so keep it secret; the proxy's code only calls `consume_discovery_quota` | Search counters only |

Ownership is recorded in `public.app_owners`. The first account created in the project is added automatically by the `on_auth_user_created` trigger, and no client can insert into that table. Every write policy calls `public.is_app_owner()`, so a stray account (for example, if sign-ups were left open) can't create data, upload files or publish catalog entries.

## What's public and what isn't

**Public only when you publish a fragrance:** name, brand, concentration, year, family, perfumers, description, notes, accords, character, performance and suitability ratings, information status, source links, reference image and credit.

**Never public:** personal rating, personal notes, wishlist reason and priority, bottle size and level, prices, purchase date and store, decant flag, bottle photos, spray overrides, wear log, settings, and whether you own, want or previously owned anything. These live in separate tables (`collection_items`, `wear_logs`, `user_settings`) that have **no** anonymous policies, and anonymous table privileges are revoked as an extra layer.

New fragrances default to **private** (`is_public = false`). Publishing asks for confirmation, and the Fragrance library page lists everything that is public.

## Policy summary

- `fragrances`: SELECT for everyone when `is_public`; SELECT, INSERT, UPDATE and DELETE for the owner when `owner_id = auth.uid()`. `WITH CHECK` prevents assigning rows to another account.
- `collection_items`: all operations require `user_id = auth.uid()` and owner status. Inserts and updates must reference a fragrance the user owns or that is public.
- `wear_logs`: all operations require `user_id = auth.uid()` and owner status. Rows must reference the user's own collection item.
- `user_settings`: all operations require `user_id = auth.uid()` and owner status.
- `app_owners`: users can see only their own row. No client writes.
- Storage `fragrance-images` (public bucket): upload, update and delete only by the owner, inside `<their user id>/`.
- Storage `bottle-photos` (private bucket): read, upload, update and delete only by the owner, inside `<their user id>/`. The app displays photos through signed URLs that expire after one hour.
- `TRUNCATE`, `REFERENCES` and `TRIGGER` privileges are revoked from `anon` and `authenticated`.
- `SECURITY DEFINER` functions use an empty `search_path` and have execute rights revoked from `public`.

Data validation happens twice: in the browser (zod schemas mirroring the database limits) and in the database (`CHECK` constraints on every rating, enum, length, URL scheme and array).

## Keys and secrets

- The browser only ever receives the **anon / publishable** key. It is designed to be public and grants nothing beyond what RLS allows.
- The **service_role / secret** key bypasses RLS. It is used in exactly one place: the server-side search proxy (`api/_lib/discover.ts`) calls `public.consume_discovery_quota` with it to count searches. It is read from `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix), so Vite never bundles it. If it is accidentally put into a `VITE_` variable, the app detects it, disables cloud mode, and shows a warning. Rotate it in Supabase immediately.
- The **Fragella API key** (`FRAGELLA_API_KEY`) lives only in the server environment. Browsers call `/api/discover/*`, never Fragella.
- `.env*` files are git-ignored; `.env.example` contains placeholders only.

## Fragrance database proxy

- `api/discover/search`, `brand` and `similar` validate input (length, allowed values), then call Fragella with the server-held key. Responses are trimmed to the fields the app needs.
- **Abuse and cost controls:** a per-visitor limit per minute and per day, plus a global monthly cap. These are checked atomically in Postgres (`consume_discovery_quota`, executable only by the service role). Successful responses are CDN-cached for 24 hours. In production the proxy refuses to run without the shared limits.
- **Privacy:** visitor IPs are never stored. Only a salted SHA-256 hash is kept in `api_rate_limits`, and those rows expire within two days. Fragella receives only the search text or brand name, never anything from your journal.
- `api_usage` and `api_rate_limits` have RLS enabled. Anonymous and non-owner accounts can't read them, and no browser session can write them or call the quota function. The verification scripts check this.
- Data from Fragella is treated as untrusted input: it's normalised and type-checked, image URLs must be `https://`, React escapes all text, and the CSP blocks scripts from other origins.

## Browser hardening (vercel.json)

- A Content-Security-Policy that only allows scripts from the site itself (no inline scripts, no `eval`) and network connections only to the site and `*.supabase.co`. Embedding the site in frames is blocked.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a `Permissions-Policy` that disables camera, microphone and geolocation.
- External links open with `rel="noopener noreferrer"`. Image URLs must be `https://`, and source links must be `http(s)://`, so `javascript:` URLs are rejected.
- `robots.txt` asks crawlers to skip `/app`, `/login` and `/reset-password`.

## Verifying that unauthorised access is blocked

Run all four checks after setup and after any change to the migrations.

1. **Offline, before deploying:** `npm run test:db`. Applies the migrations to an in-memory Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas, then runs every check below. It's quick and needs no account. The stand-ins are simplified, so steps 2–3 remain the authority for your real project.
2. **In your project:** run `supabase/tests/rls_verification.sql` in the SQL Editor. It creates throwaway users and rows inside a transaction, then checks:
   - Signed-out visitors can't read private fragrances, collection, wear log, settings or the owner list; can't write anything; and can't list private photos.
   - A non-owner account can't read the owner's data; can't insert, update or delete fragrances or collection items; can't impersonate the owner; can't promote itself to owner; and can't upload photos.
   - The owner can read and write their own rows, but can't reassign rows to another account.

   Everything is rolled back. The last row says **"All RLS checks passed"**.
3. **From the outside, against the live API:** `npm run verify:rls`. Uses the same URL and anon key as the browser and confirms private tables return nothing, writes are rejected, and the private bucket can't be listed.
4. **Manually in a browser:**
   - In a private window (signed out), open `/app`. You should be sent to `/login`.
   - Open the browser dev tools on the public catalog and check the network responses: only published fragrance fields appear; there are no prices, ratings or notes.
   - Optionally, temporarily enable sign-ups, register a second account, sign in, and confirm you see "This journal is private" and empty responses. Then delete that account and disable sign-ups again.

## Operational advice

- Use a long, unique password for the owner account. Supabase can also enforce leaked-password protection and MFA in the Auth settings.
- Keep exported backups private: they contain prices, ratings and notes.
- If you ever share the Supabase project with other apps, review `app_owners`. The "first user becomes owner" rule assumes a dedicated project.
