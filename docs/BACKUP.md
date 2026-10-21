# Backup and restore

Your collection lives in Supabase PostgreSQL, so it syncs across devices and survives browser resets. Backups protect against mistakes (deleting the wrong thing), a lost or paused project, or moving to a new Supabase project.

There are three layers. Use the first regularly; the others are for bigger moves.

## 1. JSON export from the app (recommended monthly)

**Settings → Backup & restore → Export JSON backup** downloads `sillage-backup-<date>.json` containing:

- every fragrance profile you created (public and private), plus any public fragrance referenced by your records
- all collection records (owned, wishlist, previously owned) with ratings, notes, bottle, purchase and spray-override data
- the full wear log
- your settings (theme, currency, low-bottle threshold, spray preferences)

It doesn't include **image files**: only their links or storage paths (see section 3).

Store the file somewhere private, such as a personal cloud drive or an encrypted disk. It contains your prices and notes. The repository's `.gitignore` excludes `sillage-backup-*.json` so it can't be committed by accident.

### Restoring from JSON

1. Sign in as the owner and open **Settings → Backup & restore → Import from file**.
2. The file is validated before anything is written: structure, value ranges, URL schemes, and that every record references a fragrance in the file. Problems are listed and nothing is imported.
3. Review the summary (export date and record counts), then choose:
   - **Merge:** adds new records and updates any with the same ID. Nothing is deleted. Safe to run repeatedly.
   - **Replace:** deletes all fragrances, records and wear entries in the account, then imports the file. You must type `REPLACE`, and the app downloads a safety backup of your current data first.
4. A confirmation shows how many records, fragrances and wear entries were imported.

If an import fails partway (for example, a network drop), records written before the failure stay. Re-run the same file with **Merge** to finish; it's idempotent.

## 2. Database-level backup

Useful before risky schema changes, or for a full copy including tables you might add later.

**Supabase Pro** includes daily automatic backups (Database → Backups). **Free** projects don't offer downloadable backups, so take your own:

```bash
# Requires the Supabase CLI and Docker, or use pg_dump directly.
npx supabase db dump --linked -f backup-schema.sql
npx supabase db dump --linked --data-only -f backup-data.sql
```

Or with `pg_dump` and the connection string from **Project Settings → Database**:

```bash
pg_dump "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  --schema=public --data-only --file=sillage-data.sql
```

Restore into a fresh project by running the migrations first, then the data file with `psql`.

## 3. Image files

Uploaded images live in Supabase Storage:

- `fragrance-images/<your user id>/…`: reference images
- `bottle-photos/<your user id>/…`: private bottle photos

To back them up, open **Storage** in the dashboard, select each bucket and download the folder, or script it with the Supabase CLI or storage API using the service-role key **on your own machine only** (never in the app).

When restoring into a **new** project, upload the folders back to the same bucket names and paths. The JSON backup references images by path, so they reappear once the files are back. Images added by https link need nothing.

## Moving to a new Supabase project

1. Export JSON from the old site (and download storage folders if you uploaded images).
2. Create the new project and run both migrations (see [DEPLOYMENT.md](DEPLOYMENT.md)).
3. Create your owner account and disable sign-ups.
4. Point `.env.local` and Vercel at the new URL and key, then redeploy.
5. Sign in, import the JSON with **Merge**, and re-upload images if needed.
6. Run `supabase/tests/rls_verification.sql` and `npm run verify:rls` on the new project.

## Local preview data

In local preview mode (no Supabase configured), data lives only in that browser's storage. Export it from **Settings** before connecting Supabase, then import it after signing in to the cloud version.
