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

  create index if not exists idx_source_databases_user on source_databases (user_id);
  create index if not exists idx_items_user on items (user_id);
  create index if not exists idx_items_source on items (source_database_id);
  create index if not exists idx_attempts_user on attempts (user_id);
  create index if not exists idx_attempts_item on attempts (item_id);
`);

export const updateTimestamp = (table, id) => {
  db.prepare(`update ${table} set updated_at = datetime('now') where id = ?`).run(id);
};
