# Contributing to ossDevSync

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/RandomCodeSpace/ossDevSync.git
cd ossDevSync
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the web UI.

## Project Structure

```
src/
  app/           Next.js App Router (pages + API routes)
  components/    React components (GraphCanvas, Sidebar, DocEditor, etc.)
  stores/        Zustand state management
  core/          Core engine (db, graph, indexer, watcher, doc-generator)
  indexer/       Codebase parsing (scanner, import resolver, pattern matchers)
  mcp/           MCP server and tools
  changes/       Change spec engine (spec, queue, impact analysis)
  types/         Shared TypeScript types
  api/           Frontend API client
```

## Development Workflow

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `npx tsc --noEmit` to verify types
4. Run `npm run build` to verify the build
5. Open a pull request

## Adding a New Pattern Matcher

To detect a new framework or tool (e.g., tRPC, Drizzle):

1. Create `src/indexer/pattern-matchers/your-matcher.ts`
2. Export a function that scans the graph and creates nodes/edges
3. Register it in `src/core/indexer.ts`

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Prefer composition over inheritance
- Keep files focused — one responsibility per file

## Reporting Issues

Use [GitHub Issues](https://github.com/RandomCodeSpace/ossDevSync/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
