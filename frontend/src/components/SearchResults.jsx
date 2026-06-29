import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { items as itemsApi } from '../api/client';

function groupSearchResults(results) {
  const houses = [];
  const houseIndex = new Map();

  for (const item of results) {
    let house = houseIndex.get(item.house_id);
    if (!house) {
      house = { id: item.house_id, name: item.house_name, rooms: [], roomIndex: new Map() };
      houseIndex.set(item.house_id, house);
      houses.push(house);
    }

    let room = house.roomIndex.get(item.room_id);
    if (!room) {
      room = { id: item.room_id, name: item.room_name, locations: [], locationIndex: new Map() };
      house.roomIndex.set(item.room_id, room);
      house.rooms.push(room);
    }

    const locKey = item.container_id ?? 'loose';
    let location = room.locationIndex.get(locKey);
    if (!location) {
      location = {
        key: locKey,
        containerId: item.container_id,
        name: item.container_name ?? 'Loose in room',
        isLoose: item.container_id == null,
        items: [],
      };
      room.locationIndex.set(locKey, location);
      room.locations.push(location);
    }
    location.items.push(item);
  }

  for (const house of houses) {
    for (const room of house.rooms) {
      room.locations.sort((a, b) => {
        if (a.isLoose !== b.isLoose) return a.isLoose ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }
  }

  return houses;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.trim() || '';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    itemsApi.search(query)
      .then((data) => { if (!cancelled) setResults(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const grouped = useMemo(() => groupSearchResults(results), [results]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = input.trim();
    if (!next) return;
    setSearchParams({ q: next });
  };

  return (
    <div className="space-y-8 animate-rise max-w-3xl">
      <header>
        <p className="eyebrow">Search</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-surface-100 mt-1">
          Catalogue lookup
        </h1>
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search items, categories, tags…"
              className="input-field pl-9 text-sm w-full"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">Search</button>
        </form>
      </header>

      {!query && (
        <div className="card text-center py-14">
          <p className="text-surface-400">Enter a term above to search across every room and container.</p>
        </div>
      )}

      {query && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500" />
        </div>
      )}

      {error && (
        <div className="card border-red-900 bg-red-950/30 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {query && !loading && !error && results.length === 0 && (
        <div className="card text-center py-14">
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">No matches</h3>
          <p className="text-surface-500">Nothing in the catalogue matched “{query}”.</p>
        </div>
      )}

      {query && !loading && results.length > 0 && (
        <>
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-surface-500">
            {results.length} {results.length === 1 ? 'result' : 'results'} for “{query}”
          </p>

          <div className="space-y-4">
            {grouped.map(house => (
              <section key={house.id} className="card overflow-hidden p-0">
                <div className="px-4 py-3 border-b border-surface-800 bg-surface-900/60 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <h2 className="font-display font-semibold text-surface-100">{house.name}</h2>
                </div>

                <div className="divide-y divide-surface-800">
                  {house.rooms.map(room => (
                    <div key={room.id} className="px-4 py-3">
                      <Link
                        to={`/rooms/${room.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors mb-3"
                      >
                        <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {room.name}
                      </Link>

                      <div className="space-y-3 ml-2 pl-4 border-l border-surface-800">
                        {room.locations.map(location => (
                          <div key={location.key}>
                            <div className="flex items-center gap-2 mb-1.5">
                              {location.isLoose ? (
                                <span className="font-mono text-[0.62rem] uppercase tracking-wider text-surface-500">
                                  Loose in room
                                </span>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  <span className="font-mono text-[0.62rem] uppercase tracking-wider text-surface-500">
                                    {location.name}
                                  </span>
                                </>
                              )}
                              <span className="font-mono text-[0.58rem] text-surface-600">
                                · {location.items.length}
                              </span>
                            </div>

                            <ul className="space-y-1">
                              {location.items.map(item => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/rooms/${item.room_id}`)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-800 transition-colors text-left group"
                                  >
                                    <span className="font-mono text-[0.62rem] text-surface-600 flex-shrink-0">
                                      #{String(item.id).padStart(4, '0')}
                                    </span>
                                    <span className="text-sm text-surface-100 truncate flex-1">{item.name}</span>
                                    {item.category && (
                                      <span className="tag text-[0.65rem] py-0 px-1.5 flex-shrink-0">{item.category}</span>
                                    )}
                                    <svg className="w-3.5 h-3.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
