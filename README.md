# 🏗️ Link Vault Web

> A **private, cloud-native personal knowledge hub** for your clipboard.
> Effortlessly save, organize, and retrieve your digital footprint.

![Link Vault Dashboard](https://images.unsplash.com/photo-1555421689-d68471e189f2?auto=format&fit=crop&q=80&w=1000)

## 🌟 Project Vision

**Link Vault Web** transforms the chaotic process of saving links into a streamlined, zen-like experience. Designed as a "Single-User Personal Knowledge Hub," it replaces local clipboard tools and chat-based saving methods with a robust, persistent cloud database.

Say goodbye to "I'll read this later" disappearing into the void.

---

## 🚀 Key Features

### 🔒 **Fortress-Level Privacy**
*   **Zero Public Access**: No sign-up page. Access is strictly controlled via server-side environment secrets (`ADMIN_USERNAME` & `ADMIN_PASSWORD`).
*   **Middleware Protection**: Every route is guarded. Unauthorized visitors get a 404 or a login screen.

### ⚡ **Rapid "Paste & Go" Entry**
*   **Smart Auto-Counter**: Automatically suggests the next ID (e.g., `#42` -> `#43`) based on your entire database history.
*   **Auto-Scraping**: Paste a URL, and the system instantly fetches the page title.
*   **Intelligent Categorization**: Detects the domain (YouTube, GitHub, etc.) and keywords to auto-assign emojis and hashtags (e.g., 📺 #Video, 💻 #Code).

### 🎛️ **Powerful Management**
*   **Live Search**: Instantly filter your library by title, URL, or category.
*   **Inline Editing**: Fix typos or update categories without leaving the dashboard.
*   **Safety First**: Confirmation prompts preventing accidental deletions.
*   **Drag, Drop, Paste & Camera Image Hosting**: Drop an image anywhere on the dashboard, paste one with `Ctrl+V`, or shoot it with the **Camera** button — it is uploaded to [ImgBB](https://imgbb.com/) and saved as a vault entry with its hosted URL.

### 💾 **Data Sovereignty**
*   **Multi-Database Support**: Choose between **Supabase (PostgreSQL)** or **Turso (SQLite)** using the `DB_PROVIDER` setting.
*   **One-Click Backup**: Export your entire vault to a standardized `.json` file.
*   **Smart Restore**: Import backups with automatic deduplication and counter synchronization.

---

## 🛠️ Tech Stack

Built with modern, performance-obsessed technologies:

*   **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions)
*   **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) (Dark Mode Default)
*   **Databases**: 
    *   [Supabase](https://supabase.com/) (PostgreSQL)
    *   [Turso](https://turso.tech/) (SQLite/LibSQL)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Scraping**: [Cheerio](https://cheerio.js.org/)
*   **Testing**: [Node.js Test Runner](https://nodejs.org/api/test.html)

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 20+ (Required for experimental strip types in tests)
*   A [Supabase](https://supabase.com/) or [Turso](https://turso.tech/) account.

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/link-vault-web.git
cd link-vault-web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env.local` file in the root directory:
```bash
cp .env.local.example .env.local
```

Fill in your secrets based on your chosen provider:

```env
# Database Provider Choice ('supabase' or 'turso')
DB_PROVIDER=turso

# If using Supabase:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# If using Turso:
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token

# Admin Access (You choose these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=super_secret_password

# ImgBB image uploads (server-side only)
IMGBB_API_KEY=your_imgbb_api_key
```

### 4. Setup Database
Depending on your provider, run the SQL initialization:
- **Supabase**: Run the commands in `schema.sql` in the Supabase SQL Editor.
- **Turso**: Run the commands in `turso-schema.sql` using the Turso CLI or Dashboard.

### 5. Ignite!
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and log in with your credentials.

---

## 🧪 Testing

The project includes a suite of automated tests using the native Node.js test runner.

```bash
# Run all tests
npm test
```

The runner (`test/run.mjs`) collects every `*.test.ts` file under `app/`, `lib/` and `components/`
and executes them with [tsx](https://tsx.is/), so no build step is needed. `tsconfig.test.json`
maps `next/headers` to a mock used by the login route test.

### Image upload tests

*   `lib/imgbb.test.ts` — magic-byte sniffing, base64 request shape, key handling, and every
    ImgBB failure mode (missing key, oversize, HTTP error, non-JSON, network failure). The API
    key is asserted never to appear in an error message.
*   `app/api/upload/route.test.ts` — the `/api/upload` route end to end against a temporary
    SQLite database, with ImgBB mocked: 400/413/415/500/502 paths, the happy path that saves a
    `🖼️ #Image` link, and the case where the image uploads but the vault insert fails.

No test needs a real ImgBB key or network access.

---

## 📖 User Guide

### Adding a Link
1.  **Paste**: Drop a URL into the input field.
2.  **Wait**: Watch the **Page Title** and **Category** auto-fill in seconds.
3.  **Save**: Hit Enter or click the `+` button. The **Title** ID increments automatically!

### Uploading an Image
Four ways, all identical under the hood:
*   **Camera** button in the header — opens a live preview from your webcam or phone camera and uploads the frame you capture.
*   **Upload Image** button in the header — opens a file picker (multi-select).
*   **Drag & drop** any image file (PNG, JPEG, GIF, WebP, BMP, TIFF, AVIF, SVG — up to 32 MB) anywhere on the dashboard.
*   **Paste** with `Ctrl+V` / `Cmd+V` when the clipboard holds an image (a screenshot, a copied picture, "Copy image" from a browser). Pasting text or URLs into the fields still works normally.

The file is sent to `/api/upload`, uploaded to ImgBB with your server-side key.
It then appears in the table as a new entry categorised `🖼️ #Image`. A toast shows the
    hosted URL with a one-click copy button.

**About the camera:** frames are captured in the browser and encoded to JPEG before upload, scaled
to at most 2048 px on the long edge so a 4K webcam does not produce a 6 MB file. The **Switch**
button toggles between rear and front camera. `getUserMedia` needs a secure context (https or
localhost); if it is unavailable or the permission is denied, the modal offers a one-click fallback
that opens the device's own camera app via `<input capture="environment">`. No video ever leaves the
browser — only the single captured frame is uploaded.

The ImgBB API key stays on the server. The browser never receives it — the client only talks to
`/api/upload`.

### Restoring a Backup
1.  Click the **Restore** (Upload) button in the header.
2.  Select your `.json` backup file.
3.  Confirm the merge. The system will skip duplicates and sync the "Next ID" counter to the new highest number.

---

## ☁️ Deployment

The easiest way to deploy is **Vercel**.

1.  Push your code to a Git repository.
2.  Import the project into Vercel.
3.  Add your Environment Variables in the Vercel Dashboard.
4.  **Deploy!**

---

## 📜 License

MIT License. Built for personal productivity.
