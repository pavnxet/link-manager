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

### 💾 **Data Sovereignty**
*   **One-Click Backup**: Export your entire vault to a standardized `.json` file.
*   **Smart Restore**: Import backups with automatic deduplication and counter synchronization.

---

## 🛠️ Tech Stack

Built with modern, performance-obsessed technologies:

*   **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Dark Mode Default)
*   **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Scraping**: [Cheerio](https://cheerio.js.org/)

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 18+
*   A [Supabase](https://supabase.com/) account (Free tier is perfect)

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

Fill in your secrets:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin Access (You choose these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=super_secret_password
```

### 4. Setup Database
Go to your Supabase SQL Editor and run the commands found in `schema.sql`. This will create the `links` table and necessary indexes.

### 5. Ignite!
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and log in with your credentials.

---

## 📖 User Guide

### Adding a Link
1.  **Paste**: Drop a URL into the input field.
2.  **Wait**: Watch the **Page Title** and **Category** auto-fill in seconds.
3.  **Save**: Hit Enter or click the `+` button. The **Title** ID increments automatically!

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
