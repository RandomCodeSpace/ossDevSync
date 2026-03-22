import { scanProject } from '../indexer/scanner';
import { resolveImports } from '../indexer/import-resolver';
import { matchExpressRoutes } from '../indexer/pattern-matchers/express';
import { matchPrismaSchemas } from '../indexer/pattern-matchers/prisma';
import { matchZodSchemas } from '../indexer/pattern-matchers/zod';
import { clearAll, getStats } from './graph';
import { getDb } from './db';

export interface IndexResult {
  projectPath: string;
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  duration: number;
}

export async function indexProject(projectPath: string, incremental = false): Promise<IndexResult> {
  const start = Date.now();

  // Ensure DB is initialized
  getDb(projectPath);

  if (!incremental) {
    clearAll();
  }

  // Phase 1: Scan directory structure → create Module nodes
  scanProject(projectPath);

  // Phase 2: Resolve imports → create import edges
  resolveImports(projectPath);

  // Phase 3: Pattern matching → create API, Schema, etc. nodes
  matchExpressRoutes(projectPath);
  matchPrismaSchemas(projectPath);
  matchZodSchemas(projectPath);

  const stats = getStats();
  const duration = Date.now() - start;

  return {
    projectPath,
    ...stats,
    duration,
  };
}
