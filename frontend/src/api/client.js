/**
 * API client for the Home Catalogue backend.
 * All endpoints are proxied through Vite dev server or served by nginx in production.
 */

const API_BASE = '/api';

function apiError(detail, fallback) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(entry => entry.msg || 'Check the entered value.').join(' ');
  return fallback;
}

async function request(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${url}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const failure = new Error(apiError(error.detail, `Request failed (${response.status}). Try again.`));
    failure.status = response.status;
    throw failure;
  }

  if (response.status === 204) return null;
  return response.json();
}

// Houses
export const houses = {
  list: () => request('/houses/'),
  get: (id) => request(`/houses/${id}`),
  create: (data) => request('/houses/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/houses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/houses/${id}`, { method: 'DELETE' }),
};

// Rooms
export const rooms = {
  list: (houseId) => request(houseId == null ? '/rooms/' : `/rooms/?house_id=${houseId}`),
  get: (id) => request(`/rooms/${id}`),
  create: (data) => request('/rooms/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/rooms/${id}`, { method: 'DELETE' }),
};

// Containers
export const containers = {
  list: (roomId, parentId = null, { includeAll = false } = {}) => {
    const params = new URLSearchParams({ room_id: roomId });
    if (parentId !== null) params.set('parent_id', parentId);
    if (includeAll) params.set('include_all', 'true');
    return request(`/containers/?${params.toString()}`);
  },
  get: (id) => request(`/containers/${id}`),
  create: (data) => request('/containers/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/containers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id, { deleteItems = false } = {}) =>
    request(`/containers/${id}?delete_items=${deleteItems}`, { method: 'DELETE' }),
  move: (id, { roomId }) =>
    request(`/containers/${id}/move`, { method: 'POST', body: JSON.stringify({ room_id: roomId }) }),
};

// Items
export const items = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return request(`/items/?${searchParams}`);
  },
  search: (q, { semantic = false, signal } = {}) => request(`/items/search?q=${encodeURIComponent(q)}&semantic=${semantic}`, { signal }),
  get: (id) => request(`/items/${id}`),
  create: (data) => request('/items/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  bulkCreate: (data) => request('/items/bulk', { method: 'POST', body: JSON.stringify(data) }),
  reindexEmbeddings: () => request('/items/reindex-embeddings', { method: 'POST' }),
  promoteToContainer: (id) => request(`/items/${id}/promote-to-container`, { method: 'POST' }),
  move: ({ itemIds, roomId, containerId = null }) =>
    request('/items/move', {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds, room_id: roomId, container_id: containerId }),
    }),
};

// Scan
// The upload is asynchronous: it returns { scan_session_id, status } almost
// instantly (the AI inference runs in a backend background task). Poll
// getStatus(sessionId) until status === 'completed' (or 'failed').
export const scan = {
  upload: async (roomId, file, { containerId = null, requestId = null } = {}) => {
    const formData = new FormData();
    formData.append('room_id', roomId);
    formData.append('image', file);
    if (containerId != null) formData.append('container_id', containerId);
    if (requestId) formData.append('request_id', requestId);

    const response = await fetch(`${API_BASE}/scan/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(apiError(error.detail, `Upload failed (${response.status}). Try again.`));
    }

    // Returns { scan_session_id, status: "pending" } immediately.
    return response.json();
  },
  getStatus: (sessionId) => request(`/scan/${sessionId}`),
  listActive: (roomId) => request(roomId == null ? '/scan/active' : `/scan/active?room_id=${roomId}`),
  accept: (sessionId, data) => request(`/scan/${sessionId}/accept`, { method: 'POST', body: JSON.stringify(data) }),
  getPending: (sessionId) => request(`/scan/pending/${sessionId}`),
  listFailed: () => request('/scan/failed'),
  retry: (sessionId) => request(`/scan/${sessionId}/retry`, { method: 'POST' }),
  dismiss: (sessionId) => request(`/scan/${sessionId}`, { method: 'DELETE' }),
};

// AI settings
export const aiSettings = {
  get: () => request('/settings/ai'),
  update: (data) => request('/settings/ai', { method: 'PUT', body: JSON.stringify(data) }),
  listModels: (data, signal) => request('/settings/ai/models', { method: 'POST', body: JSON.stringify(data), signal }),
  testConnection: (data, signal) => request('/settings/ai/test', { method: 'POST', body: JSON.stringify(data), signal }),
  updateScan: (data) => request('/settings/scan', { method: 'PUT', body: JSON.stringify(data) }),
  resetAll: () => request('/settings/reset', { method: 'POST' }),
};

// Object detector (YOLO-World sidecar) — draws boxes around scanned items.
export const detector = {
  update: (data) => request('/settings/detector', { method: 'PUT', body: JSON.stringify(data) }),
  test: (baseUrl) => {
    const params = new URLSearchParams();
    if (baseUrl) params.set('base_url', baseUrl);
    const qs = params.toString();
    return request(`/settings/detector/test${qs ? `?${qs}` : ''}`);
  },
};
