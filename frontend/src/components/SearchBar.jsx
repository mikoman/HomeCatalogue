import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { items as itemsApi } from '../api/client';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const searchResults = await itemsApi.list({ search: query });
        setResults(searchResults.slice(0, 10));
        setShowResults(true);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item) => {
    navigate(`/rooms/${item.room_id}`);
    setShowResults(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search items, categories, tags..."
          className="input-field pl-10"
        />
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-900 border border-surface-700 rounded-lg shadow-xl overflow-hidden z-50">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-800 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-surface-200 font-medium truncate">{item.name}</p>
                <p className="text-xs text-surface-500">
                  {item.category && <span className="mr-2">{item.category}</span>}
                  {item.tags?.slice(0, 2).join(', ')}
                </p>
              </div>
              {item.confidence_score !== null && item.confidence_score < 0.8 && (
                <span className="badge-low">AI</span>
              )}
            </button>
          ))}
          {results.length >= 10 && (
            <div className="px-4 py-2 text-xs text-surface-500 border-t border-surface-800">
              Showing 10 of {results.length}+ results
            </div>
          )}
        </div>
      )}
    </div>
  );
}
