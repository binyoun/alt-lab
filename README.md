# The Alternative Process Lab

A browser darkroom for the early processes of photography, set in a shared
nineteenth century atelier. Visitors walk the studio as apprentices, step up
to a bench, and walk a photograph through a printing process stage by stage:
the negative, the coating, the exposure, the wash. Every process runs client
side in WebGL2; no photograph is ever uploaded.

## Structure

- `index.html` + `js/atelier/` the walkable 3D atelier (Three.js from a CDN)
  - `world.js` the hall, courtyard and garden, benches and props
  - `avatar.js` apprentices and the Master
  - `net.js` + `config.js` presence (other apprentices, chat, the shared line)
  - `main.js` movement, camera, pathfinding, benches, overlays, HUD
- `lab/` the flat lab: process picker and one ritual page per process
- `js/engine/` the shared engine: GL wrapper, brush, stage sequencer
- `js/processes/` one config module per process (metadata, stages, shader)
- `history/`, `ledger/`, `about/` the studio's pages
- `server/` the presence server (Cloudflare Worker, see server/README.md)

## Run locally

```
python3 -m http.server 8123
```

Then open http://localhost:8123/ (add `?debug` for the test handle).

No build step. Plain ES modules, WebGL2.
