# Sillage: personal fragrance journal

A perfume journal where you **browse a large fragrance database** (designer, niche, Middle Eastern, Indonesian) and add what you like to a private, cloud-synced collection or wishlist. It also has a spray guide tuned for Philippine weather: heat, humidity, rain and air-conditioning.

- **Public:** home, **Discover** (search and browse by house via the Fragella API), fragrance profiles with spray guide, a curated catalog, the general spray guide, guides, sign-in.
- **Private (owner only):** one-tap "I own this" or "Wishlist" from Discover; dashboard, collection, wishlist, favourites, previously owned, bottle levels, purchase history and value, wear log, comparison, recommendations, settings, and JSON backup and restore.

Built with React, TypeScript, Vite, Tailwind CSS and Lucide icons. Data lives in Supabase (PostgreSQL, Auth, Storage, Row Level Security), the site and its small search proxy are hosted on Vercel, and fragrance data comes from the [Fragella API](https://api.fragella.com). Fragella is the only paid piece, and it's optional: without it, everything except live search still works.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

Without Supabase credentials the app runs in **local preview mode**. The private journal works, but data is kept in this browser only and a banner says so. That's useful for trying the app; it is not a substitute for cloud sync.

To enable cloud sync and sign-in:

1. Create a Supabase project and run the three SQL files in `supabase/migrations/` (in order).
2. Create your owner account in Supabase → Authentication → Users, then turn off public sign-ups.
3. Copy `.env.example` to `.env.local` and fill in your project URL and anon key.
4. For live fragrance search, add `FRAGELLA_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (server-only) to `.env.local`.
5. `npm run dev`, then sign in at `/login`.

Full step-by-step instructions, including Vercel and a custom domain, are in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload; also serves the `api/` search proxy locally |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally with the same security headers as Vercel |
| `npm test` | Unit tests: spray engine, filters, similarity, validation, backup format, Fragella mapping, search proxy (limits, caching, errors) |
| `npm run test:db` | Applies the migrations to an in-memory Postgres (PGlite) and runs the RLS checks |
| `npm run verify:rls` | Probes your **live** Supabase project as a signed-out visitor and confirms private data is unreachable |
| `npm run lint` | Lint with oxlint |

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Supabase setup, authentication and redirect settings, environment variables, GitHub, Vercel, custom domain, troubleshooting, and free-tier limits.
- [docs/SECURITY.md](docs/SECURITY.md): access model, RLS policies, storage privacy, and how to verify unauthorised access is blocked.
- [docs/BACKUP.md](docs/BACKUP.md): JSON export and import, database backups, and restore procedures.

## Project structure

```
api/
  discover/                Vercel functions: search, brand, similar, status (fragrance database proxy)
  _lib/discover.ts         Shared proxy logic: validation, rate limits, caching, Fragella calls
supabase/
  migrations/              Schema, triggers, RLS policies, storage buckets, search quota
  tests/rls_verification.sql   Run in the SQL editor; rolls back, changes nothing
scripts/
  verify-rls.mjs           Live check against your Supabase project (anon key)
  test-db.mjs              Offline check of migrations + RLS using PGlite
src/
  api/                     Data layer: Supabase implementation + local preview adapter
  components/              UI primitives, layout, fragrance, filters, spray guide, wear log
  hooks/                   React Query hooks, URL-synced filter state
  lib/                     Domain logic: spray engine, filters, similarity, validation, backup
  lib/discover/            Fragella normaliser, journal-record converter, brand shelves
  pages/public/            Home, Discover, catalog, fragrance profiles, spray guide, guides, login
  pages/app/               Private journal pages
  providers/               Auth, theme, toasts, confirmations
```

## Features

**Discover: browse instead of typing**
- Public search across the Fragella database (100k+ fragrances), with a Men/Women/Unisex filter and a second page of results.
- Brand shelves for **Designer**, **Niche**, **Middle Eastern** and **Indonesian** houses. Pick a house to see its fragrances. Unknown spellings fall back to a text search, and the shelves are editable in `src/lib/discover/brands.ts`.
- Every result opens a full profile: image, notes pyramid, accords by strength, character and performance, season and occasion suitability, and the Philippine-weather spray guide. Similar fragrances load on request.
- Signed in as the owner, **I own this** or **Wishlist** adds it in one tap. The record links back to its source so it's never stored twice, and you can add price, size and date afterwards.
- "Add perfume" starts with a database search that fills the whole form; entering details by hand remains available.
- Imported facts are marked *unverified* and the ratings *community*. Character scales are derived from accords, and summer and occasion votes feed the suitability ratings and spray guide.
- Cost controls: the API key never leaves the server, results are CDN-cached for 24 h, and searches are capped per visitor and per month (see [DEPLOYMENT.md](docs/DEPLOYMENT.md#6-connect-the-fragrance-database-fragella)).

**Collection management**
- Full create, read, update and delete for perfumes. Only name and brand are required.
- Fields cover concentration, year, family, perfumers, description, top/heart/base notes, accords, and 1–5 ratings for sweetness, freshness, darkness, masculinity, projection and longevity. There are suitability ratings for heat, humidity, rain, air-conditioning, day, night, office, date night and special occasions, plus images, source links, personal rating (0–10), notes, bottle size, remaining level, price and currency, purchase date and store, and decant flag.
- **Facts vs opinions:** factual fields carry a status (Verified, Unverified or Needs review) backed by source links. Ratings are always labelled as estimates and record their basis (your impressions, estimate or community consensus).
- Separate views for **My Collection**, **Wishlist** (with "why I want it" and priority), **Favourites** and **Previously Owned**. Records move between them in one click, and "I bought it" moves a wishlist item into the collection.
- Bottle tracker with low-bottle alerts at a configurable threshold, and a value total built only from recorded prices, never mixing currencies.
- Price per ml, remaining ml, and a duplicate warning when you add something you already have.

**Search, filters and sorting**
- Search by name or brand (accent-insensitive), an A–Z filter by name or brand, and filters for family, notes, accords, concentration, the character and performance ranges, weather, occasion, status and favourites.
- Every filter combines; selecting several accords or notes requires all of them. Results update instantly, there's a single "Clear all" button, and filters live in the URL so they survive refreshes and can be bookmarked.
- Sorting by recently added, name, brand, rating, price or year, either direction. Collections show as a grid or a list.

**Philippine weather spray guide** (works offline, no API)
- Five scenarios: hot daytime, normal daytime, office, night date and special occasion.
- Each gives a spray range, placement, skin/clothing/both, technique, expected projection, overspray risk, fitness for heat/humidity/rain/air-con, and a plain-language explanation with the adjustments applied.
- Recommendations account for concentration, projection, longevity, character, occasion and environment. The environment toggles are adjustable.
- Customise globally (±2 overall or per scenario, preferred surface) and per bottle (exact min/max and a note).
- A public version works for any perfume you describe or any catalog entry.

**Fragrance information and images**
- Reference images by upload or https link, with placeholders when missing or broken. Private bottle photos are stored separately and shown only through short-lived signed URLs.
- Source links (official, reference, retailer) and one-click lookup searches that open in a new tab. Data comes from a licensed API (Fragella); nothing is scraped from Fragrantica or other sites.
- The public catalog shows only fragrances you explicitly publish, and never includes personal data.

**Dashboard, comparison and recommendations** (all computed from your saved data)
- Dashboard: owned, wishlist and favourite counts, recorded value, low bottles, recent additions, highest rated, favourites, wear-log summary, spray-guide shortcuts and "reach for today" picks.
- Compare up to four perfumes side by side, with shared notes and accords highlighted and a similarity score. A wishlist-vs-collection view flags likely duplicates and gap-fillers.
- Recommendations: best picks per occasion, collection insights (for example "leans sweet" or "nothing rated for the office"), bottles to rediscover from the wear log, and catalog fragrances close to your favourites.

**Cloud sync, resilience and backup**
- Supabase is the source of truth; the same account works on PC, laptop and phone. Changes persist across refreshes and devices.
- Loading skeletons, empty, error and retry states, success toasts and confirmation dialogs. An offline banner appears, writes made while offline are queued and sent on reconnect (while the tab stays open), and data refreshes when you're back online.
- JSON export, and validated JSON import with preview, merge or replace, typed confirmation and an automatic safety backup.

**Design and accessibility**
- Warm off-white light theme by default, with a charcoal dark theme. The toggle is saved to your account and follows the device setting on first visit. Theme switches don't flash.
- Responsive from phone to desktop: a sidebar on large screens and a drawer on mobile.
- Native form labels, keyboard support, visible focus rings, skip links, reduced-motion support, and the main text and UI colour pairs checked against WCAG AA contrast in both themes.

## Remaining limitations

- **Single owner by design.** The first account becomes the owner; others can't read or write private data. Multi-user support would need schema changes.
- **Live search costs money beyond Fragella's tiny free tier** (20 requests/month). Expect a few dollars a month on pay-as-you-go; the monthly cap stops surprises.
- **Not yet tested against the live Fragella API.** The integration follows Fragella's published response format and passes tests against a mock server, but the first searches with your real key should be checked. The normaliser in `src/lib/discover/fragella.ts` tolerates missing and differently shaped fields, and is the one place to adjust if a field differs.
- **Coverage depends on Fragella's database.** Large designer and niche houses are the most likely to be complete. Smaller local houses, Indonesian ones especially, may be partial or missing; add those by hand.
- **Imported data is community-sourced.** Notes and accords come from the database, and character scales are estimated from accords. Edit anything that doesn't match your experience.
- **Offline support is partial.** Data already loaded stays visible and queued writes sync on reconnect, but nothing is cached across a full reload while offline (deliberate, so private data isn't left in browser storage).
- **Images aren't in JSON backups.** Download them from Supabase Storage separately (see BACKUP.md).
- **Uploaded reference images are public by URL** (the URL is unguessable but not secret). Use the private bottle photo for anything personal.
- Spray counts are heuristics, not measurements; they become more useful once you fill in projection, longevity and character, and you can override any of them.
- The original visual reference mentioned in the brief wasn't available to this build. The styling follows the written direction (warm, light, airy, refined typography, restrained accents) and can be adjusted in `src/index.css`, where every colour is a token.
