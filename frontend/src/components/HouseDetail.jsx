import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { houses as housesApi, rooms as roomsApi } from '../api/client';
import Icon from './Icon';

export default function HouseDetail({ onRefresh }) {
  const { houseId } = useParams();
  return <PropertyRooms key={houseId} houseId={houseId} onRefresh={onRefresh} />;
}

function PropertyRooms({ houseId, onRefresh }) {
  const navigate = useNavigate();
  const [house, setHouse] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const loadSequence = useRef(0);
  const loadData = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setError(null);
    setHouse(null);
    setRooms([]);
    try {
      const [nextHouse, nextRooms] = await Promise.all([housesApi.get(houseId), roomsApi.list(houseId)]);
      if (requestId !== loadSequence.current) return;
      setHouse(nextHouse);
      setRooms(nextRooms);
    } catch (err) { if (requestId === loadSequence.current) setError(err.message); }
    finally { if (requestId === loadSequence.current) setLoading(false); }
  }, [houseId]);
  useEffect(() => { loadData(); return () => { loadSequence.current += 1; }; }, [loadData]);

  const createRoom = async event => {
    event.preventDefault();
    if (!newRoomName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const room = await roomsApi.create({ house_id: Number(houseId), name: newRoomName.trim() });
      setRooms(previous => [...previous, room]);
      setNewRoomName('');
      await onRefresh();
      navigate(`/rooms/${room.id}`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const deleteRoom = async room => {
    if (saving || !confirm(`Delete ${room.name} and all its items and containers? This cannot be undone.`)) return;
    setSaving(true);
    try { await roomsApi.delete(room.id); setRooms(previous => previous.filter(value => value.id !== room.id)); await onRefresh(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const deleteHouse = async () => {
    if (saving || !confirm(`Delete ${house.name}, all its rooms, and all their contents? This cannot be undone.`)) return;
    setSaving(true);
    try { await housesApi.delete(houseId); await onRefresh(); navigate('/houses'); }
    catch (err) { setError(err.message); setSaving(false); }
  };
  if (loading) return <p role="status" className="py-10 text-surface-400">Loading rooms…</p>;
  return <div className="space-y-6">
    <Link to="/houses" className="text-sm text-surface-400 hover:text-primary-400 inline-block py-2">Back to catalogue</Link>
    {error && <div role="alert" className="space-y-3 text-red-300"><p>{error}</p><button onClick={loadData} className="btn-secondary">Try again</button></div>}
    {house && <>
      <header><h1 className="font-display text-3xl font-semibold text-surface-100 break-words">{house.name}</h1><p className="mt-2 text-surface-400">{house.description || 'Choose a room to view items or scan photos.'}</p></header>
      <form onSubmit={createRoom} className="max-w-xl"><label htmlFor="new-room" className="field-label">Add a room or space</label><div className="flex flex-col sm:flex-row gap-3"><input id="new-room" value={newRoomName} onChange={event => setNewRoomName(event.target.value)} placeholder="For example, Kitchen" className="input-field" maxLength={255} required disabled={saving} /><button className="btn-primary shrink-0" disabled={saving || !newRoomName.trim()}><Icon name="plus" />{saving ? 'Please wait…' : 'Add room'}</button></div></form>
      <div className="divide-y divide-surface-800 border-y border-surface-800">{rooms.map(room => <div key={room.id} className="flex items-center gap-3 py-2"><Link to={`/rooms/${room.id}`} className="flex-1 min-w-0 flex items-center gap-3 py-3 text-surface-100 hover:text-primary-400"><Icon name="room" /><span className="truncate">{room.name}</span><Icon name="arrow" className="w-4 h-4 ml-auto shrink-0" /></Link><button onClick={() => deleteRoom(room)} disabled={saving} className="icon-button text-surface-400 hover:text-red-300" aria-label={`Delete ${room.name}`}><Icon name="close" /></button></div>)}</div>
      {!rooms.length && <p className="text-surface-400">Add your first room to start scanning.</p>}
      <details className="border-t border-surface-800 pt-4"><summary className="cursor-pointer text-sm text-surface-400 py-2">Export and property options</summary><div className="flex flex-wrap gap-3 mt-4"><a href={`/api/export?house_id=${houseId}&format=csv`} download className="btn-secondary text-sm">Export CSV</a><a href={`/api/export?house_id=${houseId}&format=json`} download className="btn-secondary text-sm">Export JSON</a><button onClick={deleteHouse} disabled={saving} className="btn-secondary text-red-300 text-sm">Delete property</button></div><p className="text-sm text-surface-400 mt-3">Exports contain catalogue records. Back up the storage folder separately to keep your photos.</p></details>
    </>}
  </div>;
}
