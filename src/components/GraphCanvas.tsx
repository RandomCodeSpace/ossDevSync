'use client';

import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type NodeMouseHandler,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../stores/graph-store';
import { useUIStore } from '../stores/ui-store';
import { useChangesStore } from '../stores/changes-store';

const NODE_COLORS: Record<string, string> = {
  project: '#6366f1',
  module: '#3b82f6',
  entry: '#8b5cf6',
  api: '#10b981',
  route: '#f59e0b',
  schema: '#ec4899',
  config: '#6b7280',
  external: '#94a3b8',
};

function FlowCanvas() {
  const { canvasNodes, canvasEdges, isLoading } = useGraphStore();
  const { selectNode, selectedNodeId } = useUIStore();
  const { addChange } = useChangesStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  useEffect(() => {
    const styledNodes = canvasNodes.map((n) => ({
      ...n,
      style: {
        background: NODE_COLORS[n.data.nodeType] || '#3b82f6',
        color: '#fff',
        border: n.id === selectedNodeId ? '3px solid #facc15' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '13px',
        fontWeight: 500,
        minWidth: '120px',
        textAlign: 'center' as const,
      },
    }));
    setNodes(styledNodes);
  }, [canvasNodes, selectedNodeId, setNodes]);

  useEffect(() => {
    const styledEdges = canvasEdges.map((e) => ({
      ...e,
      style: { stroke: '#64748b', strokeWidth: 1.5 },
      animated: e.data?.edgeType === 'data_flows',
      label: e.data?.label,
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
    }));
    setEdges(styledEdges);
  }, [canvasEdges, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, style: { stroke: '#64748b' } }, eds));
      // Create a change spec for the new dependency
      if (params.source && params.target) {
        addChange(
          'add_dependency',
          `Add dependency from ${params.source} to ${params.target}`,
          { moduleId: params.source },
          { moduleId: params.target }
        );
      }
    },
    [setEdges, addChange]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Could create a move_module change spec if the node was dragged to a new group
      // For now, just update the visual position
    },
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-gray-400 text-lg">Indexing project...</div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">No graph data yet</p>
          <p className="text-gray-500 text-sm">Index a project to visualize its architecture</p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onNodeDragStop={onNodeDragStop}
      fitView
      className="bg-gray-950"
    >
      <Controls className="!bg-gray-800 !border-gray-700 !rounded-lg [&_button]:!bg-gray-800 [&_button]:!border-gray-700 [&_button]:!text-gray-300" />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
      <MiniMap
        nodeColor={(n) => NODE_COLORS[n.data?.nodeType as string] || '#3b82f6'}
        className="!bg-gray-900 !border-gray-700 !rounded-lg"
      />
    </ReactFlow>
  );
}

export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
