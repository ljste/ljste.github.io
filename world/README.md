# Jarvis World

Public static frontend for the Jarvis tiny-town observatory.

## Safety

- This folder is public.
- Never put secrets, tokens, private paths, or raw prompts here.
- The private bridge lives outside this public repo in a sibling private folder.

## How it works

- Guest mode shows a sanitized live world.
- Admin mode talks to the private bridge and unlocks richer detail plus one control: dispatching a message to Jarvis.
- The frontend polls the bridge every 5 seconds and animates between snapshots.
- The deployed site should learn its bridge URL from `data/bridge-config.json`, not from per-device manual input.
- The town art is intentionally procedural. `js/world-scene.js` draws a faux-isometric island and station buildings with Phaser graphics, so future edits do not depend on an external art pipeline.

## Add a new agent later

1. Add the real agent to your private OpenClaw config.
2. Optionally add a visual entry for that agent in `data/world-manifest.json`.
3. If you skip step 2, the frontend still renders the new agent with fallback visuals.
4. If you want custom placement or a more bespoke building, update the station metadata in `data/world-manifest.json` and the station drawing branch in `js/world-scene.js`.

## Local testing

- Start the private bridge from its private sibling folder.
- Serve this folder with any static server, or open it via your local site workflow.

## Bridge deployment

- Put the public bridge URL in `data/bridge-config.json`.
- For admin mode across devices, the bridge must be public HTTPS and must allow the deployed site origin.
- The bridge controls are hidden by default because the intended setup is one configured bridge URL for everyone, not per-user manual entry.
