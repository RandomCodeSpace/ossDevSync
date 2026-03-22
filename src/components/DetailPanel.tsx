'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/ui-store';
import { useGraphStore } from '../stores/graph-store';
import { fetchNodeDetails } from '../api/client';
import type { GraphNode, GraphEdge } from '../types';

export default function DetailPanel() {
  const { selectedNodeId, activePanel, setPanel } = useUIStore();
  const { nodes } = useGraphStore();
  const [nodeDetails, setNodeDetails] = useState<{ node: GraphNode; edges: GraphEdge[] } | null>(null);

  useEffect(() => {
    if (!selectedNodeId) {
      setNodeDetails(null);
      return;
    }
    fetchNodeDetails(selectedNodeId)
      .then(setNodeDetails)
      .catch(() => setNodeDetails(null));
  }, [selectedNodeId]);

  if (activePanel !== 'detail' || !selectedNodeId || !nodeDetails) return null;

  const { node, edges } = nodeDetails;
  const inEdges = edges.filter((e) => e.targetId === node.id);
  const outEdges = edges.filter((e) => e.sourceId === node.id);

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">{node.name}</h2>
        <button
          onClick={() => setPanel(null)}
          className="text-gray-500 hover:text-gray-300 text-xl"
        >
          &times;
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 uppercase">Type</label>
          <p className="text-gray-300 text-sm">{node.type}</p>
        </div>

        {node.path && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Path</label>
            <p className="text-gray-300 text-sm font-mono break-all">{node.path}</p>
          </div>
        )}

        {Object.keys(node.properties).length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Properties</label>
            <pre className="text-gray-300 text-xs bg-gray-800 rounded p-2 mt-1 overflow-x-auto">
              {JSON.stringify(node.properties, null, 2)}
            </pre>
          </div>
        )}

        {outEdges.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Outgoing ({outEdges.length})</label>
            <ul className="mt-1 space-y-1">
              {outEdges.map((e) => {
                const target = nodes.find((n) => n.id === e.targetId);
                return (
                  <li key={e.id} className="text-sm text-gray-400 flex gap-2">
                    <span className="text-blue-400">{e.type}</span>
                    <span className="text-gray-300">{target?.name || e.targetId}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {inEdges.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase">Incoming ({inEdges.length})</label>
            <ul className="mt-1 space-y-1">
              {inEdges.map((e) => {
                const source = nodes.find((n) => n.id === e.sourceId);
                return (
                  <li key={e.id} className="text-sm text-gray-400 flex gap-2">
                    <span className="text-green-400">{e.type}</span>
                    <span className="text-gray-300">{source?.name || e.sourceId}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
