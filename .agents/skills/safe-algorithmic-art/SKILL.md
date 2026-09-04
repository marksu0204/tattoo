---
name: safe-algorithmic-art
description: Create original code-based generative art with p5.js for standalone interactive artwork or, when explicitly requested, INKFLOW integration. Use for algorithmic or generative-art implementation. Do not use for Midjourney prompts, ordinary image generation, image editing, static illustration requests, or tattoo-theme ideation that does not require a coded generative system.
---

# Safe Algorithmic Art

Create original, reproducible p5.js work without inheriting Anthropic or Claude branding, templates, colors, typography, or viewer structure.

## Boundaries

- Do not imitate, reproduce, or closely derive from the distinctive style of a living artist. Translate references into high-level attributes such as density, rhythm, symmetry, line character, negative space, or motion, then create an original system.
- Do not include Shell, Python, executable helpers, generic command runners, or automatic scripts in this skill.
- Do not modify INKFLOW production pages, routes, shared styles, dependencies, or configuration without explicit authorization for the exact change.
- Prefer local p5.js already available in the target project. Do not install packages automatically.
- Before generating an artifact that uses any CDN, disclose every host, resource, version, privacy/offline consequence, and local alternative.
- Preserve deterministic output for a given seed and parameter set unless the user explicitly requests nondeterminism.

## Routing

- Do not use this skill for tattoo themes, symbols, copy, or composition discussion that does not require creating a coded generative system.
- For raster image generation or editing, use an image-generation or image-editing capability instead.
- Do not use this skill for Midjourney prompts.
- Use this skill only when the user explicitly requests algorithmic art, p5.js, particles, a flow field, seeded randomness, or another programmable generative system.

## Choose a mode

- **Standalone:** Use when the user wants a separate HTML artwork or composition explorer. Read [references/standalone.md](references/standalone.md).
- **INKFLOW integration:** Use only when the user explicitly requests integration into INKFLOW. Read [references/inkflow-integration.md](references/inkflow-integration.md).

For either mode, read [references/licenses-and-performance.md](references/licenses-and-performance.md). Use [references/test-cases.md](references/test-cases.md) to review expected behavior; do not execute those cases automatically.

## Shared design guidance

- Start from the tattoo-composition purpose: body placement, silhouette, flow, negative space, line density, scale, and reproducibility. Do not imply medical, dermatological, or tattoo-safety advice.
- Establish a concise original visual system before coding: conceptual rule, geometry or particle behavior, seed behavior, tunable parameters, palette, composition constraints, and performance budget.
- Keep art code separate from UI controls even in a single-file artifact. Validate numeric input bounds and avoid inserting untrusted text as HTML.
- Provide a visible seed and a compact set of meaningful controls. Avoid generating large variation grids synchronously.
- Include pause/resume when animated, pause automatically when the document is hidden, debounce expensive control updates, and prefer `noLoop()` for static work.
- Explain output files, external dependencies, license notices, mobile budget, and any unverified behavior.

## Completion criteria

- The artwork is original and does not carry third-party branding.
- The selected mode's boundary is respected.
- Dependencies and licenses are disclosed.
- Mobile and cleanup behavior are addressed.
- No production INKFLOW file was changed without explicit authorization.
