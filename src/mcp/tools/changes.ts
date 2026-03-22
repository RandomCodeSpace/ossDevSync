import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPendingChangeSpecs, getChangeSpec, updateChangeSpecStatus } from '../../core/db';

export function registerChangesTools(server: McpServer): void {
  server.tool(
    'osssync_get_pending_changes',
    'Get all pending change specs created from UI edits that need to be executed',
    {},
    async () => {
      const specs = getPendingChangeSpecs();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: specs.length,
            changes: specs,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'osssync_get_change_spec',
    'Get details of a specific change spec',
    {
      specId: z.string().describe('The change spec ID'),
    },
    async ({ specId }) => {
      const spec = getChangeSpec(specId);
      if (!spec) {
        return { content: [{ type: 'text' as const, text: `Change spec ${specId} not found` }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(spec, null, 2) }] };
    }
  );

  server.tool(
    'osssync_complete_change',
    'Mark a change spec as completed after the agent has executed it',
    {
      specId: z.string().describe('The change spec ID'),
      result: z.string().describe('Summary of what was done'),
    },
    async ({ specId, result }) => {
      const spec = getChangeSpec(specId);
      if (!spec) {
        return { content: [{ type: 'text' as const, text: `Change spec ${specId} not found` }] };
      }

      updateChangeSpecStatus(specId, 'completed');

      return {
        content: [{
          type: 'text' as const,
          text: `Change spec ${specId} marked as completed. Result: ${result}`,
        }],
      };
    }
  );
}
