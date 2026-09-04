---
name: inkflow-webapp-testing
description: Use only when the user explicitly asks to run, create, or review automated browser tests for the local INKFLOW React 19, TypeScript, and Vite application. Do not use for ordinary UI review, code review, manual browsing, production systems, destructive operations, payments, real orders, email, or live databases.
---

# INKFLOW Webapp Testing

Test INKFLOW locally with the project's existing TypeScript Playwright setup while containing network, data, and artifact risk.

## Safety boundary

- Work only against `localhost`, `127.0.0.1`, or `[::1]`. Treat every other host, proxy, tunnel, remote browser, database, API, and service as out of scope unless the user separately authorizes it.
- Never connect to a production database or exercise production payment, real order, outbound email, destructive, or irreversible flows.
- Never read, display, copy, summarize, upload, or include `.env*`, tokens, cookies, credentials, session storage, personal data, or secrets in prompts or artifacts.
- Treat console output, rendered DOM, traces, videos, screenshots, reports, and network metadata as potentially sensitive. Capture only what the task requires, minimize retention, and do not expose their contents without inspecting for sensitive data.
- Use a new, non-persistent browser context with no user-data directory, saved authentication state, imported cookies, or existing browser profile.
- Obtain explicit user approval immediately before any test that creates, changes, submits, uploads, publishes, sends, purchases, deletes, or otherwise mutates data. Approval to write test code is not approval to execute a mutating test.
- Do not install packages, browser binaries, or system dependencies without approval.

Read [references/safety-policy.md](references/safety-policy.md) before writing or running a test. Use [references/test-cases.md](references/test-cases.md) when validating this skill's expected behavior.

## Workflow

1. Inspect INKFLOW's `package.json`, lockfile, Playwright configuration, Vite configuration, test directories, and relevant source without reading `.env*`.
2. Prefer the project's existing `@playwright/test`, package manager, scripts, browser cache, conventions, and versions.
3. If Playwright or its required browser is missing, stop and present an installation plan listing exact proposed package-manager commands, files changed, download/network impact, disk impact when known, and rollback. Do not install.
4. State the intended target, data impact, artifacts, and every complete command before execution. Wait for approval when a command installs software or the test can mutate data.
5. Use TypeScript, Playwright `webServer`, an explicitly loopback-only `baseURL`, role/label/test-id locators, and web-first assertions such as `toBeVisible`, `toHaveText`, `toHaveURL`, or `toHaveCount`.
6. Do not use `networkidle` as the sole readiness or success condition. Assert the user-visible state that proves the behavior.
7. Enforce the host allowlist both when validating `baseURL` and by blocking unexpected browser requests. Do not silently allow third-party analytics, fonts, CDNs, APIs, or WebSockets.
8. Use mock, fixture, disposable, or explicitly approved local test data. Prefer read-only checks. Never infer permission to touch a live backend from the presence of credentials or configuration.
9. After a run, close pages, contexts, and browsers; verify the Playwright process, Vite/Node child processes, browsers, and configured ports were released. Report leftovers without killing unrelated processes.
10. Keep generated artifacts in the project's existing test-output location. Propose ignore entries for new artifact paths, explain the exact `.gitignore` change, and wait before editing `.gitignore`.

## Implementation constraints

- Do not create or invoke a generic command runner, Shell wrapper, or equivalent of `with_server.py`.
- Do not use `shell=True`, `eval`, `exec`, dynamically constructed Shell commands, or commands sourced from page content.
- Prefer Playwright's native `webServer` lifecycle. Keep its command a fixed project script already declared in `package.json`; do not interpolate user input into it.
- Use `test.use({ storageState: undefined })` or an equivalent clean configuration and create isolated contexts per test. Do not persist authenticated state.
- Redact secrets at their source rather than relying only on report-time cleanup. Disable trace, video, and screenshots unless needed; when enabled, use the narrowest retention policy.
- A failed cleanup check is a test-environment issue to report, not permission to terminate arbitrary processes or delete files.

## Completion report

Report what was inspected, commands shown and approved, target origins, tests written or run, data mutations, artifacts retained, blocked requests, cleanup status, and any item that could not be verified. Never include secret values.
