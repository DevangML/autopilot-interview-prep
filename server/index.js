#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'crypto';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { execFile } from 'child_process';
import { db, updateTimestamp } from './db.js';
import { ensureOllamaRunning, stopOllama, getOllamaStatus, isOllamaRunning } from './ollamaManager.js';

const PORT = process.env.API_PORT || 3001;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.LOCAL_JWT_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'devangmanjramkar@gmail.com,harshmanjramkar@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!GOOGLE_CLIENT_ID) {
  throw new Error('Missing GOOGLE_CLIENT_ID.');
}

if (!JWT_SECRET) {
  throw new Error('Missing LOCAL_JWT_SECRET.');
}

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));

if (ALLOWED_EMAILS.length > 0) {
  const placeholders = ALLOWED_EMAILS.map(() => '?').join(', ');
  db.prepare(`update users set is_allowed = 1 where lower(email) in (${placeholders})`).run(...ALLOWED_EMAILS);
}

const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email },
  JWT_SECRET,
  { expiresIn: '30d' }
);

const runCsvImport = (email) => new Promise((resolve, reject) => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/import-csvs.js');
  execFile(
    process.execPath,
    [scriptPath, '--email', email, '--make-tables'],
    { cwd: process.cwd() },
    (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    }
  );
});

const getUserById = (id) => db.prepare(
  'select id, email, full_name, gemini_key, ai_provider, ollama_url, ollama_model, is_allowed from users where id = ?'
).get(id);

const isEmailAllowed = (email) => {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing auth token.' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Invalid auth token.' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid auth token.' });
  }
};

const requireAllowed = (req, res, next) => {
  if (!req.user?.is_allowed) {
    res.status(403).json({ error: 'Access not allowed.' });
    return;
  }
  next();
};

// Dev mode: Bypass OAuth for testing
app.post('/auth/dev', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Dev mode not available in production.' });
    return;
  }
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Missing email.' });
    return;
  }
  
  // Find user by email
  const user = db.prepare('select id, email, full_name, gemini_key, ai_provider, ollama_url, ollama_model, is_allowed from users where lower(email) = lower(?)').get(email);
  if (!user) {
    res.status(404).json({ error: 'User not found. Sign in with Google first to create account.' });
    return;
  }
  
  const token = signToken(user);
  res.json({ token, user });
});

app.post('/auth/google', async (req, res) => {
  const { idToken } = req.body || {};
  
  // Handle dev mode token
  if (idToken?.startsWith('dev_token_')) {
    const actualToken = idToken.replace('dev_token_', '');
    try {
      const payload = jwt.verify(actualToken, JWT_SECRET);
      const user = getUserById(payload.sub);
      if (user) {
        res.json({ token: actualToken, user });
        return;
      }
    } catch (err) {
      // Fall through to normal OAuth flow
    }
  }
  
  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken.' });
    return;
  }

  try {
    // Try to decode token first to check audience
    let tokenAudience = null;
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        tokenAudience = payload.aud;
      }
    } catch (decodeErr) {
      // Ignore decode errors
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }

    const allowed = isEmailAllowed(payload.email);
    const existing = getUserById(payload.sub);
    if (!existing) {
      db.prepare(`
        insert into users (id, email, full_name, is_allowed)
        values (?, ?, ?, ?)
      `).run(payload.sub, payload.email, payload.name || null, allowed ? 1 : 0);
    } else {
      db.prepare(`
        update users set email = ?, full_name = ?, is_allowed = ? where id = ?
      `).run(payload.email, payload.name || null, allowed ? 1 : 0, payload.sub);
      updateTimestamp('users', payload.sub);
    }

    const user = getUserById(payload.sub);
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('[Auth] Google token verification error:', err.message);
    console.error('[Auth] Expected client ID:', GOOGLE_CLIENT_ID);
    
    // Try to decode the token to see what audience it has
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.error('[Auth] Token audience:', payload.aud);
        console.error('[Auth] Token issuer:', payload.iss);
        console.error('[Auth] Token email:', payload.email);
        
        if (payload.aud !== GOOGLE_CLIENT_ID) {
          res.status(401).json({ 
            error: 'Google token verification failed: Client ID mismatch.',
            details: `Expected: ${GOOGLE_CLIENT_ID}, Got: ${payload.aud}`
          });
          return;
        }
      }
    } catch (decodeErr) {
      // Ignore decode errors
    }
    
    res.status(401).json({ 
      error: 'Google token verification failed.',
      details: err.message || 'Unknown error'
    });
  }
});

app.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.patch('/me', authMiddleware, (req, res) => {
  const { gemini_key, ai_provider, ollama_url, ollama_model } = req.body || {};
  db.prepare(`
    update users 
    set gemini_key = ?, 
        ai_provider = ?,
        ollama_url = ?,
        ollama_model = ?
    where id = ?
  `).run(
    gemini_key || null,
    ai_provider || 'gemini',
    ollama_url || null,
    ollama_model || null,
    req.user.id
  );
  updateTimestamp('users', req.user.id);
  res.json(getUserById(req.user.id));
});

app.get('/source-databases', authMiddleware, requireAllowed, (req, res) => {
  const rows = db.prepare(`
    select id, title, domain, confidence, item_count, filename,
      schema_hash, schema_snapshot, confirmed_schema_hash, confirmed_schema_snapshot
    from source_databases
    where user_id = ?
    order by title asc
  `).all(req.user.id);
  res.json(rows);
});

app.patch('/source-databases/:id', authMiddleware, requireAllowed, (req, res) => {
  const { domain } = req.body || {};
  if (!domain) {
    res.status(400).json({ error: 'Missing domain.' });
    return;
  }
  const stmt = db.prepare(`
    update source_databases set domain = ? where id = ? and user_id = ?
  `);
  const info = stmt.run(domain, req.params.id, req.user.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Database not found.' });
    return;
  }
  db.prepare(`
    update learning_items
    set domain = ?
    where user_id = ? and source_database_id = ?
  `).run(domain, req.user.id, req.params.id);
  updateTimestamp('source_databases', req.params.id);
  const updated = db.prepare(`
    select id, title, domain, confidence, item_count, filename,
      schema_hash, schema_snapshot, confirmed_schema_hash, confirmed_schema_snapshot
    from source_databases
    where id = ?
  `).get(req.params.id);
  res.json(updated);
});

app.post('/source-databases/:id/confirm-schema', authMiddleware, requireAllowed, (req, res) => {
  const info = db.prepare(`
    update source_databases
    set confirmed_schema_hash = schema_hash,
        confirmed_schema_snapshot = schema_snapshot,
        updated_at = datetime('now')
    where id = ? and user_id = ?
  `).run(req.params.id, req.user.id);

  if (info.changes === 0) {
    res.status(404).json({ error: 'Database not found.' });
    return;
  }

  const updated = db.prepare(`
    select id, title, domain, confidence, item_count, filename,
      schema_hash, schema_snapshot, confirmed_schema_hash, confirmed_schema_snapshot
    from source_databases
    where id = ?
  `).get(req.params.id);
  res.json(updated);
});

app.post('/imports/csvs', authMiddleware, requireAllowed, async (req, res) => {
  try {
    const result = await runCsvImport(req.user.email);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'CSV import failed.' });
  }
});

app.get('/items', authMiddleware, requireAllowed, (req, res) => {
  const sourceDatabaseId = req.query.sourceDatabaseId;
  if (!sourceDatabaseId) {
    res.status(400).json({ error: 'Missing sourceDatabaseId.' });
    return;
  }
  const rows = db.prepare(`
    select li.id, li.name, sd.domain as domain, li.difficulty, li.pattern, li.completed, li.source_database_id, li.raw
    from learning_items li
    join source_databases sd on sd.id = li.source_database_id
    where li.user_id = ? and li.source_database_id = ?
    order by name asc
  `).all(req.user.id, sourceDatabaseId);
  res.json(rows);
});

app.post('/items', authMiddleware, requireAllowed, (req, res) => {
  console.log('[POST /items] Request received:', {
    userId: req.user?.id,
    body: req.body,
    hasSourceDatabaseId: !!req.body?.sourceDatabaseId,
    hasName: !!req.body?.name,
    hasDomain: !!req.body?.domain
  });

  const { sourceDatabaseId, name, domain, difficulty, pattern, raw } = req.body || {};
  
  if (!sourceDatabaseId || !name || !domain) {
    const error = 'Missing required fields: sourceDatabaseId, name, domain.';
    console.error('[POST /items] Validation failed:', {
      sourceDatabaseId: !!sourceDatabaseId,
      name: !!name,
      domain: !!domain,
      body: req.body
    });
    res.status(400).json({ error });
    return;
  }

  // Verify source database belongs to user
  const sourceDb = db.prepare(`
    select id, domain, title from source_databases
    where id = ? and user_id = ?
  `).get(sourceDatabaseId, req.user.id);

  console.log('[POST /items] Source database lookup:', {
    sourceDatabaseId,
    userId: req.user.id,
    found: !!sourceDb,
    sourceDb
  });

  if (!sourceDb) {
    // Check if database exists but belongs to different user
    const anyDb = db.prepare('select id, user_id from source_databases where id = ?').get(sourceDatabaseId);
    if (anyDb) {
      console.error('[POST /items] Database exists but wrong user:', {
        requestedUserId: req.user.id,
        actualUserId: anyDb.user_id
      });
      res.status(403).json({ error: 'Source database access denied. Database belongs to different user.' });
    } else {
      console.error('[POST /items] Database not found:', sourceDatabaseId);
      res.status(404).json({ error: `Source database not found: ${sourceDatabaseId}` });
    }
    return;
  }

  // Create row hash for uniqueness
  const rowHash = crypto.createHash('sha256')
    .update(`${name}|${domain}|${JSON.stringify(raw || {})}`)
    .digest('hex');

  const id = crypto.randomUUID();
  const rawJson = typeof raw === 'string' ? raw : JSON.stringify(raw || {});

  try {
    console.log('[POST /items] Inserting item:', {
      id,
      userId: req.user.id,
      sourceDatabaseId,
      name,
      domain,
      difficulty,
      pattern,
      rowHash: rowHash.substring(0, 16) + '...'
    });

    db.prepare(`
      insert into learning_items (
        id, user_id, source_database_id, name, domain, difficulty, pattern, completed, raw, row_hash
      )
      values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      req.user.id,
      sourceDatabaseId,
      name,
      domain,
      difficulty || null,
      pattern || null,
      rawJson,
      rowHash
    );

    console.log('[POST /items] Item inserted, updating count');

    // Update item count in source database
    db.prepare(`
      update source_databases
      set item_count = item_count + 1, updated_at = datetime('now')
      where id = ?
    `).run(sourceDatabaseId);

    const created = db.prepare(`
      select li.id, li.name, sd.domain as domain, li.difficulty, li.pattern, li.completed, li.source_database_id, li.raw
      from learning_items li
      join source_databases sd on sd.id = li.source_database_id
      where li.id = ?
    `).get(id);

    console.log('[POST /items] Item created successfully:', {
      id: created?.id,
      name: created?.name
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /items] Database error:', {
      error: err.message,
      code: err.code,
      stack: err.stack,
      itemData: { name, domain, sourceDatabaseId }
    });
    
    if (err.message.includes('UNIQUE constraint')) {
      res.status(409).json({ 
        error: 'Item already exists (duplicate row hash).',
        details: err.message 
      });
    } else {
      res.status(500).json({ 
        error: err.message || 'Failed to create item.',
        details: err.code || 'Unknown database error'
      });
    }
  }
});

app.get('/attempts', authMiddleware, requireAllowed, (req, res) => {
  const itemId = req.query.itemId;
  const stmt = itemId
    ? db.prepare(`
        select id, item_id, result, confidence, mistake_tags, time_spent_min, hint_used, created_at
        from attempts
        where user_id = ? and item_id = ?
        order by created_at desc
      `)
    : db.prepare(`
        select id, item_id, result, confidence, mistake_tags, time_spent_min, hint_used, created_at
        from attempts
        where user_id = ?
        order by created_at desc
      `);
  const rows = itemId ? stmt.all(req.user.id, itemId) : stmt.all(req.user.id);
  const normalized = rows.map(row => ({
    ...row,
    mistake_tags: row.mistake_tags ? JSON.parse(row.mistake_tags) : []
  }));
  res.json(normalized);
});

app.post('/attempts', authMiddleware, requireAllowed, (req, res) => {
  const { itemId, result, confidence, mistakeTags, timeSpent, hintUsed } = req.body || {};
  if (!itemId) {
    res.status(400).json({ error: 'Missing itemId.' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(`
    insert into attempts (id, user_id, item_id, result, confidence, mistake_tags, time_spent_min, hint_used)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user.id,
    itemId,
    result || 'Solved',
    confidence || null,
    JSON.stringify(mistakeTags || []),
    typeof timeSpent === 'number' ? timeSpent : null,
    hintUsed ? 1 : 0
  );

  const created = db.prepare(`
    select id, item_id, result, confidence, mistake_tags, time_spent_min, hint_used, created_at
    from attempts
    where id = ?
  `).get(id);

  res.status(201).json({
    ...created,
    mistake_tags: created.mistake_tags ? JSON.parse(created.mistake_tags) : []
  });
});

// External Progress Logging endpoints
app.get('/external-attempts', authMiddleware, requireAllowed, (req, res) => {
  const { domain, limit = 100 } = req.query;
  const stmt = domain
    ? db.prepare(`
        select id, domain, topic_or_pattern, source, difficulty, outcome, learnings, reference_url, created_at
        from external_attempts
        where user_id = ? and domain = ?
        order by created_at desc
        limit ?
      `)
    : db.prepare(`
        select id, domain, topic_or_pattern, source, difficulty, outcome, learnings, reference_url, created_at
        from external_attempts
        where user_id = ?
        order by created_at desc
        limit ?
      `);
  const rows = domain ? stmt.all(req.user.id, domain, limit) : stmt.all(req.user.id, limit);
  res.json(rows);
});

app.post('/external-attempts', authMiddleware, requireAllowed, (req, res) => {
  const { domain, topicOrPattern, source, difficulty, outcome, learnings, referenceUrl } = req.body || {};
  
  if (!domain || !source || !outcome || !learnings) {
    res.status(400).json({ error: 'Missing required fields: domain, source, outcome, learnings.' });
    return;
  }

  const validOutcomes = ['Solved', 'Partial', 'Stuck'];
  if (!validOutcomes.includes(outcome)) {
    res.status(400).json({ error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(`
    insert into external_attempts (id, user_id, domain, topic_or_pattern, source, difficulty, outcome, learnings, reference_url)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user.id,
    domain,
    topicOrPattern || null,
    source,
    typeof difficulty === 'number' ? difficulty : null,
    outcome,
    learnings,
    referenceUrl || null
  );

  const created = db.prepare(`
    select id, domain, topic_or_pattern, source, difficulty, outcome, learnings, reference_url, created_at
    from external_attempts
    where id = ?
  `).get(id);

  res.status(201).json(created);
});

app.delete('/external-attempts/:id', authMiddleware, requireAllowed, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('select id from external_attempts where id = ? and user_id = ?').get(id, req.user.id);
  if (!existing) {
    res.status(404).json({ error: 'External attempt not found.' });
    return;
  }
  db.prepare('delete from external_attempts where id = ? and user_id = ?').run(id, req.user.id);
  res.status(204).send();
});

// Reset domain progress (uncomplete all items in a domain)
app.post('/items/reset-domain', authMiddleware, requireAllowed, (req, res) => {
  const { domain } = req.body || {};
  if (!domain) {
    res.status(400).json({ error: 'Missing domain.' });
    return;
  }

  // Reset completed status for all items in the domain (both items and learning_items tables)
  const result1 = db.prepare(`
    update items 
    set completed = 0, updated_at = datetime('now')
    where user_id = ? and domain = ?
  `).run(req.user.id, domain);

  const result2 = db.prepare(`
    update learning_items 
    set completed = 0, updated_at = datetime('now')
    where user_id = ? and domain = ?
  `).run(req.user.id, domain);

  res.json({
    success: true,
    itemsUpdated: result1.changes,
    learningItemsUpdated: result2.changes,
    totalUpdated: result1.changes + result2.changes
  });
});

// Uncomplete a single item
app.patch('/items/:id/uncomplete', authMiddleware, requireAllowed, (req, res) => {
  const { id } = req.params;
  
  // Try to update in items table first
  let result = db.prepare(`
    update items 
    set completed = 0, updated_at = datetime('now')
    where id = ? and user_id = ?
  `).run(id, req.user.id);

  // If not found in items, try learning_items
  if (result.changes === 0) {
    result = db.prepare(`
      update learning_items 
      set completed = 0, updated_at = datetime('now')
      where id = ? and user_id = ?
    `).run(id, req.user.id);
  }

  if (result.changes === 0) {
    res.status(404).json({ error: 'Item not found.' });
    return;
  }

  res.json({ success: true, updated: true });
});

// Ollama management endpoints
app.post('/ollama/ensure-running', authMiddleware, requireAllowed, async (req, res) => {
  try {
    const { model } = req.body || {};
    const modelName = model || 'qwen2.5:7b'; // Default to recommended model
    await ensureOllamaRunning(modelName);
    res.json({ success: true, message: 'Ollama is running' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to start Ollama' });
  }
});

app.post('/ollama/stop', authMiddleware, requireAllowed, async (req, res) => {
  try {
    const { model } = req.body || {};
    const modelName = model || 'qwen2.5:7b'; // Default to recommended model
    await stopOllama(modelName);
    res.json({ success: true, message: `Ollama stopped (model: ${modelName})` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to stop Ollama' });
  }
});

app.get('/ollama/status', authMiddleware, requireAllowed, async (req, res) => {
  try {
    const status = await getOllamaStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to get Ollama status' });
  }
});

app.listen(PORT, () => {
  console.log(`Local API running at http://localhost:${PORT}`);
  console.log(`[Server] Available routes:`);
  console.log(`  POST /items - Create new learning item`);
  console.log(`  GET /items - Get items by source database`);
  console.log(`  POST /items/reset-domain - Reset domain progress`);
  console.log(`  PATCH /items/:id/uncomplete - Uncomplete an item`);
  console.log(`  POST /ollama/ensure-running - Start Ollama if not running`);
  console.log(`  POST /ollama/stop - Stop Ollama service`);
  console.log(`  GET /ollama/status - Get Ollama status`);
});
