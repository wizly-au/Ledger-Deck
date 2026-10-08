'use client';
/* Ledger Deck for a React or Next.js site.

   1. Copy the Ledger Deck folder into public/ledger-deck/ (see embed/README.md).
   2. Put this file in your components folder and use it on any page:

      import LedgerDeck from '@/components/LedgerDeck';
      <LedgerDeck height={820} theme="auto" accent="#2a78d6" view="briefing" />

   Props mirror the <ledger-deck> element: src, height (px, CSS length or "fill"), theme, accent, view,
   and onViewChange(view). Each visitor's records stay in their own browser; the page only hears the screen name. */
import { useEffect, useMemo, useRef } from 'react';

const VIEWS = ['briefing', 'personal', 'business', 'tax', 'whatif', 'data'];
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export default function LedgerDeck({ src = '/ledger-deck/', height = 820, theme = 'auto', accent, view, onViewChange, className, style }) {
  const frame = useRef(null);
  const first = useRef(view);

  const url = useMemo(() => {
    const q = new URLSearchParams({ embed: '1' });
    if (theme === 'light' || theme === 'dark') q.set('theme', theme);
    if (accent && HEX.test(accent)) q.set('accent', accent.replace('#', ''));
    const hash = VIEWS.includes(first.current) ? '#' + first.current : '';
    return `${src}${src.includes('?') ? '&' : '?'}${q}${hash}`;
  }, [src, theme, accent]);

  useEffect(() => {
    const onMsg = e => {
      if (e.source !== frame.current?.contentWindow || e.data?.source !== 'ledger-deck') return;
      if (e.data.type === 'view') onViewChange?.(e.data.view);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onViewChange]);

  useEffect(() => {
    if (!VIEWS.includes(view) || !frame.current?.contentWindow) return;
    const origin = new URL(src, window.location.href).origin;
    frame.current.contentWindow.postMessage({ source: 'ledger-deck-host', type: 'go', view }, origin);
  }, [view, src]);

  const h = height === 'fill' ? '100vh' : typeof height === 'number' ? `${height}px` : height;
  return (
    <div className={className} style={{ height: h, minHeight: 560, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(127,127,127,.25)', ...style }}>
      <iframe ref={frame} src={url} title="Ledger Deck money dashboard" allow="microphone; clipboard-write; fullscreen"
        referrerPolicy="no-referrer" style={{ display: 'block', width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}
