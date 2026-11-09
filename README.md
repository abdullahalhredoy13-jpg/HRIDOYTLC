# HRIDOY TELECOM – Online Print Orders

Vanilla HTML/CSS/JS frontend + Netlify Functions (ES modules) + Netlify Blobs. No external database.

## How it works
- `upload.mjs` validates (extension, MIME, file signature, 4 MB, last 4 digits, copies) and writes the file to the Blobs store `hridoy-telecom-uploads` and its metadata JSON to `hridoy-telecom-orders` (same key). `expiresAt = upload time + 120000 ms` (UTC ISO).
- `admin-auth.mjs` checks the PIN on the server (`ADMIN_PIN` env var) and returns a 30-minute signed token. Every admin function (`list-orders`, `download`, `delete`, `update-status`) verifies it. Files are never publicly readable.
- **Lazy expiration:** `list-orders`, `download` and `delete` check `expiresAt`; expired items are never returned and are purged on access.
- **Scheduled cleanup:** `cleanup.mjs` runs every minute (`* * * * *`), deletes expired files and metadata, and continues past individual failures. It is best effort: it can run later than the 120-second mark. That is why the API hides expired files regardless of whether physical deletion has happened yet.
- Admin: press and hold the logo for 2.5 s (touch or mouse) -> PIN -> dashboard (auto refresh every 3 s).

## Deploy (Netlify Drop will NOT work – this project has backend functions)

### Option A – Git (easiest)
1. Create a GitHub repo and push this folder (`git init && git add . && git commit -m init && git push`).
2. Netlify -> Add new site -> Import from Git -> pick the repo. Build command: empty. Publish directory: `.` (already in `netlify.toml`).
3. Site configuration -> Environment variables -> add:
   - `ADMIN_PIN` = your PIN (required)
   - `ADMIN_SECRET` = a long random string (recommended; signs admin sessions)
4. Deploys -> Trigger deploy. Open the site, hold the logo for 2.5 s, sign in.

### Option B – Netlify CLI
```
npm install
npm i -g netlify-cli
netlify login
netlify init            # or: netlify link
netlify env:set ADMIN_PIN 123456
netlify env:set ADMIN_SECRET "$(openssl rand -hex 32)"
netlify deploy --prod
```
Local test: `netlify dev` (uses a local Blobs sandbox; scheduled functions do not auto-run locally – use `netlify functions:invoke cleanup`).

## Notes / limits
- Scheduled functions run only on **published production deploys**, at most once per minute.
- Netlify Functions accept ~6 MB request bodies, so the 4 MB file limit is per request; multiple files are uploaded one request at a time.
- Customers get no download access; only admins can read files.

## Manual test checklist
1. Upload one file and several files for each service (passport must be >= 4 copies).
2. Hold the logo 2.5 s, enter a wrong PIN (rejected), then the correct PIN.
3. Confirm stats, search, filters, download (file opens), delete.
4. Upload and wait 120 s: the row disappears from the dashboard; within a minute or two the Netlify function log for `cleanup` shows it deleted.
