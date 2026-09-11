const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  camera: 'M8 6l1.5-2h5L16 6h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3 M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  room: 'M5 21V3h14v18M3 21h18M14 12h1',
  close: 'M6 6l12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  warning: 'M12 3 2 21h20L12 3M12 9v5m0 3v1',
};

export default function Icon({ name, className = 'w-5 h-5' }) {
  return <svg className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={paths[name] || paths.room} /></svg>;
}
