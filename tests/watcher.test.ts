import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osssync-watcher-test-'));

before(async () => {
  process.env.OSSSYNC_DB_DIR = tmpDir;
  const { initDb } = await import('../src/core/db');
  await initDb(tmpDir);
});

after(async () => {
  const { stopWatching } = await import('../src/core/watcher');
  const { closeDb } = await import('../src/core/db');
  stopWatching();
  closeDb();
  delete process.env.OSSSYNC_DB_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Watcher', () => {
  it('isWatching returns false before starting', async () => {
    const { isWatching } = await import('../src/core/watcher');
    assert.strictEqual(isWatching(), false);
  });

  it('startWatching sets isWatching to true', async () => {
    const { startWatching, isWatching, stopWatching } = await import('../src/core/watcher');
    startWatching(tmpDir);
    assert.strictEqual(isWatching(), true);
    stopWatching();
  });

  it('stopWatching sets isWatching to false', async () => {
    const { startWatching, isWatching, stopWatching } = await import('../src/core/watcher');
    startWatching(tmpDir);
    stopWatching();
    assert.strictEqual(isWatching(), false);
  });

  it('stopWatching when not watching does not throw', async () => {
    const { stopWatching, isWatching } = await import('../src/core/watcher');
    assert.strictEqual(isWatching(), false);
    assert.doesNotThrow(() => stopWatching());
  });

  it('calling startWatching twice replaces watcher', async () => {
    const { startWatching, isWatching, stopWatching } = await import('../src/core/watcher');
    let callCount = 0;
    const cb1 = () => { callCount++; };

    startWatching(tmpDir, cb1);
    assert.strictEqual(isWatching(), true);

    // Calling again should stop old watcher and create new one
    startWatching(tmpDir);
    assert.strictEqual(isWatching(), true);

    stopWatching();
    assert.strictEqual(isWatching(), false);
  });
});
