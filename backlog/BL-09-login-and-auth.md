# BL-09 · Login and End-to-End Authentication (across 4 repos)

Unauthenticated users cannot access any market data or analysis; user activity is recorded after login.

| Work item | Repo | Depends on | Scope |
|---|---|---|---|
| BL-09-1 | user | none | Confirm the contract: JWT `iss=qoder-terminal-user`, `aud=qoder-terminal`, `sub` = user ID; add login rate limiting (5 attempts per minute per username) |
| BL-09-2 | data | BL-09-1 | Middleware: fetch and cache public keys from `USER_JWKS_URL`, verify signature / iss / aud / exp; everything except `/health` returns 401 without a valid token |
| BL-09-3 | analyst | BL-09-1 | Same as above (FastAPI dependency injection); forward the user token when calling data |
| BL-09-4 | web | BL-09-1 | Login page; token kept in memory + sessionStorage; all requests send `Authorization`; 401 returns to the login page |
| BL-09-5 | web | BL-09-4 | Report `/v1/activities` when running commands, asking, and opening panels; new function code `HIST` shows your own history |
| BL-09-6 | web | BL-09-2, BL-09-3, BL-09-5 | e2e: run existing cases after logging in with a test account; unauthenticated calls to data / analyst return 401 |

BL-09-2 / 3 / 4 run **in parallel** across the Go, Python, and TypeScript repos.
Test account credentials come from the credential reference in the AutoWonder `FRONTEND_TEST_URL` configuration and are never committed.
