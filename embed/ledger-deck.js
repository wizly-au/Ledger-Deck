/* <ledger-deck> — drop Ledger Deck into any web page.

   <script src="/ledger-deck/embed/ledger-deck.js" defer></script>
   <ledger-deck height="820" theme="auto" accent="#2a78d6" view="briefing"></ledger-deck>

   Attributes (all optional):
     src     where the app lives. Default: the folder above this script, so a self-hosted copy just works.
     height  a number in px, any CSS length, or "fill" to take the rest of the viewport. Default 820.
     theme   auto | light | dark. Default auto (follows the visitor's device).
     accent  a hex colour for buttons and highlights, to match the host site.
     view    briefing | personal | business | tax | whatif | data. The screen to open first.

   The app runs in a frame so its styles and keyboard shortcuts can't clash with the host page.
   Each visitor's records stay in their own browser. The host page only hears which screen is open
   (a "ledger-deck:view" event), never any figures. */
(() => {
  if (customElements.get('ledger-deck')) return;
  const here = document.currentScript?.src || location.href;
  const DEFAULT_SRC = new URL('../', here).href;
  const VIEWS = ['briefing', 'personal', 'business', 'tax', 'whatif', 'data'];

  class LedgerDeck extends HTMLElement {
    static get observedAttributes() { return ['src', 'height', 'theme', 'accent', 'view']; }
    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._root.innerHTML = `<style>
        :host{display:block;width:100%;border-radius:14px;overflow:hidden;border:1px solid rgba(127,127,127,.25);background:#f5f5f3}
        @media (prefers-color-scheme:dark){:host{background:#111110}}
        :host([theme="light"]){background:#f5f5f3} :host([theme="dark"]){background:#111110}
        iframe{display:block;width:100%;height:100%;border:0}
      </style><iframe title="Ledger Deck money dashboard" allow="microphone; clipboard-write; fullscreen" referrerpolicy="no-referrer"></iframe>`;
      this._frame = this._root.querySelector('iframe');
      this._onMsg = e => {
        if (e.source !== this._frame.contentWindow || e.data?.source !== 'ledger-deck') return;
        if (e.data.type === 'view') this._view = e.data.view;
        this.dispatchEvent(new CustomEvent('ledger-deck:' + e.data.type, { detail: { view: e.data.view }, bubbles: true }));
      };
    }
    connectedCallback() { addEventListener('message', this._onMsg); this._size(); this._load(); }
    disconnectedCallback() { removeEventListener('message', this._onMsg); }
    attributeChangedCallback(name, was, now) {
      if (!this.isConnected || was === now) return;
      if (name === 'height') this._size();
      else if (name === 'view' && this._frame.src) this.go(now);
      else this._load();
    }
    /* Switch screens without reloading. */
    go(view, tab) { if (VIEWS.includes(view)) this._frame.contentWindow?.postMessage({ source: 'ledger-deck-host', type: 'go', view, tab }, this._origin()); }
    get view() { return this._view; }
    _origin() { return new URL(this.getAttribute('src') || DEFAULT_SRC, location.href).origin; }
    _size() {
      const h = (this.getAttribute('height') || '820').trim();
      this.style.height = h === 'fill' ? `calc(100vh - ${Math.max(0, Math.round(this.getBoundingClientRect().top + scrollY))}px)` : /^\d+$/.test(h) ? h + 'px' : h;
      if (h === 'fill') this.style.minHeight = '560px';
    }
    _load() {
      const u = new URL(this.getAttribute('src') || DEFAULT_SRC, location.href);
      u.searchParams.set('embed', '1');
      const theme = this.getAttribute('theme'); if (theme === 'light' || theme === 'dark') u.searchParams.set('theme', theme);
      const accent = this.getAttribute('accent'); if (accent && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) u.searchParams.set('accent', accent.replace('#', ''));
      const view = this.getAttribute('view'); u.hash = VIEWS.includes(view) ? view : '';
      if (this._frame.src !== u.href) this._frame.src = u.href;
    }
  }
  customElements.define('ledger-deck', LedgerDeck);
})();
