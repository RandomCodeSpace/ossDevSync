import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

async function main() {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`\n  ossSync running at http://localhost:${port}\n`);
    console.log(`  Web UI:  http://localhost:${port}`);
    console.log(`  API:     http://localhost:${port}/api\n`);
  });

  // Start MCP server on stdio if --mcp flag is passed
  if (process.argv.includes('--mcp')) {
    const { startMcpServer } = await import('./src/mcp/server');
    await startMcpServer();
    console.log('  MCP server started on stdio\n');
  }
}

main().catch((err) => {
  console.error('Failed to start ossSync:', err);
  process.exit(1);
});
