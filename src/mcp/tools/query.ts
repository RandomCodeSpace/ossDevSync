import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { indexProject } from '../../core/indexer';
import { getNodeData, getNeighbors, getNodeEdges, findPath, getImpact, exportGraph, getStats } from '../../core/graph';
import { getDb } from '../../core/db';

export function registerQueryTools(server: McpServer): void {
  // Index/re-index a project
  server.tool(
    'osssync_index',
    'Index or re-index a codebase into the knowledge graph',
    {
      path: z.string().describe('Absolute path to the project directory'),
      incremental: z.boolean().optional().default(false).describe('Whether to do incremental indexing'),
    },
    async ({ path: projectPath, incremental }) => {
      try {
        const result = await indexProject(projectPath, incremental);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              projectPath: result.projectPath,
              nodeCount: result.nodeCount,
              edgeCount: result.edgeCount,
              nodesByType: result.nodesByType,
              duration: `${result.duration}ms`,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error indexing project: ${error}` }],
        };
      }
    }
  );

  // Query the knowledge graph
  server.tool(
    'osssync_query',
    'Query the knowledge graph. Returns nodes matching the query.',
    {
      nodeType: z.string().optional().describe('Filter by node type: project|module|entry|api|route|schema|config|external'),
      name: z.string().optional().describe('Filter by name (substring match)'),
      path: z.string().optional().describe('Filter by path (substring match)'),
    },
    async ({ nodeType, name, path: pathFilter }) => {
      const { nodes, edges } = exportGraph();

      let filtered = nodes;
      if (nodeType) filtered = filtered.filter(n => n.type === nodeType);
      if (name) filtered = filtered.filter(n => n.name.toLowerCase().includes(name.toLowerCase()));
      if (pathFilter) filtered = filtered.filter(n => n.path?.includes(pathFilter));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: filtered.length, nodes: filtered }, null, 2),
        }],
      };
    }
  );

  // Get module details
  server.tool(
    'osssync_get_module',
    'Get detailed information about a specific module including its connections',
    {
      moduleId: z.string().describe('The ID of the module node'),
    },
    async ({ moduleId }) => {
      const node = getNodeData(moduleId);
      if (!node) {
        return { content: [{ type: 'text' as const, text: `Module ${moduleId} not found` }] };
      }

      const edges = getNodeEdges(moduleId);
      const inbound = getNeighbors(moduleId, 'in');
      const outbound = getNeighbors(moduleId, 'out');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            module: node,
            edges,
            dependsOn: outbound.map(n => ({ id: n.id, name: n.name, type: n.type })),
            dependedOnBy: inbound.map(n => ({ id: n.id, name: n.name, type: n.type })),
          }, null, 2),
        }],
      };
    }
  );

  // Get dependencies
  server.tool(
    'osssync_get_dependencies',
    'Get the dependency tree for a module',
    {
      moduleId: z.string().describe('The module ID'),
      direction: z.enum(['in', 'out', 'both']).optional().default('both').describe('Direction: in (dependents), out (dependencies), both'),
    },
    async ({ moduleId, direction }) => {
      const neighbors = getNeighbors(moduleId, direction);
      const edges = getNodeEdges(moduleId, direction);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            moduleId,
            direction,
            dependencies: neighbors.map(n => ({ id: n.id, name: n.name, type: n.type, path: n.path })),
            edges: edges.map(e => ({ id: e.id, type: e.type, source: e.sourceId, target: e.targetId })),
          }, null, 2),
        }],
      };
    }
  );

  // Find path between nodes
  server.tool(
    'osssync_find_path',
    'Find the connection path between two nodes in the knowledge graph',
    {
      fromId: z.string().describe('Source node ID'),
      toId: z.string().describe('Target node ID'),
    },
    async ({ fromId, toId }) => {
      const pathResult = findPath(fromId, toId);

      if (!pathResult) {
        return { content: [{ type: 'text' as const, text: `No path found between ${fromId} and ${toId}` }] };
      }

      const pathNodes = pathResult.map(id => getNodeData(id)).filter(Boolean);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            path: pathNodes.map(n => ({ id: n!.id, name: n!.name, type: n!.type })),
            length: pathResult.length,
          }, null, 2),
        }],
      };
    }
  );

  // Impact analysis
  server.tool(
    'osssync_impact_analysis',
    'Analyze what modules would be affected if a given module changes',
    {
      moduleId: z.string().describe('The module ID to analyze impact for'),
    },
    async ({ moduleId }) => {
      const node = getNodeData(moduleId);
      if (!node) {
        return { content: [{ type: 'text' as const, text: `Module ${moduleId} not found` }] };
      }

      const { affected, depth } = getImpact(moduleId);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            module: { id: node.id, name: node.name },
            affectedCount: affected.length,
            affected: affected.map(n => ({
              id: n.id,
              name: n.name,
              type: n.type,
              depth: depth.get(n.id),
            })),
          }, null, 2),
        }],
      };
    }
  );

  // Get architecture overview
  server.tool(
    'osssync_get_architecture',
    'Get the full architecture overview of the indexed project',
    {
      format: z.enum(['json', 'markdown', 'mermaid']).optional().default('json').describe('Output format'),
    },
    async ({ format }) => {
      const { nodes, edges } = exportGraph();
      const stats = getStats();

      if (format === 'json') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ stats, nodes, edges }, null, 2),
          }],
        };
      }

      if (format === 'mermaid') {
        const modules = nodes.filter(n => n.type === 'module' || n.type === 'project');
        const importEdges = edges.filter(e => e.type === 'imports' || e.type === 'contains');

        let mermaid = 'graph TD\n';
        for (const mod of modules) {
          const label = mod.name.replace(/[^a-zA-Z0-9]/g, '_');
          mermaid += `  ${mod.id}[${label}]\n`;
        }
        for (const edge of importEdges) {
          const label = edge.type;
          mermaid += `  ${edge.sourceId} -->|${label}| ${edge.targetId}\n`;
        }

        return { content: [{ type: 'text' as const, text: mermaid }] };
      }

      // Markdown format
      let md = '# Architecture Overview\n\n';
      md += `## Stats\n- Nodes: ${stats.nodeCount}\n- Edges: ${stats.edgeCount}\n\n`;
      md += '### Nodes by Type\n';
      for (const [type, count] of Object.entries(stats.nodesByType)) {
        md += `- ${type}: ${count}\n`;
      }
      md += '\n## Modules\n';
      for (const node of nodes.filter(n => n.type === 'module')) {
        const deps = getNeighbors(node.id, 'out');
        md += `\n### ${node.name}\n- Path: ${node.path}\n`;
        if (deps.length > 0) {
          md += `- Dependencies: ${deps.map(d => d.name).join(', ')}\n`;
        }
      }

      return { content: [{ type: 'text' as const, text: md }] };
    }
  );
}
