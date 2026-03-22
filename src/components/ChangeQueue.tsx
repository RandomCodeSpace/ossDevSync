'use client';

import { useEffect } from 'react';
import { useChangesStore } from '../stores/changes-store';

export default function ChangeQueue() {
  const { changes, isLoading, loadChanges, approveChange, rejectChange } = useChangesStore();

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  return (
    <div className="h-full overflow-y-auto bg-gray-950 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Pending Changes ({changes.length})
      </h2>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      {changes.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No pending changes</p>
          <p className="text-gray-600 text-sm mt-1">
            Edit the architecture graph or documentation to create change specs
          </p>
        </div>
      )}

      <div className="space-y-4">
        {changes.map((spec) => (
          <div
            key={spec.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded font-medium">
                    {spec.action}
                  </span>
                  <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded">
                    {spec.status}
                  </span>
                </div>
                <p className="text-gray-200 text-sm">{spec.description}</p>
              </div>
            </div>

            {spec.affectedModules.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">
                  Affected: {spec.affectedModules.join(', ')}
                </p>
              </div>
            )}

            <div className="mt-2 text-xs text-gray-600">
              {spec.impact.filesAffected > 0 && (
                <span className="mr-3">{spec.impact.filesAffected} files affected</span>
              )}
              {spec.impact.importsToUpdate > 0 && (
                <span>{spec.impact.importsToUpdate} imports to update</span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => approveChange(spec.id)}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded"
              >
                Approve
              </button>
              <button
                onClick={() => rejectChange(spec.id)}
                className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded border border-red-600/30"
              >
                Reject
              </button>
            </div>

            <p className="text-xs text-gray-600 mt-2">
              Created: {new Date(spec.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
