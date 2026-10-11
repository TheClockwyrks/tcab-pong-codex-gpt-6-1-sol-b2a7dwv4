# Carom

A browser paddle duel with a twist: moving your paddle at contact bends the ball's flight. Two swaying, rotating bars turn every rally into a chance for a bank shot. Play Solo against the AI or Versus with a friend on the same keyboard. First to 11, leading by two, wins.

Everything is drawn on canvas and the four sound cues are synthesized. No backend, external assets, or runtime downloads are needed.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the address Vite prints. For the static production site:

```sh
npm run build
npm run preview
```

The complete site is in `dist/`. Serve that directory at the root of any static web server.

## Controls

| Control | Action |
| --- | --- |
| W / S | Left paddle |
| Up / Down arrows | Right paddle; also the left paddle in Solo |
| W / S or arrows | Select a menu item |
| Enter / Space | Confirm |
| P / Escape | Pause or resume |
| Escape | Back from instructions or match results |
| M | Toggle sound |
| Backtick | Engine diagnostic overlay |

Mouse and touch select and activate menu items. On touch devices the engine also supplies paddle sliders and action buttons. Strike near a paddle's edges to aim steeply, and move during contact to add spin. Gold obstacles reflect the ball off their current tilted faces.

## Development checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests create the Simple 2D engine over a canvas and controlled clock, then drive real input and debug poses through counted frames. Coverage and test reports are written to `coverage/`.

The render-free physics live in `src/simulation.ts`, canvas presentation in `src/presentation.ts`, and the state, screen transitions, and automation API in `src/game.ts`. The engine owns input, timing, audio, canvas fitting, and the debug overlay. Showcase screenshots and a recorded rally live in `showcase/`.
