#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];
const pkgDir = path.resolve(__dirname, '..');
const binDir = path.join(pkgDir, 'node_modules', '.bin');

function getPort() {
  if (args.includes('--port')) return args[args.indexOf('--port') + 1];
  if (args.includes('-p')) return args[args.indexOf('-p') + 1];
  return '3000';
}

function run(bin, cmdArgs) {
  const binPath = path.join(binDir, bin);
  const child = spawn(binPath, cmdArgs, {
    cwd: pkgDir,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code || 0));
}

const HELP = `
  ossDevSync — Codebase knowledge graph & architecture editor

  Usage:
    ossdevsync [command] [options]

  Commands:
    start         Start production server (default)
    dev           Start development server
    mcp           Start MCP server (stdio transport)
    help          Show this help message

  Options:
    --port, -p    Port number (default: 3000)

  Examples:
    ossdevsync                    Start production server
    ossdevsync --port 4000        Start on port 4000
    ossdevsync dev                Start dev server with hot reload
    ossdevsync mcp                Start as MCP server for Claude Code

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

  case 'dev':
    run('next', ['dev', '--port', getPort()]);
    break;

  case 'mcp':
    run('tsx', ['src/mcp/standalone.ts']);
    break;

  case 'start':
  default:
    run('next', ['start', '--port', getPort()]);
    break;
}
