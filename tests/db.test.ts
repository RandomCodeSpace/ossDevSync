import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osssync-db-test-'));

before(async () => {
  const { initDb } = await import('../src/core/db');
  await initDb(tmpDir);
});

after(async () => {
  const { closeDb } = await import('../src/core/db');
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Top-level beforeEach applies to all tests in this file
beforeEach(async () => {
  const { clearGraph } = await import('../src/core/db');
  clearGraph();
});

describe('DB lifecycle', () => {
  it('getDb returns a database after init', async () => {
    const { getDb } = await import('../src/core/db');
    const db = getDb();
    assert.ok(db, 'getDb should return a database instance');
  });

  it('ensureDb returns existing db without re-init', async () => {
    const { getDb, ensureDb } = await import('../src/core/db');
    const db1 = getDb();
    const db2 = await ensureDb(tmpDir);
    assert.strictEqual(db1, db2);
  });

  it('getDb throws before init after close', async () => {
    const { closeDb, getDb, initDb } = await import('../src/core/db');
    closeDb();
    assert.throws(() => getDb(), /not initialized/i);
    // Re-init for subsequent tests
    await initDb(tmpDir);
  });
});

describe('Node CRUD', () => {
  it('insertNode and getNode round-trip', async () => {
    const { insertNode, getNode } = await import('../src/core/db');
    const node = {
      id: 'mod_test1',
      type: 'module' as const,
      name: 'test-module',
      path: '/src/test',
      properties: { lang: 'ts' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    insertNode(node);
    const got = getNode('mod_test1');
    assert.ok(got);
    assert.strictEqual(got.id, 'mod_test1');
    assert.strictEqual(got.name, 'test-module');
    assert.strictEqual(got.path, '/src/test');
    assert.deepStrictEqual(got.properties, { lang: 'ts' });
  });

  it('getNode returns undefined for unknown id', async () => {
    const { getNode } = await import('../src/core/db');
    assert.strictEqual(getNode('nonexistent'), undefined);
  });

  it('getAllNodes returns all inserted nodes', async () => {
    const { insertNode, getAllNodes } = await import('../src/core/db');
    const now = Date.now();
    insertNode({ id: 'n1', type: 'module', name: 'a', properties: {}, createdAt: now, updatedAt: now });
    insertNode({ id: 'n2', type: 'config', name: 'b', properties: {}, createdAt: now, updatedAt: now });
    const all = getAllNodes();
    assert.strictEqual(all.length, 2);
  });

  it('deleteNode removes a node', async () => {
    const { insertNode, deleteNode, getNode } = await import('../src/core/db');
    const now = Date.now();
    insertNode({ id: 'del1', type: 'module', name: 'del', properties: {}, createdAt: now, updatedAt: now });
    deleteNode('del1');
    assert.strictEqual(getNode('del1'), undefined);
  });

  it('insertNode with same id overwrites (INSERT OR REPLACE)', async () => {
    const { insertNode, getNode } = await import('../src/core/db');
    const now = Date.now();
    insertNode({ id: 'dup1', type: 'module', name: 'old', properties: {}, createdAt: now, updatedAt: now });
    insertNode({ id: 'dup1', type: 'module', name: 'new', properties: { v: 2 }, createdAt: now, updatedAt: now });
    const got = getNode('dup1');
    assert.ok(got);
    assert.strictEqual(got.name, 'new');
  });
});

describe('Edge CRUD', () => {
  it('insertEdge and getEdge round-trip', async () => {
    const { insertEdge, getEdge } = await import('../src/core/db');
    const edge = {
      id: 'edge_1',
      sourceId: 'mod_a',
      targetId: 'mod_b',
      type: 'imports' as const,
      properties: { path: './b' },
      weight: 1.0,
    };
    insertEdge(edge);
    const got = getEdge('edge_1');
    assert.ok(got);
    assert.strictEqual(got.sourceId, 'mod_a');
    assert.strictEqual(got.targetId, 'mod_b');
    assert.strictEqual(got.type, 'imports');
    assert.deepStrictEqual(got.properties, { path: './b' });
    assert.strictEqual(got.weight, 1.0);
  });

  it('getEdge returns undefined for unknown id', async () => {
    const { getEdge } = await import('../src/core/db');
    assert.strictEqual(getEdge('nope'), undefined);
  });

  it('getAllEdges returns all inserted edges', async () => {
    const { insertEdge, getAllEdges } = await import('../src/core/db');
    insertEdge({ id: 'e1', sourceId: 'a', targetId: 'b', type: 'imports', properties: {}, weight: 1 });
    insertEdge({ id: 'e2', sourceId: 'b', targetId: 'c', type: 'contains', properties: {}, weight: 1 });
    assert.strictEqual(getAllEdges().length, 2);
  });

  it('deleteEdge removes an edge', async () => {
    const { insertEdge, deleteEdge, getEdge } = await import('../src/core/db');
    insertEdge({ id: 'ed1', sourceId: 'a', targetId: 'b', type: 'imports', properties: {}, weight: 1 });
    deleteEdge('ed1');
    assert.strictEqual(getEdge('ed1'), undefined);
  });

  it('getEdgesForNode finds edges by source or target', async () => {
    const { insertEdge, getEdgesForNode } = await import('../src/core/db');
    insertEdge({ id: 'ef1', sourceId: 'x', targetId: 'y', type: 'imports', properties: {}, weight: 1 });
    insertEdge({ id: 'ef2', sourceId: 'z', targetId: 'x', type: 'contains', properties: {}, weight: 1 });
    insertEdge({ id: 'ef3', sourceId: 'z', targetId: 'y', type: 'imports', properties: {}, weight: 1 });

    const edgesForX = getEdgesForNode('x');
    assert.strictEqual(edgesForX.length, 2);

    const edgesForY = getEdgesForNode('y');
    assert.strictEqual(edgesForY.length, 2);
  });
});

describe('Doc operations', () => {
  it('upsertDoc and getDoc round-trip', async () => {
    const { upsertDoc, getDoc } = await import('../src/core/db');
    upsertDoc({
      moduleId: 'mod_doc1',
      content: '# Module\nSome doc',
      generatedAt: Date.now(),
      isManuallyEdited: false,
    });
    const doc = getDoc('mod_doc1');
    assert.ok(doc);
    assert.strictEqual(doc.moduleId, 'mod_doc1');
    assert.strictEqual(doc.content, '# Module\nSome doc');
    assert.strictEqual(doc.isManuallyEdited, false);
  });

  it('upsertDoc overwrites existing doc', async () => {
    const { upsertDoc, getDoc } = await import('../src/core/db');
    upsertDoc({ moduleId: 'mod_up', content: 'v1', generatedAt: 1000, isManuallyEdited: false });
    upsertDoc({ moduleId: 'mod_up', content: 'v2', generatedAt: 2000, isManuallyEdited: true });
    const doc = getDoc('mod_up');
    assert.ok(doc);
    assert.strictEqual(doc.content, 'v2');
    assert.strictEqual(doc.isManuallyEdited, true);
  });

  it('getAllDocs returns all docs', async () => {
    const { upsertDoc, getAllDocs } = await import('../src/core/db');
    upsertDoc({ moduleId: 'd1', content: 'a', generatedAt: 1, isManuallyEdited: false });
    upsertDoc({ moduleId: 'd2', content: 'b', generatedAt: 2, isManuallyEdited: false });
    const docs = getAllDocs();
    assert.ok(docs.length >= 2, `Should have at least 2 docs, got ${docs.length}`);
  });

  it('getDoc returns undefined for unknown id', async () => {
    const { getDoc } = await import('../src/core/db');
    assert.strictEqual(getDoc('no_such_doc'), undefined);
  });
});

describe('ChangeSpec operations', () => {
  it('insertChangeSpec and getChangeSpec round-trip', async () => {
    const { insertChangeSpec, getChangeSpec } = await import('../src/core/db');
    const spec = {
      id: 'cs_test1',
      type: 'architecture_change',
      action: 'move_module' as const,
      description: 'Move utils to lib',
      source: { moduleId: 'mod_utils', path: 'src/utils' },
      target: { path: 'src/lib/utils' },
      affectedModules: ['mod_api'],
      impact: { filesAffected: 3, importsToUpdate: 2 },
      status: 'pending_approval' as const,
      createdAt: new Date().toISOString(),
    };
    insertChangeSpec(spec);
    const got = getChangeSpec('cs_test1');
    assert.ok(got);
    assert.strictEqual(got.action, 'move_module');
    assert.strictEqual(got.status, 'pending_approval');
    assert.deepStrictEqual(got.source, { moduleId: 'mod_utils', path: 'src/utils' });
    assert.deepStrictEqual(got.affectedModules, ['mod_api']);
  });

  it('getPendingChangeSpecs returns only pending specs', async () => {
    const { insertChangeSpec, getPendingChangeSpecs, updateChangeSpecStatus } = await import('../src/core/db');
    const now = new Date().toISOString();
    insertChangeSpec({
      id: 'cs_p1', type: 'architecture_change', action: 'move_module',
      description: 'a', source: {}, target: {}, affectedModules: [],
      impact: { filesAffected: 0, importsToUpdate: 0 }, status: 'pending_approval', createdAt: now,
    });
    insertChangeSpec({
      id: 'cs_p2', type: 'architecture_change', action: 'rename_module',
      description: 'b', source: {}, target: {}, affectedModules: [],
      impact: { filesAffected: 0, importsToUpdate: 0 }, status: 'pending_approval', createdAt: now,
    });
    updateChangeSpecStatus('cs_p1', 'approved');

    const pending = getPendingChangeSpecs();
    assert.ok(pending.some(p => p.id === 'cs_p2'), 'cs_p2 should be pending');
    assert.ok(!pending.some(p => p.id === 'cs_p1'), 'cs_p1 should not be pending (approved)');
  });

  it('updateChangeSpecStatus changes status and sets updatedAt', async () => {
    const { insertChangeSpec, getChangeSpec, updateChangeSpecStatus } = await import('../src/core/db');
    insertChangeSpec({
      id: 'cs_u1', type: 'architecture_change', action: 'update_docs',
      description: 'c', source: {}, target: {}, affectedModules: [],
      impact: { filesAffected: 0, importsToUpdate: 0 }, status: 'pending_approval',
      createdAt: new Date().toISOString(),
    });
    updateChangeSpecStatus('cs_u1', 'completed');
    const got = getChangeSpec('cs_u1');
    assert.ok(got);
    assert.strictEqual(got.status, 'completed');
    assert.ok(got.updatedAt, 'updatedAt should be set');
  });
});

describe('clearGraph', () => {
  it('clears nodes and edges, preserves manually-edited docs and pending specs', async () => {
    const { insertNode, insertEdge, upsertDoc, insertChangeSpec, clearGraph, getAllNodes, getAllEdges, getAllDocs, getPendingChangeSpecs } = await import('../src/core/db');
    const now = Date.now();
    insertNode({ id: 'cg_n', type: 'module', name: 'x', properties: {}, createdAt: now, updatedAt: now });
    insertEdge({ id: 'cg_e', sourceId: 'a', targetId: 'b', type: 'imports', properties: {}, weight: 1 });
    upsertDoc({ moduleId: 'cg_auto', content: 'auto', generatedAt: now, isManuallyEdited: false });
    upsertDoc({ moduleId: 'cg_manual', content: 'manual', generatedAt: now, isManuallyEdited: true });
    insertChangeSpec({
      id: 'cg_cs', type: 'architecture_change', action: 'move_module',
      description: 'd', source: {}, target: {}, affectedModules: [],
      impact: { filesAffected: 0, importsToUpdate: 0 }, status: 'pending_approval',
      createdAt: new Date().toISOString(),
    });

    clearGraph();
    assert.strictEqual(getAllNodes().length, 0, 'nodes should be cleared');
    assert.strictEqual(getAllEdges().length, 0, 'edges should be cleared');
    // manually-edited docs and pending specs are preserved
    const docs = getAllDocs();
    assert.ok(docs.some(d => d.moduleId === 'cg_manual'), 'manually-edited doc preserved');
    assert.ok(!docs.some(d => d.moduleId === 'cg_auto'), 'auto-generated doc cleared');
    const pending = getPendingChangeSpecs();
    assert.ok(pending.some(p => p.id === 'cg_cs'), 'pending spec preserved');
  });
});

describe('DB persistence', () => {
  it('data survives close and reopen', async () => {
    const { insertNode, closeDb, initDb, getNode, clearGraph } = await import('../src/core/db');
    clearGraph();

    const now = Date.now();
    insertNode({ id: 'persist_1', type: 'module', name: 'persistent', properties: { x: 1 }, createdAt: now, updatedAt: now });

    closeDb();
    await initDb(tmpDir);

    const got = getNode('persist_1');
    assert.ok(got, 'Node should survive close/reopen');
    assert.strictEqual(got.name, 'persistent');
    assert.deepStrictEqual(got.properties, { x: 1 });

    // Clean up
    clearGraph();
  });
});
