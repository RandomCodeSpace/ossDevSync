import fs from 'fs';
import path from 'path';
import { getGraph, addNode, addEdgeBetween } from '../../core/graph';

const ROUTE_PATTERNS = [
  // Express: app.get('/path', handler) or router.get('/path', handler)
  /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  // Fastify: fastify.get('/path', handler)
  /(?:fastify|server|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
];

export function matchExpressRoutes(projectPath: string): void {
  const graph = getGraph();

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.type !== 'module' && attrs.type !== 'entry') return;
    if (!attrs.path) return;

    const nodePath = attrs.path as string;
    const files = getRoutableFiles(nodePath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');

        for (const pattern of ROUTE_PATTERNS) {
          const regex = new RegExp(pattern.source, pattern.flags);
          let match;

          while ((match = regex.exec(content)) !== null) {
            const method = match[1].toUpperCase();
            const routePath = match[2];

            const apiNode = addNode('api', `${method} ${routePath}`, file, {
              method,
              path: routePath,
              protocol: 'http',
              handler: path.basename(file),
            });

            // Find the containing module
            const containingModule = findContainingModule(nodeId, attrs, graph);
            if (containingModule) {
              addEdgeBetween(containingModule, apiNode.id, 'exposes');
            }
          }
        }
      } catch {
        // skip
      }
    }
  });

  // Also detect Next.js API routes by convention
  detectNextApiRoutes(projectPath);
}

function detectNextApiRoutes(projectPath: string): void {
  const apiDirs = [
    path.join(projectPath, 'src', 'app', 'api'),
    path.join(projectPath, 'app', 'api'),
    path.join(projectPath, 'pages', 'api'),
  ];

  for (const apiDir of apiDirs) {
    if (!fs.existsSync(apiDir)) continue;

    scanNextApiDir(apiDir, apiDir);
  }
}

function scanNextApiDir(dirPath: string, baseDir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      scanNextApiDir(fullPath, baseDir);
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      const relativePath = '/' + path.relative(baseDir, dirPath).replace(/\\/g, '/');

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const methods = detectExportedMethods(content);

        for (const method of methods) {
          addNode('api', `${method} /api${relativePath}`, fullPath, {
            method,
            path: `/api${relativePath}`,
            protocol: 'http',
            handler: `route.ts`,
            framework: 'next.js',
          });
        }
      } catch {
        addNode('api', `ALL /api${relativePath}`, fullPath, {
          method: 'ALL',
          path: `/api${relativePath}`,
          protocol: 'http',
          framework: 'next.js',
        });
      }
    }
  }
}

function detectExportedMethods(content: string): string[] {
  const methods: string[] = [];
  const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g;
  let match;

  while ((match = methodPattern.exec(content)) !== null) {
    methods.push(match[1]);
  }

  return methods.length > 0 ? methods : ['ALL'];
}

function getRoutableFiles(dirPath: string): string[] {
  try {
    const stat = fs.statSync(dirPath);
    if (stat.isFile()) return [dirPath];

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && /\.(ts|js|tsx|jsx)$/.test(e.name))
      .map(e => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

function findContainingModule(nodeId: string, attrs: Record<string, unknown>, graph: ReturnType<typeof getGraph>): string | null {
  if (attrs.type === 'module') return nodeId;

  // Walk up to find parent module
  const inEdges = graph.inEdges(nodeId);
  for (const edgeId of inEdges) {
    const edgeAttrs = graph.getEdgeAttributes(edgeId);
    if (edgeAttrs.type === 'contains') {
      return graph.source(edgeId);
    }
  }

  return null;
}
