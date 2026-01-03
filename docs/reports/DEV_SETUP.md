# Development Setup Guide

## Quick Start

```bash
npm run dev:all
```

Open `http://localhost:5173`.

## Required Services

- Local API server (`npm run dev:server` is included in `dev:all`)
- Google OAuth client ID
- CSV data imported via `npm run import:csv`

## Import CSVs

1. Drop exported Notion CSVs into `data/`.
2. Run:
   ```bash
   npm run import:csv -- --email you@example.com
   ```

## Troubleshooting

**Sign-in fails:**
- Verify Google OAuth redirect URLs include `http://localhost:5173`
- Check `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`

**No data in app:**
- Confirm `npm run import:csv` completed successfully
- Use Settings → Refresh
