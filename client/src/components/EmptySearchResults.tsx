import { Search } from 'lucide-react';

interface EmptySearchResultsProps {
  searchQuery: string;
  onClearSearch: () => void;
  suggestions?: string[];
}

export default function EmptySearchResults({
  searchQuery,
  onClearSearch,
  suggestions
}: EmptySearchResultsProps) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-700 mb-2">
        No results found for "{searchQuery}"
      </h3>
      <p className="text-gray-600 mb-6">
        Try adjusting your search or filters to find what you're looking for
      </p>
      {suggestions && suggestions.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Suggestions:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {suggestions.map((suggestion, index) => (
              <li key={index}>• {suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={onClearSearch}
        className="btn-outline"
      >
        Clear Search
      </button>
    </div>
  );
}
