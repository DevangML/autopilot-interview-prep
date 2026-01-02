import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDataUpdate } from '../src/services/notion.js';

test('prepareDataUpdate only reads data and does not apply mutations', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    return {
      ok: true,
      json: async () => ({ properties: { Status: { rich_text: [] } } })
    };
  };

  await prepareDataUpdate('test-key', 'page-id', {
    Status: { rich_text: [{ text: { content: 'Solved' } }] }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});
