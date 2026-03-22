#!/usr/bin/env node
/**
 * Standalone MCP server entry point.
 * Use this to connect ossSync as an MCP server to Claude Code or other MCP clients.
 *
 * Usage: npx tsx src/mcp/standalone.ts
 * Or add to Claude Code settings:
 *   "mcpServers": { "osssync": { "command": "npx", "args": ["tsx", "src/mcp/standalone.ts"], "cwd": "/path/to/ossSync" } }
 */
import { startMcpServer } from './server';

startMcpServer().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
