import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { houses } from './api/client';
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

  useEffect(() => {
    houses.list()
      .then(setHousesList)
      .catch(console.error);
  }, []);

  return (
    <Layout houses={housesList} setHouses={setHousesList}>
      <Routes>
        <Route path="/" element={<Navigate to="/houses" replace />} />
        <Route path="/houses" element={<HouseList houses={housesList} onUpdate={setHousesList} />} />
        <Route path="/houses/:houseId" element={<HouseDetail />} />
        <Route path="/rooms/:roomId" element={<RoomView />} />
        <Route path="/review-scan" element={<ReviewScan />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/failed-scans" element={<FailedScans />} />
      </Routes>
    </Layout>
  );
}
