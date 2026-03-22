<p align="center">
  <h1 align="center">ossDevSync</h1>
  <p align="center">
    Codebase knowledge graph, auto-documentation & interactive architecture editor
    <br />
    with MCP server integration for AI coding agents
  </p>
</p>

<p align="center">
  <a href="https://github.com/RandomCodeSpace/ossDevSync/actions/workflows/ci.yml">
    <img src="https://github.com/RandomCodeSpace/ossDevSync/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/RandomCodeSpace/ossDevSync/pkgs/npm/ossdevsync">
    <img src="https://img.shields.io/github/v/release/RandomCodeSpace/ossDevSync?label=version" alt="version" />
  </a>
  <a href="https://github.com/RandomCodeSpace/ossDevSync/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/RandomCodeSpace/ossDevSync.svg" alt="License" />
  </a>
  <a href="https://github.com/RandomCodeSpace/ossDevSync">
    <img src="https://img.shields.io/github/stars/RandomCodeSpace/ossDevSync.svg?style=social" alt="GitHub stars" />
  </a>
</p>

---

## What is ossDevSync?

ossDevSync indexes your codebase into a **knowledge graph**, generates **living documentation**, and provides an **interactive architecture editor** — all in a local web UI.

The unique feature is the **bidirectional feedback loop**: edit architecture or documentation in the UI, and a structured change spec is generated for your AI coding agent to execute.

```
Code → Knowledge Graph → Web UI → Edit Architecture → Change Spec → Agent Refactors Code
```

### Key Features

- **Knowledge Graph** — indexes modules, APIs, schemas, configs, dependencies, and data flows
- **Auto-Documentation** — generates markdown docs from the graph, stays in sync
- **Architecture Editor** — drag-drop modules in a React Flow canvas
- **Change Specs** — UI edits create structured specs for coding agents
- **MCP Server** — 12 tools for Claude Code, Cursor, and other MCP-compatible agents
- **File Watching** — incremental updates when your code changes
- **Zero Dependencies** — no Docker, no Neo4j, no external services. Just `npm install`.
- **Multi-Language** — indexes TypeScript, JavaScript, Go, Python, Rust, Java, Ruby projects

---

## Quick Start

### Install

Configure the GitHub Packages registry for the `@randomcodespace` scope:

```bash
echo "@randomcodespace:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

Then install:

```bash
npm install -g @randomcodespace/ossdevsync
```

### Run

```bash
# Start the web UI + API server
ossdevsync

# Or with npx (no install)
npx @randomcodespace/ossdevsync
```

Open [http://localhost:3000](http://localhost:3000), click **Index Project**, and enter the path to your codebase.

### From Source

```bash
git clone https://github.com/RandomCodeSpace/ossDevSync.git
cd ossDevSync
npm install
npm run dev
```

---

## MCP Server Setup

ossDevSync works as an [MCP server](https://modelcontextprotocol.io) for AI coding agents.

### Claude Code (CLI)

**Option 1 — Use the Claude Code CLI to add it directly:**

```bash
claude mcp add ossdevsync -- ossdevsync mcp
```

This registers the MCP server in your project's `.mcp.json`.

**Option 2 — Add to project config (`.mcp.json` in project root):**

```json
{
  "mcpServers": {
    "ossdevsync": {
      "command": "ossdevsync",
      "args": ["mcp"]
    }
  }
}
```

**Option 3 — Add globally (`~/.claude/settings.json`):**

```json
{
  "mcpServers": {
    "ossdevsync": {
      "command": "ossdevsync",
      "args": ["mcp"]
    }
  }
}
```

> After adding, restart Claude Code or run `/mcp` to verify the server is connected. You should see 12 ossdevsync tools available.

### VS Code (Copilot / Continue / Cline)

**Step 1 — Create `.vscode/mcp.json` in your project root:**

```json
{
  "servers": {
    "ossdevsync": {
      "command": "ossdevsync",
      "args": ["mcp"]
    }
  }
}
```

**Step 2 — Enable MCP in VS Code settings (`settings.json`):**

```json
{
  "chat.mcp.enabled": true
}
```

**Step 3 — Reload VS Code** (`Ctrl+Shift+P` → `Developer: Reload Window`).

The MCP server will appear in the MCP server list. Click the MCP icon in the Chat panel to verify it's connected.

> **Note:** VS Code MCP support requires VS Code 1.99+ with GitHub Copilot Chat extension. For other AI extensions like Continue or Cline, refer to their MCP configuration docs — they use the same `command` and `args` format.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `osssync_index` | Index or re-index a codebase |
| `osssync_query` | Query the knowledge graph by type, name, or path |
| `osssync_get_module` | Get module details with all connections |
| `osssync_get_dependencies` | Get dependency tree (in/out/both) |
| `osssync_find_path` | Find connection path between two nodes |
| `osssync_impact_analysis` | Analyze what's affected by changing a module |
| `osssync_get_architecture` | Full architecture as JSON, Markdown, or Mermaid |
| `osssync_get_docs` | Get auto-generated documentation |
| `osssync_update_docs` | Update documentation for a module |
| `osssync_get_pending_changes` | Get change specs from UI edits |
| `osssync_get_change_spec` | Get a specific change spec |
| `osssync_complete_change` | Mark a change as executed |

---

## Web UI

The web UI runs at `http://localhost:3000` and provides three views:

### Graph View
Interactive architecture visualization using React Flow. Drag modules, draw edges, and click nodes to inspect details.

### Docs View
Browse and edit auto-generated documentation. Edits are preserved across re-indexes.

### Changes View
Review, approve, or reject change specs created from UI edits. Approved changes are picked up by your coding agent.

---

## API Reference

All endpoints are available at `http://localhost:3000/api/`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/index` | Index a project. Body: `{ "path": "/abs/path", "watch": true }` |
| `DELETE` | `/api/index` | Stop file watcher |
| `GET` | `/api/graph` | Get full graph (nodes + edges) |
| `GET` | `/api/graph?action=stats` | Get graph statistics |
| `GET` | `/api/graph?nodeId=X` | Get node details |
| `GET` | `/api/docs` | Get all documentation |
| `GET` | `/api/docs?moduleId=X` | Get doc for a module |
| `PUT` | `/api/docs` | Update doc. Body: `{ "moduleId": "X", "content": "..." }` |
| `GET` | `/api/changes` | Get pending change specs |
| `POST` | `/api/changes` | Create a change spec |
| `PATCH` | `/api/changes` | Update change spec status |

---

## Architecture

```
ossDevSync Process
├── Next.js Server (HTTP)
│   ├── API Routes ── /api/graph, /api/docs, /api/changes, /api/index
│   └── Web UI ── React Flow graph, TipTap doc editor, Change queue
├── Core Engine
│   ├── SQLite (better-sqlite3) ── persistent storage
│   ├── Graphology ── in-memory graph traversal
│   ├── Indexer ── scanner + import resolver + pattern matchers
│   ├── Doc Generator ── auto-generates markdown per module
│   └── File Watcher (chokidar) ── incremental updates
└── MCP Server (stdio) ── 12 tools for coding agents
```

### Knowledge Graph Schema

**Node Types:** `project`, `module`, `entry`, `api`, `route`, `schema`, `config`, `external`

**Edge Types:** `contains`, `imports`, `calls`, `exposes`, `consumes`, `renders`, `uses_schema`, `depends_on`, `data_flows`, `configured_by`

### Storage

- **SQLite** for durable persistence (stored in `.osssync/osssync.db` inside the indexed project)
- **Graphology** for fast in-memory graph algorithms (BFS, impact analysis, path finding)
- Both stay in sync — writes go to both, reads come from memory

---

## Pattern Matchers

ossDevSync detects and indexes:

| Pattern | Creates |
|---------|---------|
| Express/Fastify routes | `api` nodes with method + path |
| Next.js API routes | `api` nodes (auto-detected from file conventions) |
| Prisma models | `schema` nodes with fields and relations |
| Zod schemas | `schema` nodes linked to modules |
| package.json / tsconfig.json | `config` nodes |

Adding new matchers is straightforward — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js (App Router) |
| Graph Visualization | React Flow (`@xyflow/react`) |
| Rich Text Editor | TipTap |
| State Management | Zustand |
| Database | SQLite (`better-sqlite3`) |
| Graph Library | Graphology |
| MCP Server | `@modelcontextprotocol/sdk` |
| File Watching | Chokidar |
| Styling | Tailwind CSS |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities.

## License

MIT - see [LICENSE](LICENSE) for details.
