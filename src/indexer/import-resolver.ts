import fs from 'fs';
import path from 'path';
import { getGraph, addEdgeBetween } from '../core/graph';

// Regex patterns for different import styles
const IMPORT_PATTERNS = [
  // ES6: import { x } from './path'
  /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
  // require: const x = require('./path')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic import: import('./path')
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function resolveImports(projectPath: string): void {
  const graph = getGraph();
  const modulePathMap = buildModulePathMap(graph);

  // For each module node, scan its files for imports
  graph.forEachNode((nodeId, attrs) => {
    if (attrs.type !== 'module' || !attrs.path) return;

    const modulePath = attrs.path as string;
    const imports = scanModuleImports(modulePath);

    for (const importPath of imports) {
      const resolvedTarget = resolveImportPath(importPath, modulePath, projectPath, modulePathMap);
      if (resolvedTarget && resolvedTarget !== nodeId && graph.hasNode(resolvedTarget)) {
        // Check if edge already exists
        const existingEdges = graph.edges(nodeId, resolvedTarget);
        const hasImportEdge = existingEdges.some(e => graph.getEdgeAttribute(e, 'type') === 'imports');

        if (!hasImportEdge) {
          addEdgeBetween(nodeId, resolvedTarget, 'imports', { importPath });
        }
      }
    }
  });
}

function buildModulePathMap(graph: ReturnType<typeof getGraph>): Map<string, string> {
  const map = new Map<string, string>();

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.path) {
      map.set(attrs.path as string, nodeId);
    }
  });

  return map;
}

function scanModuleImports(modulePath: string): string[] {
  const imports: string[] = [];

  let files: string[];
  try {
    files = getCodeFiles(modulePath);
  } catch {
    return imports;
  }

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      for (const pattern of IMPORT_PATTERNS) {
        // Reset regex
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          const importPath = match[1];
          if (importPath) {
            imports.push(importPath);
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return [...new Set(imports)]; // deduplicate
}

function getCodeFiles(dirPath: string): string[] {
  const result: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
          result.push(fullPath);
        }
      }
    }
  } catch {
    // ignore
  }

  return result;
}

function resolveImportPath(
  importPath: string,
  fromModulePath: string,
  projectPath: string,
  modulePathMap: Map<string, string>
): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/') && !importPath.startsWith('~/')) {
    return null;
  }

  // Handle alias imports (@/, ~/)
  let resolvedPath: string;
  if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
    resolvedPath = path.join(projectPath, 'src', importPath.slice(2));
  } else {
    resolvedPath = path.resolve(fromModulePath, importPath);
  }

  // Try to find the module that contains this path
  // Walk up the directory tree to find a matching module
  let checkPath = resolvedPath;

  // Try with extensions first
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const fullPath = checkPath + ext;
    try {
      if (fs.existsSync(fullPath)) {
        // Find the containing module
        let dir = fs.statSync(fullPath).isDirectory() ? fullPath : path.dirname(fullPath);
        while (dir !== projectPath && dir !== '/') {
          const moduleId = modulePathMap.get(dir);
          if (moduleId) return moduleId;
          dir = path.dirname(dir);
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}
