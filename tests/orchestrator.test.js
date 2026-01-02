import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateSession } from '../src/core/sessionOrchestrator.js';

const makeItem = (id, difficulty = '3') => ({
  id,
  properties: {
    Completed: { checkbox: false },
    'CPRD: Difficulty': { select: { name: difficulty } }
  }
});

test('orchestrateSession is deterministic with stable merge order', async () => {
  const dataByDb = {
    'db-a': [makeItem('item-a', '3')],
    'db-b': [makeItem('item-b', '3')]
  };

  const fetchItems = async (_apiKey, dbId) => dataByDb[dbId] || [];

  const params = {
    apiKey: 'test',
    databases: { DSA: ['db-b', 'db-a'] },
    totalMinutes: 45,
    focusMode: 'dsa-heavy',
    getAttemptsData: () => ({ itemData: {}, itemReadinessMap: {} }),
    fetchItems,
    now: 1700000000000
  };

  const first = await orchestrateSession(params);
  const second = await orchestrateSession(params);

  assert.deepEqual(first, second);
  assert.equal(first.coreUnit.item.sourceDatabaseId, 'db-a');
  assert.equal(first.coreUnit.item.id, 'item-a');
});
