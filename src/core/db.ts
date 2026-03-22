import fs from 'fs';
import path from 'path';
import os from 'os';

// Dynamic require hidden from Turbopack's static analysis
// eslint-disable-next-line no-eval
const _sqljs = 'sql.js';
const initSqlJs: any = eval('require')(_sqljs);

// sql.js Database type — use any since the dynamic require loses types
type SqlJsDatabase = any;
import type { GraphNode, GraphEdge, DocEntry, ChangeSpec } from '../types';

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;
let activeProjectPath: string | null = null;

export function getDb(): SqlJsDatabase {
  if (db) return db;
  throw new Error('Database not initialized. Call initDb() first.');
}

export function getActiveProjectPath(): string | null {
  return activeProjectPath;
}

export function setActiveProjectPath(p: string): void {
  activeProjectPath = p;
}

function requireActiveProject(): string {
  if (!activeProjectPath) throw new Error('No active project. Call initDb(projectPath) or ensureDb(projectPath) first.');
  return activeProjectPath;
}

export async function ensureDb(projectPath?: string): Promise<SqlJsDatabase> {
  if (db) {
    if (projectPath) activeProjectPath = projectPath;
    return db;
  }
  if (initPromise) {
    const result = await initPromise;
    if (projectPath) activeProjectPath = projectPath;
    return result;
  }
  initPromise = initDb(projectPath);
  return initPromise;
}

export async function initDb(projectPath?: string): Promise<SqlJsDatabase> {
  // Set active project
  activeProjectPath = projectPath ?? process.cwd();

  // If DB already open, just switch project
  if (db) return db;

  // Fixed DB location: ~/ossSync/ossSync.db (or OSSSYNC_DB_DIR env var for tests)
  const dbDir = process.env.OSSSYNC_DB_DIR || path.join(os.homedir(), 'ossSync');
  fs.mkdirSync(dbDir, { recursive: true });
  dbPath = path.join(dbDir, 'ossSync.db');

  // Load WASM binary directly to avoid path resolution issues with bundlers
  const wasmPaths = [
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];

  let wasmBinary: ArrayBuffer | undefined;
  for (const wp of wasmPaths) {
    try {
      if (fs.existsSync(wp)) {
        const buf = fs.readFileSync(wp);
        wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        break;
      }
    } catch { /* try next */ }
  }

  const SQL = await initSqlJs({
    ...(wasmBinary ? { wasmBinary } : {}),
  });

  // Load existing DB if it exists
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initSchema(db);
  saveDb();
  return db;
}

function initSchema(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT,
      properties TEXT DEFAULT '{}',
      project_path TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      weight REAL DEFAULT 1.0,
      project_path TEXT NOT NULL DEFAULT ''
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS docs (
      module_id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      generated_at INTEGER NOT NULL,
      edited_at INTEGER,
      is_manually_edited INTEGER DEFAULT 0,
      project_path TEXT NOT NULL DEFAULT ''
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS change_specs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT DEFAULT '{}',
      target TEXT DEFAULT '{}',
      affected_modules TEXT DEFAULT '[]',
      impact TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending_approval',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      project_path TEXT NOT NULL DEFAULT ''
    )
  `);

  // Migration: add project_path column if missing (for existing DBs)
  for (const table of ['nodes', 'edges', 'docs', 'change_specs']) {
    try {
      const columns = database.exec(`PRAGMA table_info(${table})`);
      if (columns.length > 0) {
        const colNames = columns[0].values.map((row: any[]) => row[1]);
        if (!colNames.includes('project_path')) {
          database.run(`ALTER TABLE ${table} ADD COLUMN project_path TEXT NOT NULL DEFAULT ''`);
        }
      }
    } catch { /* table may not exist yet */ }
  }

  // Indexes
  database.run('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)');
  database.run('CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path)');
  database.run('CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_path)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_path)');
  database.run('CREATE INDEX IF NOT EXISTS idx_change_specs_status ON change_specs(status)');
  database.run('CREATE INDEX IF NOT EXISTS idx_change_specs_project ON change_specs(project_path)');
  database.run('CREATE INDEX IF NOT EXISTS idx_docs_project ON docs(project_path)');
}

function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

// Helper to run a query and get results as objects
function queryAll(sql: string, params: any[] = []): any[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const results = queryAll(sql, params);
  return results[0];
}

function execute(sql: string, params: any[] = []): void {
  const database = getDb();
  database.run(sql, params);
  saveDb();
}

// Node operations
export function insertNode(node: GraphNode): void {
  const pp = requireActiveProject();
  execute(
    `INSERT OR REPLACE INTO nodes (id, type, name, path, properties, project_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [node.id, node.type, node.name, node.path ?? null, JSON.stringify(node.properties), pp, node.createdAt, node.updatedAt]
  );
}

export function getNode(id: string): GraphNode | undefined {
  const pp = requireActiveProject();
  const row = queryOne('SELECT * FROM nodes WHERE id = ? AND project_path = ?', [id, pp]);
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    path: row.path,
    properties: JSON.parse(row.properties),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllNodes(): GraphNode[] {
  const pp = requireActiveProject();
  return queryAll('SELECT * FROM nodes WHERE project_path = ?', [pp]).map(row => ({
    id: row.id,
    type: row.type,
    name: row.name,
    path: row.path,
    properties: JSON.parse(row.properties),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function deleteNode(id: string): void {
  const pp = requireActiveProject();
  execute('DELETE FROM nodes WHERE id = ? AND project_path = ?', [id, pp]);
}

// Edge operations
export function insertEdge(edge: GraphEdge): void {
  const pp = requireActiveProject();
  execute(
    `INSERT OR REPLACE INTO edges (id, source_id, target_id, type, properties, weight, project_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [edge.id, edge.sourceId, edge.targetId, edge.type, JSON.stringify(edge.properties), edge.weight, pp]
  );
}

export function getEdge(id: string): GraphEdge | undefined {
  const pp = requireActiveProject();
  const row = queryOne('SELECT * FROM edges WHERE id = ? AND project_path = ?', [id, pp]);
  if (!row) return undefined;
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
  };
}

export function getAllEdges(): GraphEdge[] {
  const pp = requireActiveProject();
  return queryAll('SELECT * FROM edges WHERE project_path = ?', [pp]).map(row => ({
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
  }));
}

export function deleteEdge(id: string): void {
  const pp = requireActiveProject();
  execute('DELETE FROM edges WHERE id = ? AND project_path = ?', [id, pp]);
}

export function getEdgesForNode(nodeId: string): GraphEdge[] {
  const pp = requireActiveProject();
  return queryAll('SELECT * FROM edges WHERE (source_id = ? OR target_id = ?) AND project_path = ?', [nodeId, nodeId, pp]).map(row => ({
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
  }));
}

// Doc operations
export function upsertDoc(doc: DocEntry): void {
  const pp = requireActiveProject();
  execute(
    `INSERT OR REPLACE INTO docs (module_id, content, generated_at, edited_at, is_manually_edited, project_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [doc.moduleId, doc.content, doc.generatedAt, doc.editedAt ?? null, doc.isManuallyEdited ? 1 : 0, pp]
  );
}

export function getDoc(moduleId: string): DocEntry | undefined {
  const pp = requireActiveProject();
  const row = queryOne('SELECT * FROM docs WHERE module_id = ? AND project_path = ?', [moduleId, pp]);
  if (!row) return undefined;
  return {
    moduleId: row.module_id,
    content: row.content,
    generatedAt: row.generated_at,
    editedAt: row.edited_at,
    isManuallyEdited: !!row.is_manually_edited,
  };
}

export function getAllDocs(): DocEntry[] {
  const pp = requireActiveProject();
  return queryAll('SELECT * FROM docs WHERE project_path = ?', [pp]).map(row => ({
    moduleId: row.module_id,
    content: row.content,
    generatedAt: row.generated_at,
    editedAt: row.edited_at,
    isManuallyEdited: !!row.is_manually_edited,
  }));
}

// Change spec operations
export function insertChangeSpec(spec: ChangeSpec): void {
  const pp = requireActiveProject();
  execute(
    `INSERT OR REPLACE INTO change_specs (id, type, action, description, source, target, affected_modules, impact, status, created_at, updated_at, project_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.id, spec.type, spec.action, spec.description,
      JSON.stringify(spec.source), JSON.stringify(spec.target),
      JSON.stringify(spec.affectedModules), JSON.stringify(spec.impact),
      spec.status, spec.createdAt, spec.updatedAt ?? null, pp
    ]
  );
}

export function getChangeSpec(id: string): ChangeSpec | undefined {
  const pp = requireActiveProject();
  const row = queryOne('SELECT * FROM change_specs WHERE id = ? AND project_path = ?', [id, pp]);
  if (!row) return undefined;
  return {
    id: row.id,
    type: row.type,
    action: row.action,
    description: row.description,
    source: JSON.parse(row.source),
    target: JSON.parse(row.target),
    affectedModules: JSON.parse(row.affected_modules),
    impact: JSON.parse(row.impact),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getPendingChangeSpecs(): ChangeSpec[] {
  const pp = requireActiveProject();
  return queryAll("SELECT * FROM change_specs WHERE status = 'pending_approval' AND project_path = ? ORDER BY created_at DESC", [pp]).map(row => ({
    id: row.id,
    type: row.type,
    action: row.action,
    description: row.description,
    source: JSON.parse(row.source),
    target: JSON.parse(row.target),
    affectedModules: JSON.parse(row.affected_modules),
    impact: JSON.parse(row.impact),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateChangeSpecStatus(id: string, status: ChangeSpec['status']): void {
  const pp = requireActiveProject();
  execute('UPDATE change_specs SET status = ?, updated_at = ? WHERE id = ? AND project_path = ?',
    [status, new Date().toISOString(), id, pp]);
}

// Clear all data for the active project (for re-indexing)
export function clearGraph(): void {
  const pp = requireActiveProject();
  const database = getDb();
  database.run('DELETE FROM docs WHERE is_manually_edited = 0 AND project_path = ?', [pp]);
  database.run("DELETE FROM change_specs WHERE status IN ('completed', 'rejected') AND project_path = ?", [pp]);
  database.run('DELETE FROM edges WHERE project_path = ?', [pp]);
  database.run('DELETE FROM nodes WHERE project_path = ?', [pp]);
  saveDb();
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbPath = null;
    initPromise = null;
    activeProjectPath = null;
  }
}
