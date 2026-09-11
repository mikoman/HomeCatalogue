import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { houses, rooms } from './api/client';
import Layout from './components/Layout';
import HouseList from './components/HouseList';
import HouseDetail from './components/HouseDetail';
import RoomView from './components/RoomView';
import ReviewScan from './components/ReviewScan';
import Settings from './components/Settings';
import SearchResults from './components/SearchResults';
import FailedScans from './components/FailedScans';

export default function App() {
  const [housesList, setHousesList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++refreshSequence.current;
    try {
      const [nextHouses, nextRooms] = await Promise.all([houses.list(), rooms.list()]);
      if (requestId !== refreshSequence.current) return;
      setHousesList(nextHouses);
      setRoomsList(nextRooms);
      setError(null);
    } catch (err) {
      if (requestId !== refreshSequence.current) return;
      setError(err.message || 'The catalogue could not load. Check the server connection.');
    } finally {
      if (requestId === refreshSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('catalogue:changed', refresh);
    return () => { window.removeEventListener('catalogue:changed', refresh); refreshSequence.current += 1; };
  }, [refresh]);

  const catalogue = { houses: housesList, rooms: roomsList, onRefresh: refresh, loading, error };

  return (
    <Layout houses={housesList} rooms={roomsList}>
      <Routes>
        <Route path="/" element={<Navigate to="/houses" replace />} />
        <Route path="/houses" element={<HouseList {...catalogue} />} />
        <Route path="/capture" element={<HouseList {...catalogue} captureMode />} />
        <Route path="/houses/:houseId" element={<HouseDetail onRefresh={refresh} />} />
        <Route path="/rooms/:roomId" element={<RoomView houses={housesList} />} />
        <Route path="/review-scan" element={<ReviewScan />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/failed-scans" element={<FailedScans />} />
        <Route path="*" element={<div className="space-y-4"><h1 className="text-2xl text-surface-100">This page does not exist.</h1><Link to="/houses" className="btn-primary w-fit">Open catalogue</Link></div>} />
      </Routes>
    </Layout>
  );
}
