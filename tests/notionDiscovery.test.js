import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabaseMapping } from '../src/services/notionDiscovery.js';

const makeAttemptsDb = (options = ['Solved']) => ({
  id: 'attempts-db',
  title: [{ plain_text: 'Attempts' }],
  properties: {
    Item: { id: 'item', type: 'relation' },
    Result: { id: 'result', type: 'select', select: { options: options.map(name => ({ name })) } },
    'Time Spent (min)': { id: 'time', type: 'number' }
  },
  url: 'https://notion.so/attempts',
  last_edited_time: '2024-01-01'
});

const makeLearningDb = () => ({
  id: 'learning-db',
  title: [{ plain_text: 'DSA Problems' }],
  properties: {
    Name: { id: 'name', type: 'title' },
    Completed: { id: 'completed', type: 'checkbox' },
    'CPRD: Difficulty': { id: 'cprd', type: 'select' }
  },
  url: 'https://notion.so/learning',
  last_edited_time: '2024-01-01'
});

test('schema fingerprint changes are detected and block orchestration', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [makeAttemptsDb(), makeLearningDb()]
    })
  });

  const previous = { 'learning-db': 'old-fingerprint' };
  const { proposal } = await prepareDatabaseMapping('test-key', previous);

  assert.equal(proposal.fingerprintChanged, true);
  assert.ok(proposal.fingerprintChanges.some(change => change.id === 'learning-db'));
});

test('attempts database requires Result select with "Solved"', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [makeAttemptsDb(['Failed']), makeLearningDb()]
    })
  });

  await assert.rejects(
    () => prepareDatabaseMapping('test-key'),
    /Result select must include "Solved"/
  );
});
