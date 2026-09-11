import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { items as itemsApi } from '../api/client';
import { cropStyle } from '../utils/cropStyle';

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
        name: item.container_path ?? item.container_name ?? 'Loose in room',
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
  const query = searchParams.get('q')?.trim() || '';
  const semantic = searchParams.get('related') === '1';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    if (input.trim() === query) return;
    const timer = setTimeout(() => {
      setSearchParams({ ...(input.trim() ? { q: input.trim() } : {}), ...(semantic ? { related: '1' } : {}) }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, query, semantic, setSearchParams]);

  useEffect(() => {
    setResults([]);
    setError(null);
    if (!query) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    itemsApi.search(query, { semantic, signal: controller.signal })
      .then((data) => { if (!cancelled) setResults(data); })
      .catch((err) => { if (!cancelled && err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [query, semantic, retry]);

  const grouped = useMemo(() => groupSearchResults(results), [results]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = input.trim();
    setSearchParams({ ...(next ? { q: next } : {}), ...(semantic ? { related: '1' } : {}) }, { replace: true });
  };

  return (
    <div className="space-y-8 animate-rise max-w-3xl">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-surface-100">
          Find your things
        </h1>
        <p className="mt-2 text-surface-400">Search by name, category, tag, or location.</p>
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2" role="search" aria-label="Find items">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              aria-label="Search items"
              maxLength={500}
              enterKeyHint="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Try batteries or kitchen"
              className="input-field pl-9 text-base w-full min-h-11"
            />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap min-h-11">Search</button>
        </form>
        <label className="inline-flex items-center gap-3 text-sm text-surface-300 min-h-11 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(event) => setSearchParams({ ...(input.trim() ? { q: input.trim() } : {}), ...(event.target.checked ? { related: '1' } : {}) }, { replace: true })}
            className="w-5 h-5 accent-primary-500"
          />
          Include related matches with AI
        </label>
      </header>

      {!query && (
        <div className="text-center py-14">
          <p className="text-surface-300">Start typing to search across your catalogue.</p>
          <p className="text-sm text-surface-400 mt-2">Each match shows the house, room, and container.</p>
        </div>
      )}

      {query && loading && (
        <div className="flex items-center justify-center gap-3 py-16" role="status">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-surface-800 border-t-primary-500" />
          <p className="text-sm text-surface-300">{semantic ? 'Finding items and related matches…' : 'Finding items…'}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-4" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
          <button type="button" onClick={() => setRetry(value => value + 1)} className="btn-secondary mt-3 min-h-11">Try again</button>
        </div>
      )}

      {query && !loading && !error && results.length === 0 && (
        <div className="text-center py-14" role="status">
          <h3 className="font-display text-lg font-semibold text-surface-200 mb-1">No matches</h3>
          <p className="text-surface-400 break-words">Nothing in the catalogue matched “{query}”. Try fewer words or a different name.</p>
        </div>
      )}

      {query && !loading && !error && results.length > 0 && (
        <>
          <p className="text-sm text-surface-400 break-words" role="status">
            {results.length === 100 ? 'First 100 results' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`} for “{query}”
          </p>

          <div className="space-y-4">
            {grouped.map(house => (
              <section key={house.id} className="card overflow-hidden p-0">
                <div className="px-4 py-3 border-b border-surface-800 bg-surface-900/60 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <h2 className="font-display font-semibold text-surface-100 break-words min-w-0">{house.name}</h2>
                </div>

                <div className="divide-y divide-surface-800">
                  {house.rooms.map(room => (
                    <div key={room.id} className="px-4 py-3">
                      <Link
                        to={`/rooms/${room.id}`}
                        className="inline-flex items-center gap-2 text-base font-medium text-primary-400 hover:text-primary-300 transition-colors mb-2 min-h-11"
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
                                <span className="text-sm text-surface-400">
                                  Loose in room
                                </span>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                  <span className="text-sm text-surface-400 break-words min-w-0">
                                    {location.name}
                                  </span>
                                </>
                              )}
                              <span className="text-sm text-surface-400 shrink-0">
                                · {location.items.length}
                              </span>
                            </div>

                            <ul className="space-y-1">
                              {location.items.map(item => (
                                <li key={item.id}>
                                  <Link
                                    to={`/rooms/${item.room_id}?item=${item.id}${item.container_id != null ? `&container=${item.container_id}` : ''}`}
                                    aria-label={`Open ${item.name} in ${location.name}, ${room.name}`}
                                    className="w-full flex items-center gap-3 px-2 py-3 rounded-md hover:bg-surface-800 transition-colors text-left group min-h-14"
                                  >
                                    {item.image_url ? (
                                      item.bbox && cropStyle(item.image_url, item.bbox) ? (
                                        <div aria-hidden="true" style={cropStyle(item.image_url, item.bbox)} className="w-11 h-11 rounded border border-surface-800 shrink-0" />
                                      ) : <img
                                        src={item.image_url}
                                        alt=""
                                        loading="lazy"
                                        className="w-11 h-11 rounded object-cover border border-surface-800 flex-shrink-0"
                                      />
                                    ) : (
                                      <span className="font-mono text-xs text-surface-400 flex-shrink-0">
                                        #{String(item.id).padStart(4, '0')}
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-base text-surface-100 break-words">{item.name}</span>
                                    {item.category && (
                                      <span className="block text-sm text-surface-400 break-words">{item.category}</span>
                                    )}
                                    </span>
                                    <svg className="w-4 h-4 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </Link>
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
