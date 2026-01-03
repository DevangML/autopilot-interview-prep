import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'server/data/app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  create table if not exists users (
    id text primary key,
    email text,
    full_name text,
    gemini_key text,
    is_allowed integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );

  create table if not exists source_databases (
    id text primary key,
    user_id text not null,
    title text not null,
    filename text not null,
    domain text not null,
    confidence real not null,
    schema_hash text not null,
    schema_snapshot text,
    confirmed_schema_hash text,
    confirmed_schema_snapshot text,
    item_count integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    unique (user_id, filename)
  );

  create table if not exists items (
    id text primary key,
    user_id text not null,
    source_database_id text not null,
    name text,
    domain text not null,
    difficulty integer,
    pattern text,
    completed integer not null default 0,
    raw text not null,
    row_hash text not null,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    unique (user_id, source_database_id, row_hash)
  );

  create table if not exists learning_items (
    id text primary key,
    user_id text not null,
    source_database_id text not null,
    name text,
    domain text not null,
    difficulty integer,
    pattern text,
    completed integer not null default 0,
    raw text not null,
    row_hash text not null,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    unique (user_id, source_database_id, row_hash)
  );

  create table if not exists attempts (
    id text primary key,
    user_id text not null,
    item_id text not null,
    result text not null,
    confidence text,
    mistake_tags text,
    time_spent_min integer,
    hint_used integer not null default 0,
    created_at text not null default (datetime('now'))
  );

  create table if not exists sessions (
    id text primary key,
    user_id text not null,
    total_minutes integer not null,
    focus_mode text not null,
    units text not null,
    started_at text not null,
    ended_at text
  );

  create table if not exists metadata (
    key text primary key,
    value text,
    updated_at text not null default (datetime('now'))
  );

  create index if not exists idx_source_databases_user on source_databases (user_id);
  create index if not exists idx_items_user on items (user_id);
  create index if not exists idx_items_source on items (source_database_id);
  create index if not exists idx_learning_items_user on learning_items (user_id);
  create index if not exists idx_learning_items_source on learning_items (source_database_id);
  create index if not exists idx_attempts_user on attempts (user_id);
  create index if not exists idx_attempts_item on attempts (item_id);
`);

const ensureColumn = (table, column, type) => {
  const columns = db.prepare(`pragma table_info(${table})`).all();
  if (!columns.some(col => col.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${type}`);
  }
};

ensureColumn('source_databases', 'schema_snapshot', 'text');
ensureColumn('source_databases', 'confirmed_schema_hash', 'text');
ensureColumn('source_databases', 'confirmed_schema_snapshot', 'text');

try {
  const countRow = db.prepare('select count(*) as count from learning_items').get();
  if (countRow?.count === 0) {
    db.exec(`
      insert into learning_items (
        id, user_id, source_database_id, name, domain, difficulty, pattern,
        completed, raw, row_hash, created_at, updated_at
      )
      select id, user_id, source_database_id, name, domain, difficulty, pattern,
        completed, raw, row_hash, created_at, updated_at
      from items
    `);
  }
} catch {
  // Ignore migration errors (e.g., items table missing in fresh DB)
}

export const updateTimestamp = (table, id) => {
  db.prepare(`update ${table} set updated_at = datetime('now') where id = ?`).run(id);
};
