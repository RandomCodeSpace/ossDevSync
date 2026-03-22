'use client';

import { useUIStore } from '../stores/ui-store';

export default function SearchBar() {
  const { searchQuery, setSearchQuery } = useUIStore();

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-48 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
