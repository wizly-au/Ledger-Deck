# Ledger Deck website module

Put the Ledger Deck dashboard on any website: a plain HTML page, Next.js or React, WordPress, Webflow or anything else that accepts a script tag.

Each visitor's records stay in their own browser. The host site never sees them: the dashboard runs in a frame, and the only thing it tells the host page is which screen is open.

## Option 1: host it on your own site (recommended)

1. Run `node scripts/package-module.mjs`. It writes `dist/ledger-deck/`.
2. Copy that folder into your site's public files so it is served at `/ledger-deck/`. In Next.js that is `public/ledger-deck/`.
3. Add the dashboard to a page:

```html
<script src="/ledger-deck/embed/ledger-deck.js" defer></script>
<ledger-deck height="820"></ledger-deck>
```

Self-hosting keeps the dashboard on your own domain, so browsers treat its storage as first-party and the "Open full screen" link opens it at `yoursite/ledger-deck/` with the same data.

## Option 2: use the hosted copy

No files to copy. The dashboard loads from GitHub Pages:

```html
<script src="https://wizly-au.github.io/Ledger-Deck/embed/ledger-deck.js" defer></script>
<ledger-deck height="820"></ledger-deck>
```

Some browsers (Safari in particular) limit storage for frames from another domain, so visitors' records may not persist as reliably as with Option 1.

## Next.js or React

Copy `embed/LedgerDeck.jsx` into your components folder (it is a client component), host the files as in Option 1, then:

```jsx
import LedgerDeck from '@/components/LedgerDeck';

export default function MoneyPage() {
  return <LedgerDeck height={820} accent="#2a78d6" onViewChange={v => console.log(v)} />;
}
```

## Settings

| Attribute / prop | Values | Default |
| --- | --- | --- |
| `src` | Where the app lives | The folder above the script (`/ledger-deck/` in React) |
| `height` | Pixels, any CSS length, or `fill` for the rest of the screen | `820` |
| `theme` | `auto`, `light`, `dark` | `auto` |
| `accent` | A hex colour for buttons and highlights | Ledger Deck blue |
| `view` | `briefing`, `personal`, `business`, `tax`, `whatif`, `data` | Last screen used |

From script you can switch screens with `document.querySelector('ledger-deck').go('tax')`, and listen for `ledger-deck:view` events to know which screen is showing. `embed/demo.html` shows both.

## If your site sets a Content Security Policy

Allow the frame: `frame-src 'self'` for Option 1, or `frame-src https://wizly-au.github.io` for Option 2. The dashboard's own page needs `connect-src https:` for the optional AI providers, which it already sets for itself.
