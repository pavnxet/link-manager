# 🔗 Link Vault — self-hosted link manager with image hosting

> **A private, cloud-native personal knowledge hub for your clipboard.** Save links, drag in screenshots, shoot photos with your camera, and find everything again in one searchable table — powered by Next.js 16, Turso or Supabase, and ImgBB.

<p align="center">
  <a href="#-quick-start"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.4-000000?logo=nextdotjs&logoColor=white"></a>
  <a href="#-database-setup"><img alt="Turso" src="https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso&logoColor=black"></a>
  <a href="#-database-setup"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white"></a>
  <a href="#-image-uploads"><img alt="ImgBB" src="https://img.shields.io/badge/ImgBB-image%20hosting-2F7DF6?logo=imgbb&logoColor=white"></a>
  <img alt="Tests" src="https://img.shields.io/badge/tests-108%20passing-brightgreen">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-ff69b4">
</p>

---

## 📚 Table of contents

| | Section | | Section |
|---|---|---|---|
| 1 | [Why Link Vault](#-why-link-vault) | 8 | [Image uploads](#-image-uploads) |
| 2 | [Features](#-features) | 9 | [API reference](#-api-reference) |
| 3 | [Screens](#-screens) | 10 | [Security model](#-security-model) |
| 4 | [Tech stack](#-tech-stack) | 11 | [Testing](#-testing) |
| 5 | [Quick start](#-quick-start) | 12 | [Deployment](#-deployment) |
| 6 | [Configuration](#-configuration) | 13 | [FAQ](#-faq) |
| 7 | [Database setup](#-database-setup) | 14 | [Contributing](#-contributing) |

---

## 💡 Why Link Vault

Every "I'll read this later" link dies in a chat thread, a notes app, or a browser tab you close by accident. Link Vault is a **single-user bookmark manager and image vault** that replaces that mess with one page:

- 🗂️ **One table, every link** — numbered, categorised, searchable, editable inline.
- 🖼️ **Images live next to links** — drop, paste or photograph a screenshot and it is hosted on ImgBB with its URL saved as an entry.
- 🔒 **Nobody else gets in** — no sign-up, no public API, cookie sessions signed with your own secret.
- 🗄️ **Your database, your rules** — Turso (SQLite/libSQL) or Supabase (Postgres), switched by one env var.
- 💾 **No lock-in** — one-click JSON backup, restore with duplicate detection.

**Keywords:** self-hosted bookmark manager · personal knowledge base · link manager app · Next.js link vault · ImgBB uploader · Turso bookmarks · Supabase bookmarks · drag-and-drop image upload · private read-later app.

---

## ✨ Features

### 🔒 Fortress-level privacy
- **Zero public access** — no sign-up page. Access is controlled entirely by `ADMIN_USERNAME` / `ADMIN_PASSWORD` server-side secrets.
- **Signed sessions** — the `auth-token` cookie is an HS256 JWT. `JWT_SECRET` is mandatory in production; the app refuses to issue tokens without it rather than falling back to a published default.
- **Middleware guard** — every route is protected. Browsers get the login screen, API callers get a JSON `401`.
- **Login throttling** — 5 attempts per 15 minutes per client, then `429` with `Retry-After`.
- **Explicit logout** — clears the cookie instead of leaving a token alive for its full 7 days.

### ⚡ Rapid "paste & go" entry
- **Smart auto-counter** — suggests the next number (`#42` → `#43`) from your whole vault, including padded titles.
- **Auto-scraping** — paste a URL and the page title fills itself in.
- **Intelligent categorisation** — detects YouTube, GitHub, Reddit, Stack Overflow, ImgBB and more, then assigns an emoji + hashtag (`📺 #Video`, `💻 #Code`, `🖼️ #Image`).
- **Guarded fetching** — the scraper is http(s)-only, refuses private/loopback/link-local/metadata addresses (literal, after DNS, and on every redirect), with a 5 s timeout and 512 KB cap.

### 🖼️ Four ways to add an image
| Method | How it works |
|---|---|
| 📤 **Upload button** | Opens a multi-select file picker |
| 🖱️ **Drag & drop** | Drop anywhere on the dashboard |
| 📋 **Paste** | `Ctrl+V` / `Cmd+V` with a screenshot on the clipboard |
| 📷 **Camera** | Live `getUserMedia` preview, capture → upload (rear/front switch) |

All four share one queue, one progress indicator and one toast — and every upload lands in the table as a `🖼️ #Image` entry with its hosted URL and a copy button.

### 🎛️ Powerful management
- **Live search** across title, page title, category and URL.
- **Inline editing** — fix a typo or re-categorise without leaving the page (a failed save is reported, never faked).
- **Safe deletion** with a confirmation prompt.
- **Dark, dense UI** — Tailwind CSS 4, no build-time design system to learn.

### 💾 Data sovereignty
- **One-click backup** — export the whole vault as a JSON file.
- **Smart restore** — validated row-by-row before touching the database, duplicates skipped, and the UI tells you how many were added versus already present.

---

## 🖥️ Screens

> Add your own screenshots to `docs/screens/` and link them here — a README with real screenshots converts far better than one without.

| Dashboard | Camera capture |
|---|---|
| _`docs/screens/dashboard.png`_ | _`docs/screens/camera.png`_ |

---

## 🛠️ Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) | Server routes + React UI in one deployable |
| **UI** | [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/) | Fast to write, no runtime CSS |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent, tree-shakeable |
| **Database** | [Turso](https://turso.tech/) (libSQL) **or** [Supabase](https://supabase.com/) (Postgres) | Pick by `DB_PROVIDER` |
| **Auth** | [jose](https://github.com/panva/jose) (HS256 JWT) | Stateless, no session store |
| **Scraping** | [Cheerio](https://cheerio.js.org/) | Title extraction without a headless browser |
| **Image hosting** | [ImgBB API](https://api.imgbb.com/) | Free, simple, 32 MB per image |
| **Testing** | Node test runner + [tsx](https://tsx.is/) + jsdom | No Jest/Vitest overhead |

---

## 🚀 Quick start

### Prerequisites

- **Node.js 20+** (the test runner needs it)
- A [Turso](https://turso.tech/) **or** [Supabase](https://supabase.com/) account
- A free [ImgBB API key](https://api.imgbb.com/) (only if you want image uploads)

### 1. Clone

```bash
git clone https://github.com/pavnxet/link-manager.git
cd link-manager
```

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.local.example .env.local
```

Then fill in the values from the [configuration table](#-configuration) — the only **mandatory** ones are your admin credentials, a `JWT_SECRET`, and the credentials for whichever database you choose.

### 4. Create the schema

- **Turso:** run [`turso-schema.sql`](turso-schema.sql) with the Turso CLI or dashboard.
- **Supabase:** run [`schema.sql`](schema.sql) in the Supabase SQL editor.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with your admin credentials. 🎉

---

## ⚙️ Configuration

Every setting lives in `.env.local` (never committed — `.env*` is gitignored).

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_USERNAME` | ✅ | — | The only username that can sign in |
| `ADMIN_PASSWORD` | ✅ | — | Its password — use a long random string |
| `JWT_SECRET` | ✅ in production | dev-only fallback | Session signing key, **16+ chars**, 32+ recommended (`openssl rand -base64 32`) |
| `DB_PROVIDER` | — | `turso` | `turso` or `supabase` |
| `TURSO_DATABASE_URL` | ✅ if Turso | — | e.g. `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | ✅ if Turso | — | Turso database token |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ if Supabase | — | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ if Supabase | — | Service role key — **not** the anon key (which is public and cannot bypass RLS) |
| `IMGBB_API_KEY` | for uploads | — | Server-side only; never sent to the browser |
| `NEXT_PUBLIC_SITE_URL` | — | Vercel URL | Canonical URL used in metadata |

> ⚠️ **Production gotcha:** without `JWT_SECRET` the app still boots and every page loads, but signing in returns `500`. That is deliberate — the alternative is signing tokens with a secret that is published in this repo.

---

## 🗄️ Database setup

### Turso (default, fastest to start)

```bash
turso db create link-vault
turso db show link-vault --url          # -> TURSO_DATABASE_URL
turso db tokens create link-vault       # -> TURSO_AUTH_TOKEN
turso db shell link-vault < turso-schema.sql
```

### Supabase (Postgres)

1. Create a project, then run [`schema.sql`](schema.sql) in the SQL editor.
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`.

The schema enables **Row Level Security** with no policies, so the public anon key can read nothing while the server-side service role still works.

### Switching providers

Both adapters implement the same `DbClient` interface (`lib/db.ts`), so changing `DB_PROVIDER` is the only step. Nothing else in the app knows which database is behind it.

---

## 🖼️ Image uploads

Drop, paste or shoot a picture and Link Vault will:

1. **Validate** it in the browser and again on the server — the type is sniffed from magic bytes, not the filename, and the 32 MB ImgBB limit is enforced.
2. **Upload** it to ImgBB from the server, so your API key never reaches the browser.
3. **Save** the hosted URL as a vault entry: numeric title, original filename, `🖼️ #Image` category.
4. **Show** a toast with a one-click copy button for the hosted URL.

**Camera notes:** frames are captured in-browser, scaled to at most 2048 px on the long edge, and encoded as JPEG before upload — so a 4K webcam does not produce a 6 MB file. `getUserMedia` needs https (or localhost); when it is unavailable or permission is denied, the modal offers a one-click fallback to the device's own camera app.

---

## 🔌 API reference

All routes require a valid session cookie. Unauthenticated API calls get `401` JSON.

| Method | Route | Body / query | Returns |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{username, password}` | `200` + cookie · `401` bad creds · `429` throttled |
| `POST` | `/api/auth/logout` | — | Clears the cookie |
| `GET` | `/api/links?q=` | search term | `Link[]` |
| `POST` | `/api/links` | `{title, url, page_title?, category?}` | `201` link · `400` invalid · `409` duplicate URL |
| `GET` | `/api/links/next-id` | — | `{nextId}` · `500` if the vault cannot be read (never guesses) |
| `PUT` | `/api/links/:id` | any of the link fields | Updated link · `404` · `409` |
| `DELETE` | `/api/links/:id` | — | `{success:true}` · `404` |
| `POST` | `/api/scrape` | `{url}` | `{title, category, url}` · `400` blocked/invalid |
| `POST` | `/api/upload` | `multipart/form-data` field `image` | `201 {image, link}` · `413` · `415` · `502` |
| `GET` | `/api/backup` | — | Full vault as JSON |
| `POST` | `/api/backup` | Array of links | `{count, skipped}` · `400` with the offending entry |

---

## 🛡️ Security model

| Threat | Mitigation |
|---|---|
| Forged session cookie | HS256 JWT signed with `JWT_SECRET`; no default secret in production |
| Password guessing | Per-client rate limit (5 / 15 min) on `/api/auth/login` |
| SSRF via the scraper | http(s) only; private, loopback, link-local and cloud-metadata addresses refused — checked literally, after DNS resolution, and on every redirect |
| Malicious upload | Magic-byte type sniffing, size cap, server-side upload |
| Key exposure | The ImgBB key is server-only; no `NEXT_PUBLIC_` prefix |
| Stored `javascript:` links | URLs validated as http(s) on write and re-checked before rendering as `href` |
| Error-message leakage | Routes log details server-side and return generic messages |
| Public database | Supabase RLS enabled; service-role key required, anon key rejected |

Found a vulnerability? Please open a private security advisory rather than a public issue.

---

## 🧪 Testing

```bash
npm test          # run everything
npm run test:watch
```

The suite uses the **Node test runner** through `tsx` (`test/run.mjs`), so there is no Jest/Vitest dependency and no build step before testing.

```
108 tests · unit + route + DOM
```

| Area | File | Covers |
|---|---|---|
| Auth | `lib/auth.test.ts` | signing, tampering, missing/short `JWT_SECRET`, fail-closed verification |
| Login route | `app/api/auth/login/route.test.ts` | credentials, cookie flags, rate limiting |
| Links API | `app/api/links/route.test.ts` | validation, `javascript:` rejection, `409`, no error leakage |
| Upload | `app/api/upload/route.test.ts` | magic bytes, size, ImgBB failures, vault insert |
| ImgBB client | `lib/imgbb.test.ts` | request shape, every failure mode, key never leaked |
| SSRF guard | `lib/url-safety.test.ts`, `lib/scrape.test.ts` | private ranges, DNS rebinding, redirect hops, timeouts |
| Data layer | `lib/db/turso.test.ts` | category search, next-id counting, real insert counts, duplicate URLs |
| Clipboard / camera | `lib/clipboard.test.ts`, `lib/camera.test.ts` | extraction, naming, capability detection, frame sizing |
| UI | `components/*.test.tsx` | counter refresh after an upload (jsdom + real drop event) |

---

## ☁️ Deployment

### Vercel (recommended)

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the environment variables from the [configuration table](#-configuration) — **including `JWT_SECRET`**.
3. Deploy. 🚀

### Anywhere else

```bash
npm run build
npm run start   # listens on :3000
```

Works on any Node 20+ host; the app only needs outbound HTTPS for ImgBB and the scraper.

---

## ❓ FAQ

<details>
<summary><b>Is this a bookmark manager or an image host?</b></summary>

Both, in one table. Links and images are the same kind of entry: a numbered row with a URL, a title and a category. Images just happen to be hosted on ImgBB first.
</details>

<details>
<summary><b>Can multiple people use one instance?</b></summary>

No — it is deliberately single-user. One admin credential pair, one vault. Running two instances is cheaper than building multi-tenancy.
</details>

<details>
<summary><b>Why ImgBB instead of storing images myself?</b></summary>

Storage, CDN and bandwidth for free, with a 32 MB per-image limit. The trade-off is that ImgBB is a third party — swap `lib/imgbb.ts` for S3/R2 if that matters to you; the upload route only depends on that one module.
</details>

<details>
<summary><b>Turso or Supabase?</b></summary>

Turso if you want a fast, tiny, SQLite-shaped database and the simplest setup. Supabase if you want Postgres features (full-text, joins, RLS policies) or already have a project.
</details>

<details>
<summary><b>Does it work on my phone?</b></summary>

Yes. The layout is responsive, and the **Camera** button opens your rear camera directly, which is the fastest way to save a whiteboard photo or a receipt.
</details>

<details>
<summary><b>Where is my data if I delete the deployment?</b></summary>

In your database, not in the app. Use **Backup** to export a JSON file you can re-import anywhere.
</details>

<details>
<summary><b>Is the dashboard indexed by search engines?</b></summary>

No — it is private, so `robots` is set to `noindex` and `robots.txt` disallows crawling. Metadata and Open Graph tags are still there so shared links preview nicely.
</details>

<details>
<summary><b>What is the keyboard shortcut for saving?</b></summary>

Paste a URL into the field and press <kbd>Enter</kbd> — the title and category fill in automatically. For images, <kbd>Ctrl</kbd>+<kbd>V</kbd> anywhere on the page uploads from the clipboard.
</details>

---

## 🗺️ Roadmap

- [ ] Bulk import from browser bookmarks (HTML export)
- [ ] Full-text search with ranking
- [ ] Tag autocomplete and saved filters
- [ ] Optional public read-only share links
- [ ] Delete hosted images (ImgBB `delete_url` is currently discarded)

Have an idea? Open an issue — small, focused proposals get merged fastest.

---

## 🤝 Contributing

1. Fork, then `npm install`.
2. `npm test` and `npm run lint` must pass before you open a PR.
3. Keep the surface small: one adapter, one route, one component at a time.
4. Explain *why* in the PR description — the diff already shows *what*.

Bug reports are welcome; please include the exact request and response when it is an API issue.

---

## 📄 License

[MIT](LICENSE) © pavnxet

---

<p align="center">
  <b>Built for the "I'll read this later" pile that never gets read.</b><br>
  <sub>Next.js · Turso · Supabase · ImgBB · Tailwind CSS</sub>
</p>
