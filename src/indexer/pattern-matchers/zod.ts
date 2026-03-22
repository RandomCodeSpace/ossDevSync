import fs from 'fs';
import path from 'path';
import { addNode, addEdgeBetween, getGraph } from '../../core/graph';

const ZOD_PATTERNS = [
  // const UserSchema = z.object({...})
  /(?:export\s+)?(?:const|let|var)\s+(\w+(?:Schema|Validator|Type))\s*=\s*z\.(object|array|string|number|enum|union|intersection|discriminatedUnion)\s*\(/g,
  // export const schema = z.object({...})
  /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*z\.object\s*\(/g,
];

export function matchZodSchemas(projectPath: string): void {
  const graph = getGraph();

  graph.forEachNode((nodeId, attrs) => {
    if (attrs.type !== 'module') return;
    if (!attrs.path) return;

    const modulePath = attrs.path as string;

    try {
      const files = fs.readdirSync(modulePath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !/\.(ts|tsx)$/.test(file.name)) continue;

        const filePath = path.join(modulePath, file.name);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Only process files that import zod
        if (!content.includes('from \'zod\'') && !content.includes('from "zod"') && !content.includes("require('zod')")) {
          continue;
        }

        for (const pattern of ZOD_PATTERNS) {
          const regex = new RegExp(pattern.source, pattern.flags);
          let match;

          while ((match = regex.exec(content)) !== null) {
            const schemaName = match[1];

            const schemaNode = addNode('schema', schemaName, filePath, {
              source: 'zod',
              zodType: match[2] || 'object',
            });

            addEdgeBetween(nodeId, schemaNode.id, 'uses_schema');
          }
        }
      }
    } catch {
      // skip
    }
  });
}
