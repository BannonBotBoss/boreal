# T-0177

Main `669a5a88`, dev server.

| request | before | after |
|---|---|---|
| `/favicon.ico` | 404 | 200 `image/x-icon` (101 bytes) |
| `/favicon.svg` | 200 `text/html` (the page fallback) | 200 `image/svg+xml` |

The ground-view console on main logged `Failed to load resource: 404`. Nothing in the 3D picture changes. The check is `tests/favicon.test.ts`.
