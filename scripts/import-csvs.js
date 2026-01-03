#!/usr/bin/env node

/**
 * Import CSV exports into the local SQLite DB.
 * Usage: npm run import:csv -- --email you@example.com [--make-tables]
 */

import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db } from '../server/db.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CHUNK_SIZE = 500;

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const makeTables = args.includes('--make-tables');

const importEmail = getArg('--email') || process.env.IMPORT_EMAIL;

if (!importEmail) {
  console.error('Provide --email to identify the target account.');
  process.exit(1);
}

const normalizeLabel = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const toSnake = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const toSafeIdentifier = (value, fallback) => {
  const base = toSnake(value);
  const safe = base || fallback;
  return /^[a-z]/.test(safe) ? safe : `col_${safe}`;
};

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

const buildCsvTableName = (fileName) =>
  `csv_${toSafeIdentifier(fileName, 'dataset')}`;

const buildColumnMappings = (headers = []) => {
  const used = new Set();
  return headers.map((header, index) => {
    const base = toSafeIdentifier(header, `col_${index + 1}`);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(name);
    return { header, column: name };
  });
};

const buildNormalizedHeaderMap = (headers = []) => {
  const map = new Map();
  headers.forEach((header) => {
    map.set(normalizeLabel(header), header);
  });
  return map;
};

const pickValue = (row, headerMap, candidates) => {
  for (const candidate of candidates) {
    const key = headerMap.get(normalizeLabel(candidate));
    if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return null;
};

const parseBoolean = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  if (normalized.includes('solved') || normalized.includes('done') || normalized.includes('complete')) return true;
  return false;
};

const parseDifficulty = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  const asNumber = parseInt(normalized, 10);
  if (!Number.isNaN(asNumber)) return asNumber;
  if (normalized.includes('easy')) return 2;
  if (normalized.includes('medium')) return 3;
  if (normalized.includes('hard')) return 4;
  return null;
};

const stableStringify = (obj) => {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(keys.reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {}));
};

const hashString = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const DOMAIN_TYPICAL_PROPERTIES = {
  DSA: ['Difficulty', 'Pattern', 'Topic', 'LeetCode Link', 'Leetcode Link', 'LeetCode URL', 'Problem Link', 'Company', 'Tags', 'CPRD: Difficulty'],
  OOP: ['Principles', 'Concepts', 'Examples', 'Design Pattern', 'UML', 'CPRD: Concepts'],
  OS: ['Processes', 'Threads', 'Memory', 'Scheduling', 'Synchronization', 'CPRD: Concepts'],
  DBMS: ['SQL', 'Queries', 'Normalization', 'Indexes', 'Transactions', 'CPRD: Concepts'],
  CN: ['Protocols', 'Layers', 'TCP', 'HTTP', 'OSI', 'CPRD: Concepts'],
  Behavioral: ['STAR', 'Situation', 'Action', 'Result', 'Story', 'CPRD: Story'],
  HR: ['Question', 'Answer', 'STAR', 'CPRD: Story'],
  OA: ['Company', 'Difficulty', 'Platform', 'Assessment', 'CPRD: Difficulty'],
  'Phone Screen': ['Question', 'Answer', 'Prompt', 'CPRD: Q&A'],
  Aptitude: ['Type', 'Difficulty', 'Category', 'CPRD: Difficulty'],
  Puzzles: ['Type', 'Difficulty', 'Solution', 'CPRD: Difficulty'],
  LLD: ['Design', 'Classes', 'Class', 'Relationships', 'UML', 'CPRD: Design'],
  HLD: ['Components', 'Scalability', 'Architecture', 'Tradeoffs', 'CPRD: Design']
};

const DOMAIN_KEYWORDS = {
  DSA: ['dsa', 'data structure', 'data structures', 'algorithm', 'algorithms', 'leetcode', 'neetcode', 'blind 75', 'coding'],
  OOP: ['oop', 'object oriented', 'object-oriented', 'class', 'inheritance', 'polymorphism', 'encapsulation'],
  OS: ['os', 'operating system', 'process', 'thread', 'memory', 'scheduling'],
  DBMS: ['dbms', 'database management', 'database', 'sql', 'query', 'normalization', 'transaction'],
  CN: ['cn', 'computer network', 'networks', 'network', 'tcp', 'http', 'protocol', 'osi'],
  Behavioral: ['behavioral', 'behavioural', 'story', 'star', 'situational'],
  HR: ['hr', 'human resource', 'human resources'],
  OA: ['oa', 'online assessment', 'assessment', 'coding test'],
  'Phone Screen': ['phone screen', 'phone interview', 'screening'],
  Aptitude: ['aptitude', 'quant', 'quantitative', 'math', 'logic'],
  Puzzles: ['puzzle', 'puzzles', 'brain teaser', 'riddle'],
  LLD: ['lld', 'low level design', 'low-level design', 'object design', 'class design'],
  HLD: ['hld', 'high level design', 'high-level design', 'system design', 'architecture']
};

const buildNormalizedPropertySet = (headers = []) =>
  new Set(headers.map(normalizeLabel));

const getDomainPropertyMatch = (domain, normalizedPropertySet) => {
  const typicalProps = DOMAIN_TYPICAL_PROPERTIES[domain] || [];
  const normalizedTypical = [...new Set(typicalProps.map(normalizeLabel))];
  const matchingProps = normalizedTypical.filter(prop => normalizedPropertySet.has(prop));
  return {
    matchCount: matchingProps.length,
    matchRatio: normalizedTypical.length > 0 ? matchingProps.length / normalizedTypical.length : 0
  };
};

const classifyDatabase = (title, headers) => {
  const titleLower = title.toLowerCase();
  const titleNormalized = titleLower.replace(/[^a-z0-9]+/g, ' ').trim();
  const titleSearch = `${titleLower} ${titleNormalized}`;
  const normalizedPropertySet = buildNormalizedPropertySet(headers);

  let matchedDomain = null;
  let titleConfidence = 0;

  Object.entries(DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
    const matchCount = keywords.filter(kw => titleSearch.includes(kw)).length;
    if (matchCount > 0) {
      const domainConfidence = matchCount / keywords.length;
      if (domainConfidence > titleConfidence) {
        titleConfidence = domainConfidence;
        matchedDomain = domain;
      }
    }
  });

  if (titleConfidence > 0.5) {
    titleConfidence = 0.5;
  }

  const schemaDomainScores = Object.keys(DOMAIN_TYPICAL_PROPERTIES).map(domain => {
    const { matchCount, matchRatio } = getDomainPropertyMatch(domain, normalizedPropertySet);
    return { domain, matchCount, matchRatio };
  }).sort((a, b) => {
    if (b.matchRatio !== a.matchRatio) return b.matchRatio - a.matchRatio;
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return a.domain.localeCompare(b.domain);
  });

  const bestSchema = schemaDomainScores[0];
  const schemaDomainCandidate = bestSchema && bestSchema.matchCount >= 2 && bestSchema.matchRatio >= 0.2
    ? bestSchema.domain
    : null;

  let schemaConfidence = 0;
  let hasCPRD = false;
  let hasDomainTypicalProps = false;

  const cprdProps = headers.filter(name => name.toLowerCase().startsWith('cprd:'));
  if (cprdProps.length > 0) {
    hasCPRD = true;
    schemaConfidence += 0.3;
  }

  const ambiguousTokens = ['interview', 'prep', 'notes', 'tracker', 'sheet', 'study'];
  const isAmbiguous = ambiguousTokens.some(token => titleLower.includes(token));
  const titleWeak = titleConfidence < 0.25;

  if (!matchedDomain && schemaDomainCandidate) {
    matchedDomain = schemaDomainCandidate;
  } else if (matchedDomain && schemaDomainCandidate && matchedDomain !== schemaDomainCandidate && (isAmbiguous || titleWeak)) {
    matchedDomain = schemaDomainCandidate;
  }

  if (matchedDomain && DOMAIN_TYPICAL_PROPERTIES[matchedDomain]) {
    const { matchCount, matchRatio } = getDomainPropertyMatch(matchedDomain, normalizedPropertySet);
    if (matchCount > 0) {
      hasDomainTypicalProps = true;
      schemaConfidence += 0.2 * matchRatio;
    }
  }

  const hasNameProperty = ['Name', 'Title', 'Problem', 'Question', 'Prompt']
    .some(key => normalizedPropertySet.has(normalizeLabel(key)));
  const hasCompletedProperty = ['Completed', 'Status', 'Done', 'Solved', 'Progress', 'Result']
    .some(key => normalizedPropertySet.has(normalizeLabel(key)));
  const hasLinkProperty = ['Link', 'URL', 'LeetCode Link', 'Leetcode Link', 'LeetCode URL', 'Problem Link', 'Reference', 'Resource']
    .some(key => normalizedPropertySet.has(normalizeLabel(key)));
  const hasDifficultyProperty = ['Difficulty', 'Level', 'CPRD: Difficulty']
    .some(key => normalizedPropertySet.has(normalizeLabel(key)));
  const isLearningSheet = hasNameProperty && (hasCompletedProperty || hasLinkProperty || hasDifficultyProperty);

  let finalConfidence;
  if (isAmbiguous && schemaConfidence > 0) {
    finalConfidence = Math.min(0.9, titleConfidence * 0.3 + schemaConfidence * 0.7);
  } else {
    finalConfidence = Math.min(0.9, titleConfidence + schemaConfidence);
  }

  if (hasCPRD && hasDomainTypicalProps && isLearningSheet) {
    finalConfidence = Math.max(0.6, finalConfidence);
  }

  return {
    domain: matchedDomain || 'Unknown',
    confidence: finalConfidence
  };
};

const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const sanitizeRow = (row) => {
  const cleaned = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      cleaned[key] = null;
    } else {
      const trimmed = String(value).trim();
      cleaned[key] = trimmed.length > 0 ? trimmed : null;
    }
  });
  return cleaned;
};

const ensureCsvTable = (tableName, columnMappings) => {
  const quotedTable = quoteIdentifier(tableName);
  const columnDefinitions = columnMappings
    .map(({ column }) => `${quoteIdentifier(column)} text`)
    .join(', ');

  db.exec(`
    create table if not exists ${quotedTable} (
      row_hash text primary key${columnDefinitions ? `, ${columnDefinitions}` : ''}
    )
  `);

  const existing = db.prepare(`pragma table_info(${quotedTable})`).all();
  const existingNames = new Set(existing.map((col) => col.name));
  columnMappings.forEach(({ column }) => {
    if (!existingNames.has(column)) {
      db.exec(`alter table ${quotedTable} add column ${quoteIdentifier(column)} text`);
    }
  });
};

const run = async () => {
  const user = db.prepare('select id, email from users where email = ?').get(importEmail);
  if (!user) {
    console.error('Target user not found. Sign in once to create the user record.');
    process.exit(1);
  }

  const files = await fs.readdir(DATA_DIR).catch(() => []);
  const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));

  if (csvFiles.length === 0) {
    console.error(`No CSV files found in ${DATA_DIR}`);
    process.exit(1);
  }

  const upsertSourceDatabase = db.prepare(`
    insert into source_databases (id, user_id, title, filename, domain, confidence, schema_hash, item_count)
    values (@id, @user_id, @title, @filename, @domain, @confidence, @schema_hash, @item_count)
    on conflict (user_id, filename) do update set
      title = excluded.title,
      domain = excluded.domain,
      confidence = excluded.confidence,
      schema_hash = excluded.schema_hash,
      item_count = excluded.item_count,
      updated_at = datetime('now')
  `);

  const upsertItem = db.prepare(`
    insert into items (id, user_id, source_database_id, name, domain, difficulty, pattern, completed, raw, row_hash)
    values (@id, @user_id, @source_database_id, @name, @domain, @difficulty, @pattern, @completed, @raw, @row_hash)
    on conflict (user_id, source_database_id, row_hash) do update set
      name = excluded.name,
      domain = excluded.domain,
      difficulty = excluded.difficulty,
      pattern = excluded.pattern,
      completed = excluded.completed,
      raw = excluded.raw,
      updated_at = datetime('now')
  `);

  for (const file of csvFiles) {
    const filePath = path.join(DATA_DIR, file);
    const content = await fs.readFile(filePath, 'utf8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    const headerMap = buildNormalizedHeaderMap(headers);
    const title = path.parse(file).name;
    const schemaHash = hashString(headers.map(h => normalizeLabel(h)).sort().join('|'));
    const classification = classifyDatabase(title, headers);
    const sourceDatabaseId = crypto.randomUUID();
    const csvTableName = makeTables ? buildCsvTableName(title) : null;
    const columnMappings = makeTables ? buildColumnMappings(headers) : null;

    upsertSourceDatabase.run({
      id: sourceDatabaseId,
      user_id: user.id,
      title,
      filename: file,
      domain: classification.domain,
      confidence: classification.confidence,
      schema_hash: schemaHash,
      item_count: records.length
    });

    const resolvedDb = db.prepare('select id from source_databases where user_id = ? and filename = ?')
      .get(user.id, file);
    const dbId = resolvedDb?.id;

    if (!dbId) {
      console.error(`Failed to resolve source database ID for ${file}`);
      continue;
    }

    if (makeTables) {
      ensureCsvTable(csvTableName, columnMappings);
    }

    const rawRows = makeTables ? [] : null;
    const items = records.map((row) => {
      const cleaned = sanitizeRow(row);
      const name = pickValue(cleaned, headerMap, ['Name', 'Title', 'Problem', 'Question', 'Prompt']);
      const completed = parseBoolean(
        pickValue(cleaned, headerMap, ['Completed', 'Done', 'Status', 'Result', 'Solved', 'Progress'])
      );
      const difficulty = parseDifficulty(
        pickValue(cleaned, headerMap, ['CPRD: Difficulty', 'Difficulty', 'Level'])
      );
      const pattern = pickValue(cleaned, headerMap, ['Primary Pattern', 'Pattern']);
      const rowHash = hashString(stableStringify(cleaned));

      if (makeTables) {
        const rowValues = columnMappings.map(({ header }) => cleaned[header] ?? null);
        rawRows.push([rowHash, ...rowValues]);
      }

      return {
        id: crypto.randomUUID(),
        user_id: user.id,
        source_database_id: dbId,
        name: name || null,
        domain: classification.domain,
        difficulty,
        pattern: pattern || null,
        completed: completed ? 1 : 0,
        raw: JSON.stringify(cleaned),
        row_hash: rowHash
      };
    });

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        upsertItem.run(row);
      }
    });

    for (const chunk of chunkArray(items, CHUNK_SIZE)) {
      insertMany(chunk);
    }

    if (makeTables) {
      const columnList = ['row_hash', ...columnMappings.map(({ column }) => column)];
      const placeholders = columnList.map(() => '?').join(', ');
      const insertCsvRow = db.prepare(`
        insert or replace into ${quoteIdentifier(csvTableName)}
        (${columnList.map(quoteIdentifier).join(', ')})
        values (${placeholders})
      `);
      const insertCsvRows = db.transaction((rows) => {
        for (const rowValues of rows) {
          insertCsvRow.run(rowValues);
        }
      });
      for (const chunk of chunkArray(rawRows, CHUNK_SIZE)) {
        insertCsvRows(chunk);
      }
    }

    console.log(
      `Imported ${records.length} rows from ${file}` +
      (makeTables ? ` (table ${csvTableName})` : '')
    );
  }
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
