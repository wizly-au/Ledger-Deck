# Ledger Deck

A free, private money dashboard for Australians. Personal and business books, a tax assistant, and plain-English briefings you can listen to.

**Your data stays on your device.** There is no account, no server and no tracking. Everything is stored in your browser (IndexedDB), optionally encrypted with a passcode (AES-GCM, key from PBKDF2-SHA256).

## What it does

- **Briefing**: one-line summary, alerts, the next 14 days, read aloud with your device's voice.
- **Personal**: net worth, spending by category, accounts, bills and subscriptions, goals and budgets.
- **Business**: profit, cash runway, invoices, costs, GST and BAS by quarter.
- **Tax**: estimated position for the financial year, deduction finder, strategies, BAS helper, and a 7-tab spreadsheet for your tax agent.
- **What if**: loan payoff and big-purchase sliders.
- **Data & AI**: import statements (CSV, OFX, QIF, PDF), rules, encrypted backups.

## Getting your data in

Download statements from your bank's website or app and drop them in. CSV, OFX and QIF transactions are read in your browser. PDF statements (super, shares) are scanned for balances. Ledger Deck never asks for banking passwords.

## AI (optional)

Ask questions in plain English using your own API key from Anthropic (Claude), OpenAI, Google Gemini, xAI (Grok), OpenRouter, Mistral, DeepSeek, Groq, Together, Perplexity, or a local model through Ollama or LM Studio.

When you ask a question, a summary of your figures goes **directly from your browser to the AI company you chose**, under their privacy terms. Nothing goes anywhere else. With a local model, nothing leaves your computer.

## Not advice

Ledger Deck gives general information only. It isn't personal financial or tax advice. Talk to a registered tax agent or licensed adviser before acting.

## Running it

It is a static site with no build step:

```sh
npx http-server -p 8080 -c-1 .
```

Then open http://localhost:8080. It installs as an app (PWA) and works offline.

## Put it on your website

The `embed/` folder has a drop-in `<ledger-deck>` element and a React/Next.js component. See [embed/README.md](embed/README.md).

## Tests

`test/smoke.mjs` walks every screen with sample data. `test/flow.mjs` runs the setup wizard at phone size, imports `test/cba.csv`, sets a passcode and unlocks. `test/embed.mjs` loads the dashboard inside `embed/demo.html` at desktop and phone size. All use Playwright against a local server on port 8080.

## Licence

MIT. Bundles SheetJS Community Edition (Apache 2.0) and PDF.js (Apache 2.0) in `vendor/`.
