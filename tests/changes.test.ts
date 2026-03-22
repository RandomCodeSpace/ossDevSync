import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osssync-changes-test-'));

before(async () => {
  const { initDb } = await import('../src/core/db');
  await initDb(tmpDir);
});

after(async () => {
  const { closeDb } = await import('../src/core/db');
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  const { clearAll } = await import('../src/core/graph');
  clearAll();
});

describe('createChangeSpec', () => {
  it('creates spec with cs_ prefix id', async () => {
    const { createChangeSpec } = await import('../src/changes/spec');
    const spec = createChangeSpec('move_module', 'Move it', { path: 'a' }, { path: 'b' });
    assert.ok(spec.id.startsWith('cs_'), `Expected cs_ prefix, got ${spec.id}`);
    assert.strictEqual(spec.id.length, 'cs_'.length + 12); // uuid slice(0,12)
  });

  it('has default status pending_approval', async () => {
    const { createChangeSpec } = await import('../src/changes/spec');
    const spec = createChangeSpec('rename_module', 'Rename', { moduleId: 'x' }, {});
    assert.strictEqual(spec.status, 'pending_approval');
  });

  it('createdAt is ISO string', async () => {
    const { createChangeSpec } = await import('../src/changes/spec');
    const spec = createChangeSpec('update_docs', 'Update', {}, {});
    // Should not throw when parsed
    const d = new Date(spec.createdAt);
    assert.ok(!isNaN(d.getTime()), 'createdAt should be a valid ISO date');
  });

  it('stores source, target, affectedModules, and impact', async () => {
    const { createChangeSpec } = await import('../src/changes/spec');
    const spec = createChangeSpec(
      'split_module', 'Split',
      { moduleId: 'mod_big' },
      { path: '/new' },
      ['mod_a', 'mod_b'],
      { filesAffected: 5, importsToUpdate: 3 },
    );
    assert.deepStrictEqual(spec.source, { moduleId: 'mod_big' });
    assert.deepStrictEqual(spec.target, { path: '/new' });
    assert.deepStrictEqual(spec.affectedModules, ['mod_a', 'mod_b']);
    assert.deepStrictEqual(spec.impact, { filesAffected: 5, importsToUpdate: 3 });
  });
});

describe('describeChange', () => {
  const actions = [
    { action: 'move_module', src: { path: 'src/a' }, tgt: { path: 'src/b' }, expect: /Move module from src\/a to src\/b/ },
    { action: 'split_module', src: { moduleId: 'mod_x' }, tgt: {}, expect: /Split module mod_x/ },
    { action: 'merge_modules', src: { moduleId: 'mod_a' }, tgt: { moduleId: 'mod_b' }, expect: /Merge module mod_a into mod_b/ },
    { action: 'add_dependency', src: { moduleId: 'a' }, tgt: { moduleId: 'b' }, expect: /Add dependency from a to b/ },
    { action: 'remove_dependency', src: { moduleId: 'a' }, tgt: { moduleId: 'b' }, expect: /Remove dependency from a to b/ },
    { action: 'rename_module', src: { moduleId: 'old' }, tgt: {}, expect: /Rename module old/ },
    { action: 'update_docs', src: { moduleId: 'doc_mod' }, tgt: {}, expect: /Update documentation for doc_mod/ },
    { action: 'update_api', src: { moduleId: 'api_mod' }, tgt: {}, expect: /Update API api_mod/ },
    { action: 'update_schema', src: { moduleId: 'sch_mod' }, tgt: {}, expect: /Update schema sch_mod/ },
  ] as const;

  for (const { action, src, tgt, expect: expected } of actions) {
    it(`describes ${action}`, async () => {
      const { createChangeSpec, describeChange } = await import('../src/changes/spec');
      const spec = createChangeSpec(action as any, 'test desc', src as any, tgt as any);
      const desc = describeChange(spec);
      assert.match(desc, expected);
    });
  }
});

describe('ChangeQueue', () => {
  it('enqueue creates and stores a change spec', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    const spec = q.enqueue('move_module', 'Move stuff', { path: 'a' }, { path: 'b' });
    assert.ok(spec.id.startsWith('cs_'));
    assert.strictEqual(spec.status, 'pending_approval');
  });

  it('getPending returns enqueued specs', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    q.enqueue('rename_module', 'Rename', { moduleId: 'x' }, {});
    const pending = q.getPending();
    assert.ok(pending.length >= 1);
    assert.ok(pending.some(s => s.action === 'rename_module'));
  });

  it('approve changes status to approved', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    const spec = q.enqueue('update_docs', 'Docs', {}, {});
    q.approve(spec.id);
    const got = q.get(spec.id);
    assert.ok(got);
    assert.strictEqual(got.status, 'approved');
  });

  it('reject changes status to rejected', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    const spec = q.enqueue('update_api', 'API', {}, {});
    q.reject(spec.id);
    const got = q.get(spec.id);
    assert.ok(got);
    assert.strictEqual(got.status, 'rejected');
  });

  it('markInProgress changes status', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    const spec = q.enqueue('add_dependency', 'Add dep', {}, {});
    q.markInProgress(spec.id);
    assert.strictEqual(q.get(spec.id)?.status, 'in_progress');
  });

  it('complete changes status to completed', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    const spec = q.enqueue('remove_dependency', 'Rm dep', {}, {});
    q.complete(spec.id);
    assert.strictEqual(q.get(spec.id)?.status, 'completed');
  });

  it('get returns undefined for unknown id', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q = getChangeQueue();
    assert.strictEqual(q.get('cs_nonexistent99'), undefined);
  });
});

describe('getChangeQueue singleton', () => {
  it('returns same instance', async () => {
    const { getChangeQueue } = await import('../src/changes/queue');
    const q1 = getChangeQueue();
    const q2 = getChangeQueue();
    assert.strictEqual(q1, q2);
  });
});

describe('analyzeImpact', () => {
  it('returns empty report for unknown module', async () => {
    const { analyzeImpact } = await import('../src/changes/impact');
    const report = analyzeImpact('nonexistent_module');
    assert.strictEqual(report.moduleName, 'unknown');
    assert.strictEqual(report.directDependents.length, 0);
    assert.strictEqual(report.transitiveDependents.length, 0);
    assert.strictEqual(report.filesAffected, 0);
    assert.strictEqual(report.importsToUpdate, 0);
  });

  it('computes direct and transitive dependents', async () => {
    const { addNode, addEdgeBetween } = await import('../src/core/graph');
    const { analyzeImpact } = await import('../src/changes/impact');

    const core = addNode('module', 'core');
    const svc = addNode('module', 'service');
    const ui = addNode('module', 'ui');
    addEdgeBetween(svc.id, core.id, 'imports');
    addEdgeBetween(ui.id, svc.id, 'imports');

    const report = analyzeImpact(core.id);
    assert.strictEqual(report.moduleName, 'core');
    assert.strictEqual(report.directDependents.length, 1);
    assert.strictEqual(report.directDependents[0].id, svc.id);
    assert.strictEqual(report.transitiveDependents.length, 1);
    assert.strictEqual(report.transitiveDependents[0].id, ui.id);
    assert.strictEqual(report.importsToUpdate, 1); // only svc imports core directly
    assert.strictEqual(report.filesAffected, 2); // directDependents.length + 1
  });
});

describe('analyzeMoveImpact', () => {
  it('overrides importsToUpdate to total dependents', async () => {
    const { addNode, addEdgeBetween } = await import('../src/core/graph');
    const { analyzeMoveImpact } = await import('../src/changes/impact');

    const lib = addNode('module', 'lib');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    addEdgeBetween(a.id, lib.id, 'imports');
    addEdgeBetween(b.id, a.id, 'imports');

    const report = analyzeMoveImpact(lib.id, '/new/path');
    // direct=1 (a), transitive=1 (b), so importsToUpdate = 2
    assert.strictEqual(report.importsToUpdate, 2);
  });
});
