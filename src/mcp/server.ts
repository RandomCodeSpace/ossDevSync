import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerQueryTools } from './tools/query';
import { registerDocsTools } from './tools/docs';
import { registerChangesTools } from './tools/changes';

let mcpServer: McpServer | null = null;

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'osssync',
    version: '0.1.0',
  });

  // Register all tools
  registerQueryTools(server);
  registerDocsTools(server);
  registerChangesTools(server);

  mcpServer = server;
  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function getMcpServer(): McpServer | null {
  return mcpServer;
}
