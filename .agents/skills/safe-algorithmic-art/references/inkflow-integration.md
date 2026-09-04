# INKFLOW integration mode

Use this mode only after the user explicitly asks to integrate an artwork into INKFLOW.

## Preflight

- Inspect INKFLOW's existing React 19, TypeScript, Vite, p5.js, routing, styling, testing, and package-manager conventions without reading `.env*`.
- Reuse a compatible local `p5` dependency when present. If absent, present an installation plan and do not install it.
- Identify the proposed component, route, assets, styles, and tests. Explain changes and obtain authorization before touching production-facing files.

## React implementation

- Use p5 instance mode, not global mode.
- Mount the sketch into a component-owned `ref` inside an effect.
- Create one p5 instance per mounted component and call `instance.remove()` during effect cleanup.
- Remove event listeners, observers, animation callbacks, timers, and workers created by the component.
- Keep mutable frame state outside React render cycles; expose only meaningful controls through typed props or local state.
- Avoid recreating the p5 instance for every slider movement. Debounce expensive regeneration and update safe parameters in place when possible.
- Respect React Strict Mode's development mount/cleanup cycle and ensure initialization is idempotent.
- Scope styles to the component. Do not overwrite INKFLOW globals or adopt third-party branding.

## Vite and security

- Import p5 through the local dependency graph so Vite can bundle it. Do not add a CDN fallback silently.
- Do not access server secrets, `.env*`, cookies, tokens, production APIs, personal data, or browser profiles.
- Only expose variables intentionally prefixed for Vite client use when the existing project already does so; never reveal their values.
- Do not add analytics, telemetry, remote fonts, or remote assets without explicit disclosure and authorization.

## Integration verification plan

Propose, but do not automatically run:

- a TypeScript typecheck;
- the project's existing lint and unit-test commands;
- a local render check at a loopback URL;
- mount/unmount verification for p5 cleanup;
- reduced-motion and document-visibility behavior;
- a mobile-size performance check;
- confirmation that no production route or data source was modified unexpectedly.
