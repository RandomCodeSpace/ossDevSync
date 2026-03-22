'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { fetchDocs, updateDoc } from '../api/client';
import type { DocEntry } from '../types';

export default function DocEditor() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none p-4 focus:outline-none min-h-[300px]',
      },
    },
  });

  useEffect(() => {
    fetchDocs()
      .then(({ docs }) => setDocs(docs))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedModuleId || !editor) return;
    const doc = docs.find((d) => d.moduleId === selectedModuleId);
    if (doc) {
      editor.commands.setContent(doc.content);
    }
  }, [selectedModuleId, docs, editor]);

  const handleSave = async () => {
    if (!selectedModuleId || !editor) return;
    setSaving(true);
    try {
      await updateDoc(selectedModuleId, editor.getHTML());
      // Refresh docs
      const { docs: updated } = await fetchDocs();
      setDocs(updated);
    } catch (err) {
      console.error('Failed to save doc:', err);
    }
    setSaving(false);
  };

  return (
    <div className="flex h-full">
      {/* Doc list sidebar */}
      <div className="w-56 border-r border-gray-800 overflow-y-auto bg-gray-900">
        <h3 className="text-xs font-semibold text-gray-500 uppercase p-3 border-b border-gray-800">
          Documentation ({docs.length})
        </h3>
        <ul>
          {docs.map((doc) => (
            <li key={doc.moduleId}>
              <button
                onClick={() => setSelectedModuleId(doc.moduleId)}
                className={`w-full text-left px-3 py-2 text-sm truncate ${
                  selectedModuleId === doc.moduleId
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {doc.moduleId}
                {doc.isManuallyEdited && (
                  <span className="ml-1 text-xs text-yellow-500" title="Manually edited">*</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {docs.length === 0 && (
          <p className="text-gray-500 text-sm p-3">No docs yet. Index a project first.</p>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        {selectedModuleId ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
              <h2 className="text-sm font-medium text-gray-200">{selectedModuleId}</h2>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-950">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-950">
            <p className="text-gray-500">Select a document to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}
