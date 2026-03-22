import Database from 'better-sqlite3';
import path from 'path';
import type { GraphNode, GraphEdge, DocEntry, ChangeSpec } from '../types';

let db: Database.Database | null = null;

export function getDb(projectPath?: string): Database.Database {
  if (db) return db;

  const dbPath = projectPath
    ? path.join(projectPath, '.osssync', 'osssync.db')
    : path.join(process.cwd(), '.osssync', 'osssync.db');

  // Ensure directory exists
  const fs = require('fs');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT,
      properties TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      weight REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS docs (
      module_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      generated_at INTEGER NOT NULL,
      edited_at INTEGER,
      is_manually_edited INTEGER DEFAULT 0
    );

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
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_path ON nodes(path);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
    CREATE INDEX IF NOT EXISTS idx_change_specs_status ON change_specs(status);
  `);
}

// Node operations
export function insertNode(node: GraphNode): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO nodes (id, type, name, path, properties, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(node.id, node.type, node.name, node.path ?? null, JSON.stringify(node.properties), node.createdAt, node.updatedAt);
}

export function getNode(id: string): GraphNode | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
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
  const db = getDb();
  const rows = db.prepare('SELECT * FROM nodes').all() as any[];
  return rows.map(row => ({
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
  const db = getDb();
  db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
}

// Edge operations
export function insertEdge(edge: GraphEdge): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO edges (id, source_id, target_id, type, properties, weight)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(edge.id, edge.sourceId, edge.targetId, edge.type, JSON.stringify(edge.properties), edge.weight);
}

export function getEdge(id: string): GraphEdge | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as any;
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
  const db = getDb();
  const rows = db.prepare('SELECT * FROM edges').all() as any[];
  return rows.map(row => ({
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    type: row.type,
    properties: JSON.parse(row.properties),
    weight: row.weight,
  }));
}

export function deleteEdge(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM edges WHERE id = ?').run(id);
}

export function getEdgesForNode(nodeId: string): GraphEdge[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM edges WHERE source_id = ? OR target_id = ?').all(nodeId, nodeId) as any[];
  return rows.map(row => ({
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
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO docs (module_id, content, generated_at, edited_at, is_manually_edited)
    VALUES (?, ?, ?, ?, ?)
  `).run(doc.moduleId, doc.content, doc.generatedAt, doc.editedAt ?? null, doc.isManuallyEdited ? 1 : 0);
}

export function getDoc(moduleId: string): DocEntry | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM docs WHERE module_id = ?').get(moduleId) as any;
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
  const db = getDb();
  const rows = db.prepare('SELECT * FROM docs').all() as any[];
  return rows.map(row => ({
    moduleId: row.module_id,
    content: row.content,
    generatedAt: row.generated_at,
    editedAt: row.edited_at,
    isManuallyEdited: !!row.is_manually_edited,
  }));
}

// Change spec operations
export function insertChangeSpec(spec: ChangeSpec): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO change_specs (id, type, action, description, source, target, affected_modules, impact, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    spec.id, spec.type, spec.action, spec.description,
    JSON.stringify(spec.source), JSON.stringify(spec.target),
    JSON.stringify(spec.affectedModules), JSON.stringify(spec.impact),
    spec.status, spec.createdAt, spec.updatedAt ?? null
  );
}

export function getChangeSpec(id: string): ChangeSpec | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM change_specs WHERE id = ?').get(id) as any;
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
  const db = getDb();
  const rows = db.prepare("SELECT * FROM change_specs WHERE status = 'pending_approval' ORDER BY created_at DESC").all() as any[];
  return rows.map(row => ({
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
  const db = getDb();
  db.prepare('UPDATE change_specs SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, new Date().toISOString(), id);
}

// Clear all data (for re-indexing)
export function clearGraph(): void {
  const db = getDb();
  db.pragma('foreign_keys = OFF');
  db.exec('DELETE FROM docs; DELETE FROM change_specs; DELETE FROM edges; DELETE FROM nodes;');
  db.pragma('foreign_keys = ON');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
