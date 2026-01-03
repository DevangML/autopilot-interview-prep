# Quick Start Guide (Local DB + Google Auth)

## Overview

This app no longer connects to Notion directly. You export your Notion databases as CSV files once, import them into a local SQLite database, and run the app against the local API.

## 1) Create Google OAuth Credentials

1. Create OAuth credentials in Google Cloud.
2. Add `http://localhost:5173` to the authorized origins.
3. Copy the OAuth Client ID.

## 2) Configure Environment

Create `.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GEMINI_KEY=optional_gemini_key
GOOGLE_CLIENT_ID=your_google_client_id
LOCAL_JWT_SECRET=your_random_secret
ALLOWED_EMAILS=devangmanjramkar@gmail.com,harshmanjramkar@gmail.com
DB_PATH=server/data/app.db
```

## 3) Export Notion CSVs

For each Notion database:

1. Open the database in Notion.
2. Click **•••** → **Export** → **CSV**.
3. Save the CSV into `data/` (one file per database).

## 4) Import CSVs

Run the importer (use the email you sign in with):

```bash
npm run import:csv -- --email you@example.com
```

The importer:
- Stores every row locally
- Classifies each database by domain
- Is idempotent (safe to run multiple times)

## 5) Run the App

```bash
npm run dev:all
```

Open `http://localhost:5173`, sign in with Google, and start a session.

## Notes

- If a database is tagged as **Unknown**, open Settings and assign a domain.
- Attempts are stored in the local database automatically.

## Allow the Two Users

After each user signs in once, allow them in the local DB:

```bash
sqlite3 server/data/app.db "update users set is_allowed = 1 where email in ('user1@example.com','user2@example.com');"
```
