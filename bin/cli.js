#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];
const pkgDir = path.resolve(__dirname, '..');

function getPort() {
  if (args.includes('--port')) return args[args.indexOf('--port') + 1];
  if (args.includes('-p')) return args[args.indexOf('-p') + 1];
  return '3000';
}

function run(cmd) {
  const child = spawn('npx', cmd.split(' '), {
    cwd: pkgDir,
    stdio: 'inherit',
    shell: true,
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
    build         Build for production
    mcp           Start MCP server (stdio transport)
    help          Show this help message

  Options:
    --port, -p    Port number (default: 3000)

  Examples:
    ossdevsync                    Build & start production server
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

  case 'dev': {
    run(`next dev --port ${getPort()}`);
    break;
  }

  case 'build':
    run('next build');
    break;

  case 'mcp':
    run('tsx src/mcp/standalone.ts');
    break;

  case 'start': {
    run(`next start --port ${getPort()}`);
    break;
  }

  default: {
    // Default: build if .next doesn't exist, then start
    const dotNext = path.join(pkgDir, '.next');
    if (!fs.existsSync(dotNext)) {
      console.log('Building for production...');
      const build = spawn('npx', ['next', 'build'], {
        cwd: pkgDir,
        stdio: 'inherit',
        shell: true,
      });
      build.on('exit', (code) => {
        if (code !== 0) process.exit(code || 1);
        console.log('Starting production server...');
        run(`next start --port ${getPort()}`);
      });
    } else {
      run(`next start --port ${getPort()}`);
    }
    break;
  }
}
