/**
 * API client for the Home Catalogue backend.
 * All endpoints are proxied through Vite dev server or served by nginx in production.
 */

const API_BASE = '/api';

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
    throw new Error(error.detail || `API Error: ${response.status}`);
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
  list: (houseId) => request(`/rooms/?house_id=${houseId}`),
  get: (id) => request(`/rooms/${id}`),
  create: (data) => request('/rooms/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/rooms/${id}`, { method: 'DELETE' }),
};

// Containers
export const containers = {
  list: (roomId, parentId = null) => {
    const params = parentId !== null ? `?room_id=${roomId}&parent_id=${parentId}` : `?room_id=${roomId}`;
    return request(`/containers/${params}`);
  },
  get: (id) => request(`/containers/${id}`),
  create: (data) => request('/containers/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/containers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/containers/${id}`, { method: 'DELETE' }),
};

// Items
export const items = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    return request(`/items/?${searchParams}`);
  },
  get: (id) => request(`/items/${id}`),
  create: (data) => request('/items/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  bulkCreate: (data) => request('/items/bulk', { method: 'POST', body: JSON.stringify(data) }),
};

// Scan
export const scan = {
  upload: async (roomId, file) => {
    const formData = new FormData();
    formData.append('room_id', roomId);
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/scan/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Scan failed: ${response.status}`);
    }

    return response.json();
  },
  getPending: (sessionId) => request(`/scan/pending/${sessionId}`),
};
