'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '../components/Sidebar';
import DetailPanel from '../components/DetailPanel';
import { useGraphStore } from '../stores/graph-store';
import { useUIStore } from '../stores/ui-store';

const GraphCanvas = dynamic(() => import('../components/GraphCanvas'), { ssr: false });
const DocEditor = dynamic(() => import('../components/DocEditor'), { ssr: false });
const ChangeQueue = dynamic(() => import('../components/ChangeQueue'), { ssr: false });

export default function Home() {
  const { stats, isLoading, indexProject } = useGraphStore();
  const { activeView, setView, toggleSidebar, sidebarOpen } = useUIStore();
  const [projectPath, setProjectPath] = useState('');
  const [showIndexDialog, setShowIndexDialog] = useState(false);

  const handleIndex = async () => {
    if (!projectPath.trim()) return;
    await indexProject(projectPath.trim());
    setShowIndexDialog(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-gray-200 text-lg"
          title="Toggle sidebar"
        >
          {sidebarOpen ? '\u25C0' : '\u25B6'}
        </button>

        <h1 className="text-sm font-semibold text-white tracking-wide">ossSync</h1>

        <nav className="flex gap-1 ml-4">
          {(['graph', 'docs', 'changes'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-3 py-1 text-sm rounded ${
                activeView === view
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {stats && (
          <span className="text-xs text-gray-500">
            {stats.nodeCount} nodes, {stats.edgeCount} edges
          </span>
        )}

        <button
          onClick={() => setShowIndexDialog(true)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded"
        >
          Index Project
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 relative">
          {activeView === 'graph' && <GraphCanvas />}
          {activeView === 'docs' && <DocEditor />}
          {activeView === 'changes' && <ChangeQueue />}
        </main>

        <DetailPanel />
      </div>

      {/* Index dialog */}
      {showIndexDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold text-white mb-4">Index Project</h2>
            <input
              type="text"
              placeholder="Absolute path to project (e.g. /home/user/myproject)"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleIndex()}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowIndexDialog(false)}
                className="px-3 py-1.5 text-gray-400 hover:text-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleIndex}
                disabled={isLoading || !projectPath.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded"
              >
                {isLoading ? 'Indexing...' : 'Index'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

