import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const goToSearch = (term) => {
    const q = term.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goToSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="relative" role="search" aria-label="Catalogue search">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="search"
        aria-label="Search the catalogue"
        maxLength={500}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the catalogue…"
        className="input-field pl-9 pr-20 text-sm w-full min-h-11"
        enterKeyHint="search"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        className="absolute right-0 top-0 bottom-0 min-h-11 px-3 text-sm font-medium text-primary-400 disabled:text-surface-400 disabled:cursor-not-allowed"
      >
        Search
      </button>
    </form>
  );
}
