# The Alternative Process Lab

A browser darkroom for the early processes of photography. Visitors bring a
photograph and walk it through a nineteenth century printing process, stage by
stage: the negative, the coating, the exposure, the wash. Everything runs
client side in WebGL2; no photograph is ever uploaded.

Working name `alt-lab`. Final title pending.

## Structure

- `lab/` process picker and one ritual page per process
- `js/engine/` the shared engine: GL wrapper, brush, stage sequencer
- `js/processes/` one config module per process (metadata, stages, shader)
- `history/` history of photography section (in progress)

## Run locally

```
python3 -m http.server 8123
```

Then open http://localhost:8123/

No build step. Plain ES modules, WebGL2.
