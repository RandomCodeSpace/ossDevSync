import Graph from 'graphology';
import { getAllNodes, getAllEdges, insertNode, insertEdge, deleteNode, deleteEdge, clearGraph as clearDbGraph, getActiveProjectPath } from './db';
import type { GraphNode, GraphEdge, NodeType, EdgeType } from '../types';
import { v4 as uuidv4 } from 'uuid';

let graph: Graph | null = null;
let graphProjectPath: string | null = null;

export function getGraph(): Graph {
  const currentProject = getActiveProjectPath();
  if (graph && graphProjectPath === currentProject) return graph;

  // Project changed or first load — rebuild
  graph = new Graph({ multi: true, type: 'directed' });
  graphProjectPath = currentProject;
  try {
    loadFromDb();
  } catch {
    graph = null;
    graphProjectPath = null;
    throw new Error('Failed to load graph from database. Is the DB initialized?');
  }
  return graph;
}

function loadFromDb(): void {
  if (!graph) return;

  const nodes = getAllNodes();
  const edges = getAllEdges();

  for (const node of nodes) {
    graph.addNode(node.id, {
      type: node.type,
      name: node.name,
      path: node.path,
      properties: node.properties,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    });
  }

  for (const edge of edges) {
    if (graph.hasNode(edge.sourceId) && graph.hasNode(edge.targetId)) {
      graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
        type: edge.type,
        properties: edge.properties,
        weight: edge.weight,
      });
    }
  }
}

export function addNode(type: NodeType, name: string, path?: string, properties: Record<string, unknown> = {}): GraphNode {
  const g = getGraph();
  const now = Date.now();
  const id = `${type}_${uuidv4().slice(0, 8)}`;

  const node: GraphNode = {
    id,
    type,
    name,
    path,
    properties,
    createdAt: now,
    updatedAt: now,
  };

  g.addNode(id, {
    type: node.type,
    name: node.name,
    path: node.path,
    properties: node.properties,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  });

  insertNode(node);
  return node;
}

export function addEdgeBetween(sourceId: string, targetId: string, type: EdgeType, properties: Record<string, unknown> = {}, weight = 1.0): GraphEdge {
  const g = getGraph();
  const id = `${type}_${uuidv4().slice(0, 8)}`;

  const edge: GraphEdge = {
    id,
    sourceId,
    targetId,
    type,
    properties,
    weight,
  };

  g.addEdgeWithKey(id, sourceId, targetId, {
    type: edge.type,
    properties: edge.properties,
    weight: edge.weight,
  });

  insertEdge(edge);
  return edge;
}

export function removeNode(id: string): void {
  const g = getGraph();
  if (g.hasNode(id)) {
    g.dropNode(id); // also drops connected edges in graphology
  }
  deleteNode(id);
}

export function removeEdge(id: string): void {
  const g = getGraph();
  if (g.hasEdge(id)) {
    g.dropEdge(id);
  }
  deleteEdge(id);
}

export function getNodeData(id: string): GraphNode | undefined {
  const g = getGraph();
  if (!g.hasNode(id)) return undefined;
  const attrs = g.getNodeAttributes(id);
  return {
    id,
    type: attrs.type,
    name: attrs.name,
    path: attrs.path,
    properties: attrs.properties,
    createdAt: attrs.createdAt,
    updatedAt: attrs.updatedAt,
  };
}

export function getNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): GraphNode[] {
  const g = getGraph();
  if (!g.hasNode(nodeId)) return [];

  let neighborIds: string[];
  switch (direction) {
    case 'in':
      neighborIds = g.inNeighbors(nodeId);
      break;
    case 'out':
      neighborIds = g.outNeighbors(nodeId);
      break;
    default:
      neighborIds = g.neighbors(nodeId);
  }

  return neighborIds.map(id => getNodeData(id)).filter((n): n is GraphNode => n !== undefined);
}

export function getNodeEdges(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): GraphEdge[] {
  const g = getGraph();
  if (!g.hasNode(nodeId)) return [];

  let edgeIds: string[];
  switch (direction) {
    case 'in':
      edgeIds = g.inEdges(nodeId);
      break;
    case 'out':
      edgeIds = g.outEdges(nodeId);
      break;
    default:
      edgeIds = g.edges(nodeId);
  }

  return edgeIds.map(id => {
    const attrs = g.getEdgeAttributes(id);
    return {
      id,
      sourceId: g.source(id),
      targetId: g.target(id),
      type: attrs.type,
      properties: attrs.properties,
      weight: attrs.weight,
    };
  });
}

export function findPath(fromId: string, toId: string): string[] | null {
  const g = getGraph();
  if (!g.hasNode(fromId) || !g.hasNode(toId)) return null;

  // BFS
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [fromId];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) {
      const path: string[] = [];
      let node = toId;
      while (node !== fromId) {
        path.unshift(node);
        node = parent.get(node)!;
      }
      path.unshift(fromId);
      return path;
    }

    for (const neighbor of g.outNeighbors(current)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

export function getImpact(moduleId: string): { affected: GraphNode[]; depth: Map<string, number> } {
  const g = getGraph();
  if (!g.hasNode(moduleId)) return { affected: [], depth: new Map() };

  // BFS to find all dependents (nodes that import/consume this module)
  const visited = new Set<string>();
  const depthMap = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: moduleId, depth: 0 }];
  visited.add(moduleId);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    depthMap.set(id, depth);

    // Find nodes that depend on this node (in-edges)
    for (const edgeId of g.inEdges(id)) {
      const attrs = g.getEdgeAttributes(edgeId);
      if (['imports', 'consumes', 'depends_on', 'data_flows'].includes(attrs.type)) {
        const source = g.source(edgeId);
        if (!visited.has(source)) {
          visited.add(source);
          queue.push({ id: source, depth: depth + 1 });
        }
      }
    }
  }

  visited.delete(moduleId);
  const affected = Array.from(visited).map(id => getNodeData(id)).filter((n): n is GraphNode => n !== undefined);

  return { affected, depth: depthMap };
}

export function exportGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const g = getGraph();

  const nodes: GraphNode[] = [];
  g.forEachNode((id, attrs) => {
    nodes.push({
      id,
      type: attrs.type,
      name: attrs.name,
      path: attrs.path,
      properties: attrs.properties,
      createdAt: attrs.createdAt,
      updatedAt: attrs.updatedAt,
    });
  });

  const edges: GraphEdge[] = [];
  g.forEachEdge((id, attrs, source, target) => {
    edges.push({
      id,
      sourceId: source,
      targetId: target,
      type: attrs.type,
      properties: attrs.properties,
      weight: attrs.weight,
    });
  });

  return { nodes, edges };
}

export function clearAll(): void {
  if (graph) {
    graph.clear();
  }
  graphProjectPath = null;
  clearDbGraph();
}

export function getStats(): { nodeCount: number; edgeCount: number; nodesByType: Record<string, number> } {
  const g = getGraph();
  const nodesByType: Record<string, number> = {};

  g.forEachNode((_id, attrs) => {
    nodesByType[attrs.type] = (nodesByType[attrs.type] || 0) + 1;
  });

  return {
    nodeCount: g.order,
    edgeCount: g.size,
    nodesByType,
  };
}
