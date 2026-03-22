import { create } from 'zustand';
import type { GraphNode, GraphEdge, NodeType, GraphCanvasNode, GraphCanvasEdge } from '../types';
import { fetchGraph, triggerIndex, fetchStats } from '../api/client';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  canvasNodes: GraphCanvasNode[];
  canvasEdges: GraphCanvasEdge[];
  stats: { nodeCount: number; edgeCount: number; nodesByType: Record<string, number> } | null;
  isLoading: boolean;
  error: string | null;
  projectPath: string | null;

  loadGraph: () => Promise<void>;
  indexProject: (path: string) => Promise<void>;
  setProjectPath: (path: string) => void;
}

// Auto-layout: position nodes in a grid grouped by type
function layoutNodes(nodes: GraphNode[]): GraphCanvasNode[] {
  const typeGroups: Record<string, GraphNode[]> = {};
  for (const node of nodes) {
    if (!typeGroups[node.type]) typeGroups[node.type] = [];
    typeGroups[node.type].push(node);
  }

  const canvasNodes: GraphCanvasNode[] = [];
  let groupY = 0;

  const typeOrder: NodeType[] = ['project', 'module', 'api', 'schema', 'config', 'entry', 'route', 'external'];

  for (const type of typeOrder) {
    const group = typeGroups[type];
    if (!group) continue;

    for (let i = 0; i < group.length; i++) {
      const node = group[i];
      canvasNodes.push({
        id: node.id,
        type: 'default',
        data: {
          label: node.name,
          nodeType: node.type,
          path: node.path,
          properties: node.properties,
        },
        position: {
          x: 100 + (i % 4) * 250,
          y: groupY + Math.floor(i / 4) * 120,
        },
      });
    }

    groupY += Math.ceil(group.length / 4) * 120 + 80;
  }

  return canvasNodes;
}

function toCanvasEdges(edges: GraphEdge[]): GraphCanvasEdge[] {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'default',
    data: {
      edgeType: edge.type,
      label: edge.type,
    },
  }));
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  canvasNodes: [],
  canvasEdges: [],
  stats: null,
  isLoading: false,
  error: null,
  projectPath: null,

  setProjectPath: (path: string) => set({ projectPath: path }),

  loadGraph: async () => {
    set({ isLoading: true, error: null });
    try {
      const projectPath = get().projectPath || undefined;
      const { nodes, edges } = await fetchGraph(projectPath);
      const stats = await fetchStats(projectPath);
      set({
        nodes,
        edges,
        canvasNodes: layoutNodes(nodes),
        canvasEdges: toCanvasEdges(edges),
        stats,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  indexProject: async (path: string) => {
    set({ isLoading: true, error: null, projectPath: path });
    try {
      await triggerIndex(path);
      await get().loadGraph();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
}));
