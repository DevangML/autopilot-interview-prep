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
    res.status(401).json({ error: 'Google token verification failed.' });
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

app.listen(PORT, () => {
  console.log(`Local API running at http://localhost:${PORT}`);
});
