import fs from 'fs';
import path from 'path';
import { addNode, addEdgeBetween } from '../core/graph';
import type { GraphNode, NodeType } from '../types';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.osssync',
  'coverage', '.turbo', '.cache', '__pycache__', '.venv', 'vendor',
]);

const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'next.config.ts', 'next.config.js',
  'vite.config.ts', 'webpack.config.js', '.env', '.env.local',
  'docker-compose.yml', 'Dockerfile', 'prisma/schema.prisma',
]);

export interface ScanOptions {
  maxDepth?: number;
  includeEntries?: boolean;
}

export function scanProject(projectPath: string, options: ScanOptions = {}): GraphNode {
  const { maxDepth = 10, includeEntries = true } = options;

  const projectName = path.basename(projectPath);
  const projectNode = addNode('project', projectName, projectPath, {
    language: detectLanguage(projectPath),
    framework: detectFramework(projectPath),
  });

  scanDirectory(projectPath, projectNode.id, 1, maxDepth, includeEntries);

  return projectNode;
}

function scanDirectory(dirPath: string, parentId: string, depth: number, maxDepth: number, includeEntries: boolean): void {
  if (depth > maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const dirs = entries.filter(e => e.isDirectory() && !IGNORE_DIRS.has(e.name) && !e.name.startsWith('.'));
  const files = entries.filter(e => e.isFile());

  for (const dir of dirs) {
    const fullPath = path.join(dirPath, dir.name);
    const moduleType = inferModuleType(dir.name, fullPath);

    const moduleNode = addNode('module', dir.name, fullPath, {
      moduleType,
      depth,
    });

    addEdgeBetween(parentId, moduleNode.id, 'contains');

    // Check for config files in this directory
    for (const file of files) {
      if (CONFIG_FILES.has(file.name)) {
        const configNode = addNode('config', file.name, path.join(dirPath, file.name), {
          format: path.extname(file.name).slice(1) || 'text',
        });
        addEdgeBetween(parentId, configNode.id, 'configured_by');
      }
    }

    if (includeEntries) {
      scanEntryFiles(fullPath, moduleNode.id);
    }

    scanDirectory(fullPath, moduleNode.id, depth + 1, maxDepth, includeEntries);
  }

  // Top-level config files
  if (depth === 1) {
    for (const file of files) {
      if (CONFIG_FILES.has(file.name) || file.name.startsWith('.env')) {
        const configNode = addNode('config', file.name, path.join(dirPath, file.name), {
          format: path.extname(file.name).slice(1) || 'text',
        });
        addEdgeBetween(parentId, configNode.id, 'configured_by');
      }
    }
  }
}

function scanEntryFiles(dirPath: string, moduleId: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const codeFiles = entries.filter(e =>
    e.isFile() && isCodeFile(e.name)
  );

  for (const file of codeFiles) {
    const filePath = path.join(dirPath, file.name);
    const kind = inferEntryKind(file.name, filePath);

    if (kind) {
      const entryNode = addNode('entry', file.name, filePath, { kind });
      addEdgeBetween(moduleId, entryNode.id, 'contains');
    }
  }
}

function isCodeFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb'].includes(ext);
}

function inferModuleType(dirName: string, _dirPath: string): string {
  const name = dirName.toLowerCase();
  if (['api', 'routes', 'handlers', 'controllers', 'endpoints'].includes(name)) return 'service';
  if (['lib', 'libs', 'packages', 'core'].includes(name)) return 'lib';
  if (['utils', 'helpers', 'shared', 'common'].includes(name)) return 'util';
  if (['config', 'configs', 'settings'].includes(name)) return 'config';
  if (['models', 'entities', 'schemas', 'types'].includes(name)) return 'model';
  if (['components', 'ui', 'views', 'pages'].includes(name)) return 'ui';
  if (['tests', 'test', '__tests__', 'spec'].includes(name)) return 'test';
  if (['middleware', 'middlewares'].includes(name)) return 'middleware';
  if (['services'].includes(name)) return 'service';
  return 'module';
}

function inferEntryKind(filename: string, _filePath: string): string | null {
  const name = filename.toLowerCase();
  if (name.includes('route') || name.includes('router')) return 'route';
  if (name.includes('controller')) return 'controller';
  if (name.includes('model') || name.includes('schema') || name.includes('entity')) return 'model';
  if (name.includes('middleware')) return 'middleware';
  if (name.includes('handler')) return 'handler';
  if (name.includes('service')) return 'service';
  if (name === 'index.ts' || name === 'index.js' || name === 'index.tsx') return 'index';
  if (name.includes('test') || name.includes('spec')) return null; // skip test files as entries
  return null; // only create entry nodes for meaningful files
}

function detectLanguage(projectPath: string): string {
  try {
    const files = fs.readdirSync(projectPath);
    if (files.includes('tsconfig.json')) return 'typescript';
    if (files.includes('package.json')) return 'javascript';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('pyproject.toml') || files.includes('setup.py')) return 'python';
    if (files.includes('Gemfile')) return 'ruby';
    if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
  } catch {
    // ignore
  }
  return 'unknown';
}

function detectFramework(projectPath: string): string {
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) return 'next.js';
      if (deps['nuxt']) return 'nuxt';
      if (deps['@angular/core']) return 'angular';
      if (deps['vue']) return 'vue';
      if (deps['react']) return 'react';
      if (deps['express']) return 'express';
      if (deps['fastify']) return 'fastify';
      if (deps['hono']) return 'hono';
    }
  } catch {
    // ignore
  }
  return 'unknown';
}
