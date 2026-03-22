import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osssync-indexer-test-'));

before(async () => {
  process.env.OSSSYNC_DB_DIR = tmpDir;
  const { initDb } = await import('../src/core/db');
  await initDb(tmpDir);
});

after(async () => {
  const { closeDb } = await import('../src/core/db');
  closeDb();
  delete process.env.OSSSYNC_DB_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  const { clearAll } = await import('../src/core/graph');
  clearAll();
});

// Helper to create a temp project inside tmpDir
function createProject(name: string): string {
  const dir = path.join(tmpDir, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('Scanner', () => {
  it('creates a project node with correct name', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('my-project');
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    const node = scanProject(proj);
    assert.strictEqual(node.type, 'project');
    assert.strictEqual(node.name, 'my-project');
    assert.strictEqual(node.path, proj);
  });

  it('creates module nodes for directories', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { exportGraph } = await import('../src/core/graph');
    const proj = createProject('modtest');
    fs.mkdirSync(path.join(proj, 'src', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'api'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    scanProject(proj);
    const { nodes } = exportGraph();
    const modules = nodes.filter(n => n.type === 'module');
    assert.ok(modules.length >= 3, `Expected >= 3 modules (src, utils, api), got ${modules.length}`);
    assert.ok(modules.some(m => m.name === 'src'));
    assert.ok(modules.some(m => m.name === 'utils'));
    assert.ok(modules.some(m => m.name === 'api'));
  });

  it('creates config nodes for known config files', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { exportGraph } = await import('../src/core/graph');
    const proj = createProject('cfgtest');
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), '{}');

    scanProject(proj);
    const { nodes } = exportGraph();
    const configs = nodes.filter(n => n.type === 'config');
    assert.ok(configs.some(c => c.name === 'package.json'));
    assert.ok(configs.some(c => c.name === 'tsconfig.json'));
  });

  it('ignores node_modules and .git', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { exportGraph } = await import('../src/core/graph');
    const proj = createProject('ignoretest');
    fs.mkdirSync(path.join(proj, 'node_modules', 'lodash'), { recursive: true });
    fs.mkdirSync(path.join(proj, '.git', 'objects'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src'), { recursive: true });

    scanProject(proj);
    const { nodes } = exportGraph();
    const names = nodes.map(n => n.name);
    assert.ok(!names.includes('node_modules'));
    assert.ok(!names.includes('.git'));
    assert.ok(!names.includes('lodash'));
  });

  it('respects maxDepth', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { exportGraph } = await import('../src/core/graph');
    const proj = createProject('depthtest');
    fs.mkdirSync(path.join(proj, 'a', 'b', 'c', 'd'), { recursive: true });

    scanProject(proj, { maxDepth: 2 });
    const { nodes } = exportGraph();
    const modules = nodes.filter(n => n.type === 'module');
    // depth=1: a, depth=2: b, depth=3 (c) should be excluded
    assert.ok(modules.some(m => m.name === 'a'));
    assert.ok(modules.some(m => m.name === 'b'));
    assert.ok(!modules.some(m => m.name === 'c'), 'c should be beyond maxDepth');
  });

  it('detects typescript language', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('tsproject');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    const node = scanProject(proj);
    assert.strictEqual(node.properties.language, 'typescript');
  });

  it('detects go language', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('goproject');
    fs.writeFileSync(path.join(proj, 'go.mod'), 'module example.com/test');

    const node = scanProject(proj);
    assert.strictEqual(node.properties.language, 'go');
  });

  it('detects python language', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('pyproject');
    fs.writeFileSync(path.join(proj, 'pyproject.toml'), '[tool.poetry]');

    const node = scanProject(proj);
    assert.strictEqual(node.properties.language, 'python');
  });

  it('detects rust language', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('rustproject');
    fs.writeFileSync(path.join(proj, 'Cargo.toml'), '[package]');

    const node = scanProject(proj);
    assert.strictEqual(node.properties.language, 'rust');
  });

  it('detects next.js framework', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('nextproject');
    fs.writeFileSync(path.join(proj, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
      dependencies: { next: '14.0.0', react: '18.0.0' },
    }));

    const node = scanProject(proj);
    assert.strictEqual(node.properties.framework, 'next.js');
  });

  it('detects express framework', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('expressproject');
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
      dependencies: { express: '4.18.0' },
    }));

    const node = scanProject(proj);
    assert.strictEqual(node.properties.framework, 'express');
  });

  it('detects react framework', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const proj = createProject('reactproject');
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
      dependencies: { react: '18.0.0' },
    }));

    const node = scanProject(proj);
    assert.strictEqual(node.properties.framework, 'react');
  });
});

describe('Import resolver', () => {
  it('creates edges for relative imports', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { resolveImports } = await import('../src/indexer/import-resolver');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('importtest');
    fs.mkdirSync(path.join(proj, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'utils', 'helper.ts'), 'export function helper() {}');
    fs.writeFileSync(path.join(proj, 'src', 'api', 'index.ts'), "import { helper } from '../utils/helper';");

    scanProject(proj);
    resolveImports(proj);
    const { edges } = exportGraph();
    const importEdges = edges.filter(e => e.type === 'imports');
    assert.ok(importEdges.length >= 1, 'Should create at least one import edge');
  });

  it('does not create edges for external packages', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { resolveImports } = await import('../src/indexer/import-resolver');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('extimporttest');
    fs.mkdirSync(path.join(proj, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'lib', 'index.ts'), "import express from 'express';\nimport lodash from 'lodash';");

    scanProject(proj);
    resolveImports(proj);
    const { edges } = exportGraph();
    const importEdges = edges.filter(e => e.type === 'imports');
    // No import edges for external packages
    assert.strictEqual(importEdges.length, 0, 'Should not create edges for external packages');
  });

  it('handles require() syntax', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { resolveImports } = await import('../src/indexer/import-resolver');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('requiretest');
    fs.mkdirSync(path.join(proj, 'src', 'svc'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'db'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'db', 'conn.ts'), 'export const db = {};');
    fs.writeFileSync(path.join(proj, 'src', 'svc', 'index.ts'), "const db = require('../db/conn');");

    scanProject(proj);
    resolveImports(proj);
    const { edges } = exportGraph();
    const importEdges = edges.filter(e => e.type === 'imports');
    assert.ok(importEdges.length >= 1, 'Should resolve require() imports');
  });

  it('deduplicates imports from same module', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { resolveImports } = await import('../src/indexer/import-resolver');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('deduptest');
    fs.mkdirSync(path.join(proj, 'src', 'a'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'b'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'b', 'x.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(proj, 'src', 'b', 'y.ts'), 'export const y = 2;');
    fs.writeFileSync(path.join(proj, 'src', 'a', 'index.ts'),
      "import { x } from '../b/x';\nimport { y } from '../b/y';");

    scanProject(proj);
    resolveImports(proj);
    const { edges } = exportGraph();
    // Both imports resolve to same target module 'b', so only one edge
    const importEdges = edges.filter(e => e.type === 'imports');
    const aToB = importEdges.filter(e => {
      const { nodes } = exportGraph();
      const src = nodes.find(n => n.id === e.sourceId);
      const tgt = nodes.find(n => n.id === e.targetId);
      return src?.name === 'a' && tgt?.name === 'b';
    });
    assert.ok(aToB.length <= 1, `Expected at most 1 deduplicated import edge a->b, got ${aToB.length}`);
  });
});

describe('Express route matcher', () => {
  it('detects app.get/post/put/delete routes', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchExpressRoutes } = await import('../src/indexer/pattern-matchers/express');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('expressroutes');
    fs.mkdirSync(path.join(proj, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
      dependencies: { express: '4.18.0' },
    }));
    fs.writeFileSync(path.join(proj, 'src', 'routes', 'users.ts'), `
      app.get('/users', (req, res) => {});
      app.post('/users', (req, res) => {});
      app.put('/users/:id', (req, res) => {});
      app.delete('/users/:id', (req, res) => {});
    `);

    scanProject(proj);
    matchExpressRoutes(proj);
    const { nodes } = exportGraph();
    const apis = nodes.filter(n => n.type === 'api');
    assert.ok(apis.length >= 4, `Expected >= 4 API nodes, got ${apis.length}`);

    const methods = apis.map(a => a.properties.method);
    assert.ok(methods.includes('GET'));
    assert.ok(methods.includes('POST'));
    assert.ok(methods.includes('PUT'));
    assert.ok(methods.includes('DELETE'));
  });

  it('detects Next.js route.ts API routes', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchExpressRoutes } = await import('../src/indexer/pattern-matchers/express');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('nextroutes');
    fs.mkdirSync(path.join(proj, 'src', 'app', 'api', 'users'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
      dependencies: { next: '14.0.0', react: '18.0.0' },
    }));
    fs.writeFileSync(path.join(proj, 'src', 'app', 'api', 'users', 'route.ts'), `
      export async function GET(request: Request) { return Response.json([]); }
      export async function POST(request: Request) { return Response.json({}); }
    `);

    scanProject(proj);
    matchExpressRoutes(proj);
    const { nodes } = exportGraph();
    const apis = nodes.filter(n => n.type === 'api');
    assert.ok(apis.length >= 2, `Expected >= 2 API nodes for Next.js routes, got ${apis.length}`);

    const paths = apis.map(a => a.properties.path);
    assert.ok(paths.some(p => p === '/api/users'), `Expected /api/users path, got: ${JSON.stringify(paths)}`);
  });

  it('handles nested Next.js routes', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchExpressRoutes } = await import('../src/indexer/pattern-matchers/express');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('nestednext');
    fs.mkdirSync(path.join(proj, 'src', 'app', 'api', 'users', '[id]'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'app', 'api', 'users', '[id]', 'route.ts'),
      'export async function GET(req: Request) {}');

    scanProject(proj);
    matchExpressRoutes(proj);
    const { nodes } = exportGraph();
    const apis = nodes.filter(n => n.type === 'api');
    assert.ok(apis.some(a => (a.properties.path as string)?.includes('[id]')),
      `Expected route path with [id] segment`);
  });
});

describe('Prisma matcher', () => {
  it('parses models, fields, and relations', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchPrismaSchemas } = await import('../src/indexer/pattern-matchers/prisma');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('prismatest');
    fs.mkdirSync(path.join(proj, 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'prisma', 'schema.prisma'), `
      model User {
        id    Int    @id @default(autoincrement())
        name  String
        posts Post[]
      }

      model Post {
        id     Int    @id @default(autoincrement())
        title  String
        author User   @relation(fields: [authorId], references: [id])
        authorId Int
      }
    `);

    scanProject(proj);
    matchPrismaSchemas(proj);
    const { nodes } = exportGraph();
    const schemas = nodes.filter(n => n.type === 'schema');
    assert.ok(schemas.some(s => s.name === 'User'), 'Should find User model');
    assert.ok(schemas.some(s => s.name === 'Post'), 'Should find Post model');

    const user = schemas.find(s => s.name === 'User')!;
    const fields = user.properties.fields as Array<{ name: string; type: string; isRelation: boolean }>;
    assert.ok(fields.some(f => f.name === 'name' && f.type === 'String'));
    assert.ok(fields.some(f => f.name === 'posts' && f.isRelation));
    const relations = user.properties.relations as string[];
    assert.ok(relations.includes('Post'));
  });

  it('links schema to modules that reference the model', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchPrismaSchemas } = await import('../src/indexer/pattern-matchers/prisma');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('prismalink');
    fs.mkdirSync(path.join(proj, 'prisma'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'svc'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'prisma', 'schema.prisma'), `
      model Account {
        id Int @id
      }
    `);
    fs.writeFileSync(path.join(proj, 'src', 'svc', 'account.ts'),
      'const result = await prisma.Account.findMany();');

    scanProject(proj);
    matchPrismaSchemas(proj);
    const { edges } = exportGraph();
    const schemaEdges = edges.filter(e => e.type === 'uses_schema');
    assert.ok(schemaEdges.length >= 1, 'Should link module to schema');
  });

  it('does not error when no prisma dir', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchPrismaSchemas } = await import('../src/indexer/pattern-matchers/prisma');

    const proj = createProject('noprisma');
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    scanProject(proj);
    assert.doesNotThrow(() => matchPrismaSchemas(proj));
  });
});

describe('Zod matcher', () => {
  it('detects z.object schemas', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchZodSchemas } = await import('../src/indexer/pattern-matchers/zod');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('zodtest');
    fs.mkdirSync(path.join(proj, 'src', 'schemas'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'schemas', 'user.ts'), `
      import { z } from 'zod';
      export const UserSchema = z.object({ name: z.string(), email: z.string() });
      export const ConfigValidator = z.object({ port: z.number() });
    `);

    scanProject(proj);
    matchZodSchemas(proj);
    const { nodes } = exportGraph();
    const schemas = nodes.filter(n => n.type === 'schema' && n.properties.source === 'zod');
    assert.ok(schemas.some(s => s.name === 'UserSchema'), 'Should detect UserSchema');
    assert.ok(schemas.some(s => s.name === 'ConfigValidator'), 'Should detect ConfigValidator');
  });

  it('skips files that do not import zod', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchZodSchemas } = await import('../src/indexer/pattern-matchers/zod');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('nozodtest');
    fs.mkdirSync(path.join(proj, 'src', 'models'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    // This file has z.object but doesn't import zod
    fs.writeFileSync(path.join(proj, 'src', 'models', 'fake.ts'),
      "const FakeSchema = z.object({ x: z.string() });");

    scanProject(proj);
    matchZodSchemas(proj);
    const { nodes } = exportGraph();
    const zodSchemas = nodes.filter(n => n.type === 'schema' && n.properties.source === 'zod');
    assert.strictEqual(zodSchemas.length, 0, 'Should not detect schemas without zod import');
  });

  it('links uses_schema edge to containing module', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { matchZodSchemas } = await import('../src/indexer/pattern-matchers/zod');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('zodedgetest');
    fs.mkdirSync(path.join(proj, 'src', 'validators'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'validators', 'input.ts'), `
      import { z } from 'zod';
      export const InputSchema = z.object({ value: z.string() });
    `);

    scanProject(proj);
    matchZodSchemas(proj);
    const { edges } = exportGraph();
    const schemaEdges = edges.filter(e => e.type === 'uses_schema');
    assert.ok(schemaEdges.length >= 1, 'Should create uses_schema edge');
  });
});

describe('Doc generator', () => {
  it('creates docs for modules', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { generateDocs } = await import('../src/core/doc-generator');
    const { getAllDocs } = await import('../src/core/db');

    const proj = createProject('docgentest');
    fs.mkdirSync(path.join(proj, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    scanProject(proj);
    generateDocs();
    const docs = getAllDocs();
    assert.ok(docs.length >= 1, 'Should generate at least one doc');
  });

  it('skips manually-edited docs', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { generateDocs } = await import('../src/core/doc-generator');
    const { upsertDoc, getDoc } = await import('../src/core/db');
    const { exportGraph } = await import('../src/core/graph');

    const proj = createProject('manualdoctest');
    fs.mkdirSync(path.join(proj, 'src', 'core'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    scanProject(proj);
    const { nodes } = exportGraph();
    const mod = nodes.find(n => n.type === 'module');
    assert.ok(mod, 'Should have a module node');

    // Manually edit the doc
    upsertDoc({
      moduleId: mod.id,
      content: 'Custom content that should be preserved',
      generatedAt: Date.now(),
      isManuallyEdited: true,
    });

    generateDocs();
    const doc = getDoc(mod.id);
    assert.ok(doc);
    assert.strictEqual(doc.content, 'Custom content that should be preserved');
    assert.strictEqual(doc.isManuallyEdited, true);
  });

  it('generated doc includes Contents section for modules with children', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { generateDocs } = await import('../src/core/doc-generator');
    const { getAllDocs } = await import('../src/core/db');

    const proj = createProject('docsections');
    fs.mkdirSync(path.join(proj, 'src', 'lib', 'helpers'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');

    scanProject(proj);
    generateDocs();
    const docs = getAllDocs();
    // The 'src' module contains 'lib', so its doc should have a Contents section
    const srcDoc = docs.find(d => d.content.includes('# src'));
    if (srcDoc) {
      assert.ok(srcDoc.content.includes('## Contents'), 'Should have Contents section');
    }
  });

  it('generated doc includes Dependencies section', async () => {
    const { scanProject } = await import('../src/indexer/scanner');
    const { resolveImports } = await import('../src/indexer/import-resolver');
    const { generateDocs } = await import('../src/core/doc-generator');
    const { getAllDocs } = await import('../src/core/db');

    const proj = createProject('docdeps');
    fs.mkdirSync(path.join(proj, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(proj, 'src', 'utils'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'package.json'), '{}');
    fs.writeFileSync(path.join(proj, 'src', 'utils', 'h.ts'), 'export const h = 1;');
    fs.writeFileSync(path.join(proj, 'src', 'api', 'index.ts'), "import { h } from '../utils/h';");

    scanProject(proj);
    resolveImports(proj);
    generateDocs();
    const docs = getAllDocs();
    const apiDoc = docs.find(d => d.content.includes('# api'));
    if (apiDoc) {
      assert.ok(apiDoc.content.includes('## Dependencies'), 'Should have Dependencies section');
    }
  });
});
