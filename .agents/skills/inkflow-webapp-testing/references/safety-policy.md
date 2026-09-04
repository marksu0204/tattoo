# INKFLOW Playwright safety policy

Read this reference before writing or executing tests.

## Preflight

- Confirm the application is INKFLOW and the target is a local development or disposable test environment.
- Parse the target URL and require its hostname to equal `localhost`, `127.0.0.1`, or `::1`. Reject credentials in URLs and reject hostname suffix tricks such as `localhost.example.com`.
- Inspect configuration by filename allowlist. Exclude `.env`, `.env.*`, browser profiles, authentication-state files, credential stores, production dumps, and user exports.
- Determine whether a scenario is read-only. Treat form submission, uploads, account changes, API writes, email triggers, order creation, payment actions, and deletes as mutations requiring explicit approval.
- Confirm the backend is local, mocked, disposable, or separately approved. A loopback frontend does not prove its API or database is local.

## Network containment

- Start with all browser requests restricted to the approved loopback origin and required loopback development endpoints.
- Block and report unexpected HTTP(S), WebSocket, beacon, service-worker, font, analytics, telemetry, and API destinations.
- Do not weaken TLS, proxy traffic externally, expose the local server on a public interface, or use tunnels.
- Vite must bind to loopback, not `0.0.0.0`, unless the user explicitly authorizes a different interface for a stated reason.

### Temporary external-resource exceptions

1. Block every unapproved non-loopback hostname by default.
2. Report the exact hostname, protocol, resource purpose, and the page or action that triggered the request.
3. Do not include sensitive query strings, headers, cookies, tokens, credentials, or authorization information in the report.
4. Ask whether the user approves a one-time temporary exception only when the resource is necessary to complete the local test.
5. Scope any approval to the current test, exact hostname, necessary protocol, and necessary request method.
6. Never create wildcard exceptions, parent-domain exceptions, or permanent allowlists.
7. Keep the request blocked when explicit approval has not been obtained, the user refuses, or the user does not respond.
8. Never allow production APIs, live databases, payment endpoints, real-order endpoints, outbound email, or any other external side-effect endpoint through an exception.
9. Expire the exception immediately after the current test finishes.
10. Never send cookies, credentials, authorization information, tokens, or user data to an approved external resource.

## Data and artifact handling

- Never inspect or print cookies, authorization headers, password fields, token-bearing URLs, `.env*`, local/session storage, or raw request bodies unless a separate security task explicitly authorizes narrowly scoped handling.
- Do not use real personal details. Use obvious synthetic data only after mutation approval.
- Keep console/DOM dumps off by default. Prefer targeted assertions over `page.content()` or broad logging.
- Keep screenshots, videos, traces, and HTML reports off unless diagnostically necessary. State what will be captured before enabling them.
- Do not upload artifacts. Retain only the minimum local output and tell the user where it is stored.

## TypeScript Playwright shape

- Use the project's existing `playwright.config.ts` and `@playwright/test` version.
- Configure a loopback `baseURL` and a fixed `webServer.command` that references an existing package script.
- Prefer accessibility locators and web-first assertions. Avoid arbitrary sleeps; use a bounded timeout only when the UI has no observable state.
- Keep tests independent and use a fresh non-persistent context. Do not reuse a signed-in personal profile or committed `storageState`.
- For React 19 and Vite, assert stable user-visible behavior rather than implementation details, hydration timing, or `networkidle`.

## Cleanup

- Close test-owned pages, contexts, and browser instances in `finally` or Playwright fixtures.
- Let Playwright stop the `webServer` it started. Check the configured local port and known test-owned process IDs afterward.
- Do not terminate a process based only on its executable name or port. If ownership is uncertain, report it and stop.
- Do not delete artifacts, databases, caches, or test data unless the user authorized that specific cleanup.
