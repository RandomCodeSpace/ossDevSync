import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import { indexProject } from './indexer';
import { generateDocs } from './doc-generator';

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let onChangeCallback: (() => void) | null = null;

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/.osssync/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
];

export function startWatching(projectPath: string, onChange?: () => void): void {
  if (watcher) {
    stopWatching();
  }

  onChangeCallback = onChange ?? null;

  watcher = chokidar.watch(projectPath, {
    ignored: IGNORE_PATTERNS,
    persistent: true,
    ignoreInitial: true,
    depth: 10,
  });

  watcher.on('all', (_event, filePath) => {
    // Debounce re-indexing
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      try {
        await indexProject(projectPath, true);
        generateDocs();
        onChangeCallback?.();
      } catch (err) {
        console.error('Error re-indexing after file change:', err);
      }
    }, 1000);
  });
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  onChangeCallback = null;
}

export function isWatching(): boolean {
  return watcher !== null;
}
