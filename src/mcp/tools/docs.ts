import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDoc, getAllDocs, upsertDoc } from '../../core/db';

export function registerDocsTools(server: McpServer): void {
  server.tool(
    'osssync_get_docs',
    'Get generated documentation for a module or all modules',
    {
      moduleId: z.string().optional().describe('Module ID. If omitted, returns all docs.'),
    },
    async ({ moduleId }) => {
      if (moduleId) {
        const doc = getDoc(moduleId);
        if (!doc) {
          return { content: [{ type: 'text' as const, text: `No documentation found for module ${moduleId}` }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(doc, null, 2) }] };
      }

      const docs = getAllDocs();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: docs.length, docs }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'osssync_update_docs',
    'Update documentation for a module',
    {
      moduleId: z.string().describe('The module ID to update docs for'),
      content: z.string().describe('The new documentation content (markdown)'),
    },
    async ({ moduleId, content }) => {
      const existing = getDoc(moduleId);
      const now = Date.now();

      upsertDoc({
        moduleId,
        content,
        generatedAt: existing?.generatedAt ?? now,
        editedAt: now,
        isManuallyEdited: true,
      });

      return {
        content: [{ type: 'text' as const, text: `Documentation updated for module ${moduleId}` }],
      };
    }
  );
}
