'use client';

import { useMemo } from 'react';
import { useGraphStore } from '../stores/graph-store';
import { useUIStore } from '../stores/ui-store';
import type { NodeType } from '../types';

const TYPE_ICONS: Record<NodeType, string> = {
  project: '\u{1F4C1}',
  module: '\u{1F4E6}',
  entry: '\u{1F4C4}',
  api: '\u{1F310}',
  route: '\u{1F6E4}',
  schema: '\u{1F4CA}',
  config: '\u2699',
  external: '\u{1F517}',
};

const TYPE_ORDER: NodeType[] = ['project', 'module', 'api', 'schema', 'route', 'config', 'external'];

export default function Sidebar() {
  const { nodes } = useGraphStore();
  const { selectedNodeId, selectNode, searchQuery, setSearchQuery, sidebarOpen } = useUIStore();

  const grouped = useMemo(() => {
    const groups: Record<string, typeof nodes> = {};
    const filtered = searchQuery
      ? nodes.filter((n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.path?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : nodes;

    for (const node of filtered) {
      if (!groups[node.type]) groups[node.type] = [];
      groups[node.type].push(node);
    }
    return groups;
  }, [nodes, searchQuery]);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {TYPE_ORDER.map((type) => {
          const group = grouped[type];
          if (!group || group.length === 0) return null;

          return (
            <div key={type} className="mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                {TYPE_ICONS[type]} {type}s ({group.length})
              </h3>
              <ul>
                {group.map((node) => (
                  <li key={node.id}>
                    <button
                      onClick={() => selectNode(node.id)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm truncate transition-colors ${
                        selectedNodeId === node.id
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      title={node.path || node.name}
                    >
                      {node.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-4">No nodes found</p>
        )}
      </div>
    </aside>
  );
}
