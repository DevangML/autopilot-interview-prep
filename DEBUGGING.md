# Debugging Guide: No Questions & Buttons Not Working

## Common Issues & Solutions

### 1. Google OAuth Error: "The given origin is not allowed"

**Error Message:**
```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
```

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:5173
   ```
4. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:5173/oauth-redirect.html
   ```
5. Click **Save**
6. Wait 1-2 minutes for changes to propagate
7. Refresh the page

### 2. Backend Server Not Running

**Check:**
```bash
lsof -ti:3001
```

**Start server:**
```bash
npm run dev:server
```

Or run both frontend and backend:
```bash
npm run dev:all
```

### 3. No Questions Appearing

**Prerequisites Checklist:**
- [ ] Signed in with Google
- [ ] User is allowed (check `is_allowed = 1` in database)
- [ ] CSVs imported (Settings → Import CSVs from data/)
- [ ] All databases have domains assigned (no "Unknown" domains)
- [ ] No pending schema confirmations
- [ ] Gemini API key configured in Settings

**Steps:**
1. **Sign In**: Click "Sign in with Google" button
2. **Check Access**: If you see "Access Required", your email needs to be allowed:
   ```bash
   sqlite3 server/data/app.db "update users set is_allowed = 1 where email = 'your@email.com';"
   ```
3. **Import Data**: 
   - Open Settings (gear icon)
   - Click "Import CSVs from data/"
   - Wait for import to complete
4. **Assign Domains**:
   - In Settings, assign domains to any "Unknown" databases
   - Use the domain dropdown or type domain names
5. **Configure Gemini**:
   - In Settings, add your Gemini API key
   - Click "Save"
6. **Start Session**:
   - Go back to main screen
   - Select duration and focus mode
   - Click "Start Session"

### 4. Buttons Not Working

**Possible Causes:**
1. **JavaScript Errors**: Check browser console (F12)
2. **Missing Environment Variables**: Check `.env` file
3. **Backend Not Responding**: Check network tab for failed API calls
4. **Not Signed In**: Must be authenticated first

**Debug Steps:**
1. Open browser DevTools (F12)
2. Check **Console** tab for errors
3. Check **Network** tab for failed requests
4. Verify `.env` file exists with:
   ```
   VITE_API_URL=http://localhost:3001
   VITE_GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_ID=your_client_id
   LOCAL_JWT_SECRET=your_secret
   ```

### 5. Environment Variables

Create `.env` file in project root:
```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GEMINI_KEY=optional_gemini_key
GOOGLE_CLIENT_ID=your_google_client_id
LOCAL_JWT_SECRET=your_random_secret
DB_PATH=server/data/app.db
```

### 6. Database Setup

**Check if database exists:**
```bash
ls -la server/data/app.db
```

**If missing, create it:**
```bash
mkdir -p server/data
# Database will be created on first import
```

**Allow users:**
```bash
sqlite3 server/data/app.db "update users set is_allowed = 1 where email in ('user1@example.com', 'user2@example.com');"
```

### 7. Testing the Flow

**Step-by-step test:**
1. ✅ Page loads without errors
2. ✅ Google Sign-In button visible
3. ✅ Click Sign-In → Should open Google popup
4. ✅ After sign-in → Should see main screen or "Access Required"
5. ✅ If "Access Required" → Allow user in database
6. ✅ Open Settings → Should see import button
7. ✅ Import CSVs → Should see databases listed
8. ✅ Assign domains → Should remove "Unknown" databases
9. ✅ Add Gemini key → Should save successfully
10. ✅ Start Session → Should show "Composing your session..."
11. ✅ After orchestration → Should show WorkUnit with question

### 8. Common Error Messages

**"No imported databases found"**
→ Import CSVs from Settings

**"Assign domains to all imported databases"**
→ Go to Settings and assign domains

**"Schema changes need confirmation"**
→ Go to Settings and confirm schema changes

**"Add your Gemini API key"**
→ Go to Settings and add Gemini key

**"Access Required"**
→ Allow user in database:
```bash
sqlite3 server/data/app.db "update users set is_allowed = 1 where email = 'your@email.com';"
```

### 9. Network Debugging

**Check API calls:**
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for:
   - `/auth/google` - Should return 200 with token
   - `/me` - Should return 200 with user profile
   - `/source-databases` - Should return 200 with databases array
   - `/items?sourceDatabaseId=...` - Should return 200 with items

**Common API Errors:**
- `401 Unauthorized` → Not signed in or token expired
- `403 Forbidden` → User not allowed
- `500 Internal Server Error` → Check server logs

### 10. Server Logs

**Check server output:**
```bash
npm run dev:server
```

Look for:
- Server started on port 3001
- Database connection successful
- API requests logged
- Any error messages

## Quick Fix Checklist

1. ✅ Google OAuth: Add `http://localhost:5173` to authorized origins
2. ✅ Backend running: `npm run dev:server` or `npm run dev:all`
3. ✅ Environment variables: Check `.env` file exists
4. ✅ Signed in: Google Sign-In successful
5. ✅ User allowed: `is_allowed = 1` in database
6. ✅ Data imported: CSVs imported from `data/` folder
7. ✅ Domains assigned: No "Unknown" databases
8. ✅ Gemini key: Added in Settings
9. ✅ No schema pending: All schemas confirmed
10. ✅ Start session: Click "Start Session" button

## Still Not Working?

1. **Clear browser cache and localStorage:**
   - DevTools → Application → Clear storage
   
2. **Restart everything:**
   ```bash
   # Stop all processes
   # Then restart
   npm run dev:all
   ```

3. **Check browser console for specific errors**

4. **Verify all files are present:**
   - `server/data/app.db` exists
   - `data/*.csv` files exist
   - `.env` file exists

