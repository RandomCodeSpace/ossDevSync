import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osssync-graph-test-'));

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

describe('addNode', () => {
  it('creates a node with correct id prefix', async () => {
    const { addNode } = await import('../src/core/graph');
    const node = addNode('module', 'utils', '/src/utils');
    assert.ok(node.id.startsWith('module_'), `Expected id to start with "module_", got "${node.id}"`);
    assert.strictEqual(node.id.length, 'module_'.length + 8); // uuid slice(0,8)
  });

  it('stores type, name, path, properties correctly', async () => {
    const { addNode } = await import('../src/core/graph');
    const node = addNode('api', 'GET /users', '/api/users', { method: 'GET' });
    assert.strictEqual(node.type, 'api');
    assert.strictEqual(node.name, 'GET /users');
    assert.strictEqual(node.path, '/api/users');
    assert.deepStrictEqual(node.properties, { method: 'GET' });
    assert.ok(typeof node.createdAt === 'number');
    assert.ok(typeof node.updatedAt === 'number');
  });

  it('defaults properties to empty object', async () => {
    const { addNode } = await import('../src/core/graph');
    const node = addNode('config', 'tsconfig.json');
    assert.deepStrictEqual(node.properties, {});
  });
});

describe('addEdgeBetween', () => {
  it('creates an edge between two nodes with default weight', async () => {
    const { addNode, addEdgeBetween } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    const edge = addEdgeBetween(a.id, b.id, 'imports');

    assert.ok(edge.id.startsWith('imports_'));
    assert.strictEqual(edge.sourceId, a.id);
    assert.strictEqual(edge.targetId, b.id);
    assert.strictEqual(edge.type, 'imports');
    assert.strictEqual(edge.weight, 1.0);
  });

  it('accepts custom weight and properties', async () => {
    const { addNode, addEdgeBetween } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    const edge = addEdgeBetween(a.id, b.id, 'data_flows', { bandwidth: 'high' }, 0.5);

    assert.strictEqual(edge.weight, 0.5);
    assert.deepStrictEqual(edge.properties, { bandwidth: 'high' });
  });
});

describe('removeNode', () => {
  it('removes a node and its incident edges', async () => {
    const { addNode, addEdgeBetween, removeNode, getNodeData, getNodeEdges } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    addEdgeBetween(a.id, b.id, 'imports');

    removeNode(a.id);
    assert.strictEqual(getNodeData(a.id), undefined);
    // b should have no edges since a was removed
    const edges = getNodeEdges(b.id);
    assert.strictEqual(edges.length, 0);
  });

  it('is a no-op for unknown id', async () => {
    const { removeNode } = await import('../src/core/graph');
    assert.doesNotThrow(() => removeNode('nonexistent_abc'));
  });
});

describe('removeEdge', () => {
  it('removes edge but not the nodes', async () => {
    const { addNode, addEdgeBetween, removeEdge, getNodeData, getNodeEdges } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    const edge = addEdgeBetween(a.id, b.id, 'imports');

    removeEdge(edge.id);
    assert.ok(getNodeData(a.id) !== undefined);
    assert.ok(getNodeData(b.id) !== undefined);
    assert.strictEqual(getNodeEdges(a.id).length, 0);
  });

  it('is a no-op for unknown edge id', async () => {
    const { removeEdge } = await import('../src/core/graph');
    assert.doesNotThrow(() => removeEdge('nonexistent_edge'));
  });
});

describe('getNodeData', () => {
  it('returns node data for existing node', async () => {
    const { addNode, getNodeData } = await import('../src/core/graph');
    const node = addNode('module', 'test-mod', '/src/test');
    const data = getNodeData(node.id);
    assert.ok(data);
    assert.strictEqual(data.name, 'test-mod');
    assert.strictEqual(data.path, '/src/test');
  });

  it('returns undefined for unknown node', async () => {
    const { getNodeData } = await import('../src/core/graph');
    assert.strictEqual(getNodeData('nope_12345678'), undefined);
  });
});

describe('getNeighbors', () => {
  it('filters by direction', async () => {
    const { addNode, addEdgeBetween, getNeighbors } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    const c = addNode('module', 'c');
    addEdgeBetween(a.id, b.id, 'imports');
    addEdgeBetween(c.id, b.id, 'imports');

    const outOfA = getNeighbors(a.id, 'out');
    assert.strictEqual(outOfA.length, 1);
    assert.strictEqual(outOfA[0].id, b.id);

    const inToB = getNeighbors(b.id, 'in');
    assert.strictEqual(inToB.length, 2);

    const bothB = getNeighbors(b.id, 'both');
    assert.strictEqual(bothB.length, 2); // a and c
  });

  it('returns empty for unknown node', async () => {
    const { getNeighbors } = await import('../src/core/graph');
    assert.deepStrictEqual(getNeighbors('unknown_node'), []);
  });
});

describe('getNodeEdges', () => {
  it('filters edges by direction', async () => {
    const { addNode, addEdgeBetween, getNodeEdges } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    addEdgeBetween(a.id, b.id, 'imports');

    const outEdges = getNodeEdges(a.id, 'out');
    assert.strictEqual(outEdges.length, 1);
    assert.strictEqual(outEdges[0].type, 'imports');

    const inEdges = getNodeEdges(a.id, 'in');
    assert.strictEqual(inEdges.length, 0);

    const inEdgesB = getNodeEdges(b.id, 'in');
    assert.strictEqual(inEdgesB.length, 1);
  });

  it('returns empty for unknown node', async () => {
    const { getNodeEdges } = await import('../src/core/graph');
    assert.deepStrictEqual(getNodeEdges('unknown_xyz'), []);
  });
});

describe('findPath', () => {
  it('finds linear chain A -> B -> C', async () => {
    const { addNode, addEdgeBetween, findPath } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    const c = addNode('module', 'c');
    addEdgeBetween(a.id, b.id, 'imports');
    addEdgeBetween(b.id, c.id, 'imports');

    const p = findPath(a.id, c.id);
    assert.deepStrictEqual(p, [a.id, b.id, c.id]);
  });

  it('returns null for reverse direction (C -> A has no forward path)', async () => {
    const { addNode, addEdgeBetween, findPath } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    addEdgeBetween(a.id, b.id, 'imports');

    assert.strictEqual(findPath(b.id, a.id), null);
  });

  it('same node returns [id]', async () => {
    const { addNode, findPath } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    assert.deepStrictEqual(findPath(a.id, a.id), [a.id]);
  });

  it('returns null when node does not exist', async () => {
    const { findPath } = await import('../src/core/graph');
    assert.strictEqual(findPath('no_a', 'no_b'), null);
  });
});

describe('getImpact', () => {
  it('collects dependents via imports edges', async () => {
    const { addNode, addEdgeBetween, getImpact } = await import('../src/core/graph');
    const core = addNode('module', 'core');
    const svc = addNode('module', 'service');
    const ui = addNode('module', 'ui');
    addEdgeBetween(svc.id, core.id, 'imports'); // svc imports core
    addEdgeBetween(ui.id, svc.id, 'imports');   // ui imports svc

    const impact = getImpact(core.id);
    assert.strictEqual(impact.affected.length, 2);
    assert.strictEqual(impact.depth.get(svc.id), 1);
    assert.strictEqual(impact.depth.get(ui.id), 2);
  });

  it('does not traverse contains edges', async () => {
    const { addNode, addEdgeBetween, getImpact } = await import('../src/core/graph');
    const parent = addNode('module', 'parent');
    const child = addNode('module', 'child');
    addEdgeBetween(parent.id, child.id, 'contains');

    const impact = getImpact(child.id);
    assert.strictEqual(impact.affected.length, 0);
  });

  it('returns empty for unknown module', async () => {
    const { getImpact } = await import('../src/core/graph');
    const result = getImpact('nonexistent_mod');
    assert.deepStrictEqual(result.affected, []);
  });
});

describe('exportGraph', () => {
  it('returns all nodes and edges with correct shapes', async () => {
    const { addNode, addEdgeBetween, exportGraph } = await import('../src/core/graph');
    const a = addNode('module', 'a');
    const b = addNode('module', 'b');
    addEdgeBetween(a.id, b.id, 'imports');

    const { nodes, edges } = exportGraph();
    assert.strictEqual(nodes.length, 2);
    assert.strictEqual(edges.length, 1);

    for (const n of nodes) {
      assert.ok(n.id);
      assert.ok(n.type);
      assert.ok(n.name);
      assert.ok(typeof n.createdAt === 'number');
    }
    for (const e of edges) {
      assert.ok(e.id);
      assert.ok(e.sourceId);
      assert.ok(e.targetId);
      assert.ok(e.type);
      assert.strictEqual(typeof e.weight, 'number');
    }
  });
});

describe('getStats', () => {
  it('returns correct counts and nodesByType', async () => {
    const { addNode, addEdgeBetween, getStats } = await import('../src/core/graph');
    addNode('module', 'a');
    addNode('module', 'b');
    addNode('config', 'tsconfig.json');
    const m1 = addNode('module', 'c');
    const m2 = addNode('module', 'd');
    addEdgeBetween(m1.id, m2.id, 'imports');

    const stats = getStats();
    assert.strictEqual(stats.nodeCount, 5);
    assert.strictEqual(stats.edgeCount, 1);
    assert.strictEqual(stats.nodesByType['module'], 4);
    assert.strictEqual(stats.nodesByType['config'], 1);
  });
});

describe('clearAll', () => {
  it('wipes all nodes and edges', async () => {
    const { addNode, addEdgeBetween, clearAll, getStats } = await import('../src/core/graph');
    addNode('module', 'a');
    addNode('module', 'b');
    const n1 = addNode('module', 'c');
    const n2 = addNode('module', 'd');
    addEdgeBetween(n1.id, n2.id, 'imports');

    clearAll();
    const stats = getStats();
    assert.strictEqual(stats.nodeCount, 0);
    assert.strictEqual(stats.edgeCount, 0);
  });
});
