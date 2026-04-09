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

## Add a new agent later

1. Add the real agent to your private OpenClaw config.
2. Optionally add a visual entry for that agent in `data/world-manifest.json`.
3. If you skip step 2, the frontend still renders the new agent with fallback visuals.

## Local testing

- Start the private bridge from its private sibling folder.
- Serve this folder with any static server, or open it via your local site workflow.
- Update the bridge URL in the world UI if you are not using the default local bridge port.
