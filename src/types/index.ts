// Node types in the knowledge graph
export type NodeType = 'project' | 'module' | 'entry' | 'api' | 'route' | 'schema' | 'config' | 'external';

// Edge types
export type EdgeType = 'contains' | 'imports' | 'calls' | 'exposes' | 'consumes' | 'renders' | 'uses_schema' | 'depends_on' | 'data_flows' | 'configured_by';

// Change spec action types
export type ChangeAction = 'move_module' | 'split_module' | 'merge_modules' | 'add_dependency' | 'remove_dependency' | 'update_docs' | 'rename_module' | 'update_api' | 'update_schema';

export type ChangeStatus = 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected';

// Core graph node
export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  path?: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// Core graph edge
export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  properties: Record<string, unknown>;
  weight: number;
}

// Change spec
export interface ChangeSpec {
  id: string;
  type: string;
  action: ChangeAction;
  description: string;
  source: { moduleId?: string; path?: string };
  target: { moduleId?: string; path?: string };
  affectedModules: string[];
  impact: { filesAffected: number; importsToUpdate: number };
  status: ChangeStatus;
  createdAt: string;
  updatedAt?: string;
}

// Documentation entry
export interface DocEntry {
  moduleId: string;
  content: string;
  generatedAt: number;
  editedAt?: number;
  isManuallyEdited: boolean;
}

// API for the graph canvas UI
export interface GraphCanvasNode {
  id: string;
  type: string;
  data: {
    label: string;
    nodeType: NodeType;
    path?: string;
    properties: Record<string, unknown>;
  };
  position: { x: number; y: number };
}

export interface GraphCanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: {
    edgeType: EdgeType;
    label?: string;
  };
}
