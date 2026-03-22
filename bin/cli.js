#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];
const pkgDir = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  return spawn('npx', cmd.split(' '), {
    cwd: pkgDir,
    stdio: 'inherit',
    ...opts,
  });
}

const HELP = `
  ossDevSync — Codebase knowledge graph & architecture editor

  Usage:
    ossdevsync [command] [options]

  Commands:
    dev           Start development server (default)
    start         Start production server
    build         Build for production
    mcp           Start MCP server (stdio transport)
    help          Show this help message

  Options:
    --port, -p    Port number (default: 3000)

  Examples:
    ossdevsync                    Start dev server on port 3000
    ossdevsync dev --port 4000    Start dev server on port 4000
    ossdevsync mcp                Start as MCP server for Claude Code
    ossdevsync build && ossdevsync start

  MCP Setup (Claude Code):
    Add to your MCP settings:
    {
      "mcpServers": {
        "ossdevsync": {
          "command": "ossdevsync",
          "args": ["mcp"]
        }
      }
    }
`;

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    console.log(HELP);
    break;

  case 'build':
    run('next build');
    break;

  case 'start': {
    const port = args.includes('--port') ? args[args.indexOf('--port') + 1] :
                 args.includes('-p') ? args[args.indexOf('-p') + 1] : '3000';
    run(`next start --port ${port}`);
    break;
  }

  case 'mcp':
    run('tsx src/mcp/standalone.ts');
    break;

  case 'dev':
  default: {
    const port = args.includes('--port') ? args[args.indexOf('--port') + 1] :
                 args.includes('-p') ? args[args.indexOf('-p') + 1] : '3000';
    run(`next dev --port ${port}`);
    break;
  }
}
