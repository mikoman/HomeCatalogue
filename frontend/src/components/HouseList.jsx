import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { houses as housesApi, rooms as roomsApi } from '../api/client';
import Icon from './Icon';

export default function HouseList({ houses = [], rooms = [], onRefresh, loading, error: loadError, captureMode = false }) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [houseId, setHouseId] = useState('');
  const [newName, setNewName] = useState('My home');
  const [newRoomName, setNewRoomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const createdHouse = useRef(null);
  let recentRoom = null;
  try { recentRoom = rooms.find(room => String(room.id) === localStorage.getItem('homeCatalogue:lastRoom')); } catch { /* Storage can be unavailable. */ }
  const recentHouse = recentRoom && houses.find(house => house.id === recentRoom.house_id);
  const showForm = showCreate || (!loading && !loadError && rooms.length === 0);
  const effectiveHouseId = houseId || (houses.length === 1 ? String(houses[0].id) : 'new');

  const handleCreate = async event => {
    event.preventDefault();
    if (saving || !newRoomName.trim() || (effectiveHouseId === 'new' && !newName.trim())) return;
    setSaving(true);
    setError(null);
    try {
      let destination = effectiveHouseId === 'new' ? createdHouse.current : Number(effectiveHouseId);
      if (!destination) {
        const house = await housesApi.create({ name: newName.trim() });
        destination = house.id;
        createdHouse.current = house.id;
        setHouseId(String(house.id));
      }
      const room = await roomsApi.create({ house_id: destination, name: newRoomName.trim() });
      await onRefresh();
      setShowCreate(false);
      setNewRoomName('');
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      setError(err.message);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p role="status" className="py-12 text-surface-400">Loading your catalogue…</p>;
  if (loadError) return <div className="space-y-4 py-8"><h1 className="font-display text-2xl text-surface-100">The catalogue could not load.</h1><p role="alert" className="text-red-300">{loadError}</p><button onClick={onRefresh} className="btn-primary">Try again</button><Link to="/settings" className="text-primary-400 inline-block">Open settings</Link></div>;

  return <div className="space-y-8">
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-surface-100">{captureMode ? 'Where are you scanning?' : 'Your catalogue'}</h1>
        <p className="mt-2 text-surface-400 max-w-xl">{captureMode ? 'Choose a room. Take photos, check the results, and save.' : 'A photo now. Less searching later.'}</p>
      </div>
      {!captureMode && rooms.length > 0 && <Link to="/capture" className="btn-primary self-start shrink-0"><Icon name="camera" />Scan a space</Link>}
    </header>

    {!showForm && recentRoom && <section className="rounded-xl border border-primary-800 bg-surface-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="flex-1 min-w-0"><p className="text-sm text-surface-400">Last used room</p><h2 className="text-xl font-display text-surface-100 mt-1 break-words">{recentRoom.name}</h2><p className="text-sm text-surface-400 mt-1">{recentHouse?.name}</p></div>
      <Link to={`/rooms/${recentRoom.id}`} className="btn-primary self-start"><Icon name="camera" />Continue here</Link>
    </section>}

    {showForm && <section className="rounded-xl border border-surface-700 bg-surface-900 p-5 sm:p-6 max-w-2xl">
      <h2 className="font-display text-xl font-semibold text-surface-100">{rooms.length === 0 ? 'Start with one space' : 'Add a room or space'}</h2>
      <p className="text-sm text-surface-400 mt-2">A room, a shelf, or a collection. You can organise the items later.</p>
      <form onSubmit={handleCreate} className="space-y-4 mt-5">
        {houses.length > 0 && <div><label htmlFor="start-house" className="field-label">Property</label><select id="start-house" className="input-field" value={effectiveHouseId} onChange={event => { setHouseId(event.target.value); createdHouse.current = null; }} disabled={saving}>{houses.map(house => <option key={house.id} value={house.id}>{house.name}</option>)}<option value="new">Add a property…</option></select></div>}
        {effectiveHouseId === 'new' && <div><label htmlFor="start-home" className="field-label">Property name</label><input id="start-home" className="input-field" value={newName} onChange={event => { setNewName(event.target.value); createdHouse.current = null; }} maxLength={255} required disabled={saving} /></div>}
        <div><label htmlFor="start-room" className="field-label">Room or space name</label><input id="start-room" className="input-field" placeholder="For example, Kitchen or Book collection" value={newRoomName} onChange={event => setNewRoomName(event.target.value)} maxLength={255} required disabled={saving} /></div>
        <div className="flex flex-wrap gap-2" aria-label="Common rooms">{['Kitchen', 'Living room', 'Garage', 'Unsorted'].map(name => <button type="button" key={name} onClick={() => setNewRoomName(name)} disabled={saving} className="px-3 py-2 rounded-lg border border-surface-700 text-sm text-surface-300 hover:border-primary-600">{name}</button>)}</div>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary" disabled={saving || !newRoomName.trim()}>{saving ? 'Creating your space…' : 'Create space and continue'}<Icon name="arrow" /></button>{rooms.length > 0 && <button type="button" className="btn-secondary" disabled={saving} onClick={() => { setShowCreate(false); setError(null); }}>Cancel</button>}</div>
      </form>
    </section>}

    {houses.length > 0 && rooms.length > 0 && <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold text-surface-100">{captureMode ? 'Choose a space' : 'Your spaces'}</h2><button onClick={() => { setShowCreate(true); setError(null); }} className="btn-secondary text-sm"><Icon name="plus" />Add space</button></div>
      {houses.map(house => <div key={house.id} className="space-y-2">
        <div className="flex items-center justify-between gap-3 py-2"><h3 className="text-sm font-medium text-surface-300 break-words">{house.name}</h3><Link to={`/houses/${house.id}`} className="text-sm text-surface-400 hover:text-primary-400 py-2 shrink-0">Manage rooms</Link></div>
        <div className="divide-y divide-surface-800 border-y border-surface-800">{rooms.filter(room => room.house_id === house.id).map(room => <Link key={room.id} to={`/rooms/${room.id}`} className="group flex items-center gap-4 py-4 px-2 hover:bg-surface-900 transition-colors rounded-md"><span className="p-3 bg-surface-800 rounded-lg text-primary-400"><Icon name="room" /></span><span className="flex-1 min-w-0"><span className="block font-medium text-surface-100 truncate">{room.name}</span><span className="block text-sm text-surface-400 mt-1 truncate">{room.description || (captureMode ? 'Take a photo or choose from your library' : 'View items and scan photos')}</span></span><Icon name={captureMode ? 'camera' : 'arrow'} className="w-5 h-5 text-surface-400 group-hover:text-primary-400 shrink-0" /></Link>)}</div>
        {!rooms.some(room => room.house_id === house.id) && <Link to={`/houses/${house.id}`} className="block py-3 text-sm text-surface-400">Add the first room in this property.</Link>}
      </div>)}
    </section>}

    <footer className="border-t border-surface-800 pt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-sm text-surface-400"><p>Photos become suggestions. You choose what to save.</p><Link to="/settings" className="inline-flex items-center gap-2 text-primary-400 py-2"><Icon name="settings" className="w-4 h-4" />AI settings</Link></footer>
  </div>;
}
