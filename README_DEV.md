# Local Development - Quick Start

## 🚀 Fastest Way to Start Developing

```bash
npm run dev:all
```

Then open: `http://localhost:5173`

## Development Options

### Option 1: Web App (Recommended)
```bash
npm run dev:all
```

### Option 2: Production Build
```bash
npm run build
npm run preview
```

## Troubleshooting

**Sign-in issues:**
- Check `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`
- Ensure the OAuth client allows `http://localhost:5173`

**API issues:**
- Check `VITE_API_URL` matches the local server (`http://localhost:3001`)

**Import issues:**
- Ensure CSVs are in `data/`
- Run `npm run import:csv -- --email you@example.com`
