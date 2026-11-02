# Atelier presence server

A Cloudflare Worker with one Durable Object per room. It relays positions,
chat lines and specimen prints between apprentices in the atelier. Chat is
never stored; the shared drying line keeps at most 14 prints for 24 hours.

## Run locally

```
cd server
npm install
npm run dev          # ws://localhost:8787
```

Then open http://localhost:8123/?server=ws://localhost:8787 (with the site
served by `python3 -m http.server 8123` from the repo root). Add `&room=xyz`
to use a different room.

## Deploy

```
cd server
npx wrangler login   # once, opens the browser
npm run deploy
```

Wrangler prints the worker URL, e.g. `https://alt-lab-atelier.<account>.workers.dev`.
Put it in `js/atelier/config.js` with the `wss://` scheme:

```js
export const SERVER = 'wss://alt-lab-atelier.<account>.workers.dev';
```

Allowed page origins are listed at the top of `src/index.js`.
