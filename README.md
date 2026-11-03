# The Alternative Process Lab

A browser darkroom for the early processes of photography, set on Atelier Row,
a nineteenth century street with an atelier for every process. Visitors walk
in as apprentices, step up to a bench, and walk a photograph through a printing process stage by stage:
the negative, the coating, the exposure, the wash. Every process runs client
side in WebGL2; no photograph is ever uploaded.

## Structure

- `index.html` + `js/atelier/` Atelier Row, the walkable 3D street (Three.js from a CDN)
  - `street.js` the street: nine shopfronts, the Master's office, history, ledger
  - `ateliers.js` the nine process ateliers, each its own room and light
  - `world.js` the shared building kit, benches and their props
  - `places.js` the ateliers and history chapters as plain data
  - `avatar.js` apprentices and the Master
  - `net.js` + `config.js` presence: each atelier and the street is its own room
  - `main.js` scenes, movement, camera, pathfinding, benches, overlays, HUD
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
