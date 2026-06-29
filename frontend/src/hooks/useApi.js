import { useState, useCallback } from 'react';

/**
 * Generic API hook with loading and error state.
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall(...args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, execute, clearError };
}

/**
 * Hook for managing a list of items with CRUD operations.
 */
export function useItemList(apiModule, dependencies = []) {
  const [items, setItems] = useState([]);
  const { loading, error, execute, clearError } = useApi();

  const fetchItems = useCallback(
    async (...args) => {
      const result = await execute(apiModule.list, ...args);
      setItems(result || []);
      return result;
    },
    [apiModule, execute, ...dependencies],
  );

  const createItem = useCallback(
    async (data) => {
      const newItem = await execute(apiModule.create, data);
      setItems((prev) => [...prev, newItem]);
      return newItem;
    },
    [apiModule, execute, ...dependencies],
  );

  const updateItem = useCallback(
    async (id, data) => {
      const updated = await execute(apiModule.update, id, data);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [apiModule, execute, ...dependencies],
  );

  const deleteItem = useCallback(
    async (id) => {
      await execute(apiModule.delete, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [apiModule, execute, ...dependencies],
  );

  return {
    items,
    loading,
    error,
    clearError,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
  };
}
