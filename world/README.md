# Jarvis World

Public static frontend for the Jarvis World observatory.

## Safety

- This folder is public.
- Never put secrets, tokens, private paths, or raw prompts here.
- The private bridge lives outside this public repo in a sibling private folder.

## How it works

- The first screen is the access gate.
- Guest mode shows a sanitized live world.
- Admin mode talks to the private bridge and unlocks the Jarvis command lane plus richer detail.
- The frontend polls the bridge every 5 seconds and animates between snapshots.
- The deployed site should learn its bridge URL from `data/bridge-config.json`, not from per-device manual input.
- The world is now a full-screen 3D village in `js/world-scene.js`.

## Visual system

- Agent homes are generated from the live roster, so a new subagent automatically gets its own lot.
- Lots are intentionally generated as loose neighborhoods instead of a perfect ring, so the village can sprawl as new subagents appear.
- The public house kit under `assets/models/kenney-town/` is CC0 art from Kenney.
- Agent gnomes are procedural for performance and easier future edits.
- `data/world-manifest.json` is now mostly a source of display names and palettes; the 3D home layout is generated at runtime.

## Add a new agent later

1. Add the real agent to your private OpenClaw config.
2. Optionally add a visual entry for that agent in `data/world-manifest.json`.
3. If you skip step 2, the frontend still renders the new agent with a generated home and fallback palette.
4. If you want a more bespoke look, update the palette metadata in `data/world-manifest.json` and the home-generation logic in `js/world-scene.js`.

## Local testing

- Start the private bridge from its private sibling folder.
- Serve this folder with any static server, or open it via your local site workflow.
- Camera controls:
  - drag to orbit
  - right-drag or Shift-drag to pan
  - scroll to zoom
  - `WASD` / arrow keys pan, `Q` / `E` orbit, `R` / `F` zoom

## Bridge deployment

- Put the public bridge URL in `data/bridge-config.json`.
- For admin mode across devices, the bridge must be public HTTPS and must allow the deployed site origin.
- Admin session persistence depends on the private bridge cookie settings, not on anything in this public folder.
