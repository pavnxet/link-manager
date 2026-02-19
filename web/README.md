# Link Vault

A Single-User Personal Knowledge Hub for saving and organizing links.

## Setup

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    Copy `.env.local.example` to `.env.local` and fill in your Supabase and Admin credentials.
    ```bash
    cp .env.local.example .env.local
    ```
    - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
    - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (for backend operations).
    - `ADMIN_USERNAME`: Your desired username.
    - `ADMIN_PASSWORD`: Your desired password.

4.  **Database Setup**:
    Run the SQL commands in `schema.sql` in your Supabase SQL Editor to create the `links` table.

5.  **Run the application**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000).

## Features

- **Secure Access**: Simple password protection.
- **Auto-Scraping**: Fetches page titles automatically.
- **Categorization**: Auto-assigns emojis and hashtags.
- **Auto-Counter**: Incrementing IDs for links.
- **Backup/Restore**: Export and import your data as JSON.
