# Standalone mode

Use this mode for an independent generative-art HTML artifact.

## Dependency choice

1. Prefer a user-supplied or already available local p5.js file.
2. If no local copy exists, offer either:
   - a dependency-free Canvas 2D implementation, when p5.js is not essential;
   - a local p5.js plan that requires separate approval to obtain the library; or
   - a version-pinned CDN reference after disclosing the external request and offline/privacy tradeoff.
3. Do not claim that an HTML file is self-contained or offline-capable when it loads a CDN, remote font, image, API, or analytics resource.

## Artifact structure

- Use a neutral, original interface appropriate to the artwork. Do not copy the Anthropic viewer layout, palette, typography, labels, or branded comments.
- Keep CSS and application code understandable and bounded. Inline them when a genuinely single HTML file is requested.
- Use semantic controls, keyboard focus, labels, reduced-motion handling, and sufficient contrast.
- Use system fonts or properly licensed local fonts by default. Do not contact Google Fonts implicitly.
- Keep seed parsing bounded and deterministic. Use safe DOM APIs such as `textContent`; do not use `eval`, `Function`, or untrusted `innerHTML`.
- A PNG export may use p5.js `saveCanvas` or a Canvas download. State that this writes a user-initiated browser download.

## Offline delivery

- For true offline use, keep all runtime code and assets local and include required third-party notices.
- If p5.js is bundled into the artifact, retain its license notice and provide the corresponding library source or a durable source offer appropriate to its LGPL-2.1 obligations.
- Verify offline behavior only when the user authorizes running a local check; otherwise mark it unverified.
