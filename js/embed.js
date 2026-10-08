/* Embedded mode: when Ledger Deck runs inside another website (the <ledger-deck> element or an iframe).
   The host page can set the theme, accent colour and starting screen through the URL.
   Only screen names cross the frame boundary. Financial data never leaves this page. */
import { onNav, go, V } from './ui.js';

const q = new URLSearchParams(location.search);
let inFrame = false; try { inFrame = window.top !== window; } catch { inFrame = true; }
export const embedded = q.has('embed') || inFrame;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

export function applyEmbed() {
  if (!embedded) return;
  document.body.classList.add('embedded');
  const theme = q.get('theme'); if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  const accent = q.get('accent'); if (accent && HEX.test(accent)) {
    const [r, g, b] = hexToRgb(accent), s = document.documentElement.style;
    s.setProperty('--accent', '#' + accent.replace('#', ''));
    s.setProperty('--accent-soft', `rgba(${r},${g},${b},.12)`);
    s.setProperty('--on-accent', (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b0b0b' : '#ffffff');
  }
  // "Open full screen" leaves the host site for the standalone app, which shares this device's data on the same origin
  const top = document.querySelector('.top');
  if (top) {
    const a = document.createElement('a'); a.className = 'chip btn'; a.id = 'fullApp'; a.target = '_blank'; a.rel = 'noopener';
    a.href = location.pathname; a.textContent = 'Open full screen'; a.title = 'Open Ledger Deck in its own tab';
    top.append(a);
  }
  const tell = msg => { try { parent.postMessage({ source: 'ledger-deck', ...msg }, '*'); } catch { } };
  onNav(view => tell({ type: 'view', view }));
  addEventListener('message', e => {
    if (e.source !== parent || e.data?.source !== 'ledger-deck-host') return;
    if (e.data.type === 'go' && V[e.data.view]) go(e.data.view, e.data.tab);
  });
  tell({ type: 'ready' });
}
