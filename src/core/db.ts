import initSqlJs from 'sql.js';

// sql.js types: Database is a top-level declared class
type SqlJsDatabase = InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>;
import fs from 'fs';
import path from 'path';
import type { GraphNode, GraphEdge, DocEntry, ChangeSpec } from '../types';

let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;
let initPromise: Promise<SqlJsDatabase> | null = null;

export function getDb(): SqlJsDatabase {
  if (db) return db;
  throw new Error('Database not initialized. Call initDb() first.');
}

export async function ensureDb(projectPath?: string): Promise<SqlJsDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = initDb(projectPath);
  return initPromise;
}

export async function initDb(projectPath?: string): Promise<SqlJsDatabase> {
  if (db) return db;

  const dir = projectPath
    ? path.join(projectPath, '.osssync')
    : path.join(process.cwd(), '.osssync');

  fs.mkdirSync(dir, { recursive: true });
  dbPath = path.join(dir, 'osssync.db');

  const SQL = await initSqlJs();

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
      weight REAL DEFAULT 1.0
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS docs (
      module_id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      generated_at INTEGER NOT NULL,
      edited_at INTEGER,
      is_manually_edited INTEGER DEFAULT 0
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
      updated_at TEXT
    )
  `);
  database.run('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)');
  database.run('CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)');
  database.run('CREATE INDEX IF NOT EXISTS idx_change_specs_status ON change_specs(status)');
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
  execute(
    `INSERT OR REPLACE INTO nodes (id, type, name, path, properties, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [node.id, node.type, node.name, node.path ?? null, JSON.stringify(node.properties), node.createdAt, node.updatedAt]
  );
}

export function getNode(id: string): GraphNode | undefined {
  const row = queryOne('SELECT * FROM nodes WHERE id = ?', [id]);
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
  return queryAll('SELECT * FROM nodes').map(row => ({
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
  execute('DELETE FROM nodes WHERE id = ?', [id]);
}

// Edge operations
export function insertEdge(edge: GraphEdge): void {
  execute(
    `INSERT OR REPLACE INTO edges (id, source_id, target_id, type, properties, weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [edge.id, edge.sourceId, edge.targetId, edge.type, JSON.stringify(edge.properties), edge.weight]
  );
}

export function getEdge(id: string): GraphEdge | undefined {
  const row = queryOne('SELECT * FROM edges WHERE id = ?', [id]);
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
  return queryAll('SELECT * FROM edges').map(row => ({
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
  }));
}

export function deleteEdge(id: string): void {
  execute('DELETE FROM edges WHERE id = ?', [id]);
}

export function getEdgesForNode(nodeId: string): GraphEdge[] {
  return queryAll('SELECT * FROM edges WHERE source_id = ? OR target_id = ?', [nodeId, nodeId]).map(row => ({
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
  execute(
    `INSERT OR REPLACE INTO docs (module_id, content, generated_at, edited_at, is_manually_edited)
     VALUES (?, ?, ?, ?, ?)`,
    [doc.moduleId, doc.content, doc.generatedAt, doc.editedAt ?? null, doc.isManuallyEdited ? 1 : 0]
  );
}

export function getDoc(moduleId: string): DocEntry | undefined {
  const row = queryOne('SELECT * FROM docs WHERE module_id = ?', [moduleId]);
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
  return queryAll('SELECT * FROM docs').map(row => ({
    moduleId: row.module_id,
    content: row.content,
    generatedAt: row.generated_at,
    editedAt: row.edited_at,
    isManuallyEdited: !!row.is_manually_edited,
  }));
}

// Change spec operations
export function insertChangeSpec(spec: ChangeSpec): void {
  execute(
    `INSERT OR REPLACE INTO change_specs (id, type, action, description, source, target, affected_modules, impact, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.id, spec.type, spec.action, spec.description,
      JSON.stringify(spec.source), JSON.stringify(spec.target),
      JSON.stringify(spec.affectedModules), JSON.stringify(spec.impact),
      spec.status, spec.createdAt, spec.updatedAt ?? null
    ]
  );
}

export function getChangeSpec(id: string): ChangeSpec | undefined {
  const row = queryOne('SELECT * FROM change_specs WHERE id = ?', [id]);
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
  return queryAll("SELECT * FROM change_specs WHERE status = 'pending_approval' ORDER BY created_at DESC").map(row => ({
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
  execute('UPDATE change_specs SET status = ?, updated_at = ? WHERE id = ?',
    [status, new Date().toISOString(), id]);
}

// Clear all data (for re-indexing)
export function clearGraph(): void {
  const database = getDb();
  database.run('DELETE FROM docs');
  database.run('DELETE FROM change_specs');
  database.run('DELETE FROM edges');
  database.run('DELETE FROM nodes');
  saveDb();
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
    dbPath = null;
  }
}
