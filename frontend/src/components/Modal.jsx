import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ children, labelledBy, onClose, busy = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} aria-labelledby={labelledBy} aria-busy={busy} className={`m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-surface-700 bg-surface-900 p-5 text-surface-300 backdrop:bg-black/75 ${className}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div>{children}</div></dialog>, document.body);
}
