# React Assignment #12 — Protected routes and session handling

## Objective

Build a React library client with login, protected routes, role-based menus, in-memory access tokens, and a rotating refresh token held in an HttpOnly cookie. Demonstrate a localStorage-based “before” implementation beside the safer “after” implementation.

## Tools

React 18, Vite, React Router 6, Axios interceptors, Express, SQLite (`better-sqlite3`), bcryptjs, JSON Web Tokens, Zod, Swagger UI, and cookie-parser.

## Steps performed

1. Scaffolded `library-app/server` and `library-app/client` because the supplied workspace had no pre-existing application files to extend.
2. Added the users and refresh-token tables, bcrypt-seeded demo accounts, sample books, auth endpoints, rotating SHA-256-hashed refresh tokens, JWT authentication, role authorization, CORS, and Swagger documentation.
3. Added the Vite React client, in-memory AuthContext, Axios bearer/refresh/retry handling, React Router guards, role menus, library data views, session countdown panel, and a separate localStorage “before” demo.
4. Used a configurable one-minute access-token default. The client schedules refresh twenty seconds before expiry and restores its session by trying `/v1/auth/refresh` once on load.

## Results

The implementation is present in this workspace. The login endpoint returns a short-lived access token and sets a rotating refresh cookie; logout revokes the current refresh token. API authentication returns 401 for missing/invalid/expired tokens, and role mismatches return 403. The application includes a role-specific admin, librarian, or member menu and protected data endpoints.

The application was installed and run; results and screenshots are in the Evidence section. The original project was not present in the workspace, so the library resources were scaffolded as a demonstration API.

## Observations

The browser's JavaScript can read a token saved in localStorage; the `/before` page writes a demo token and logs it to the Console. JavaScript cannot read an HttpOnly refresh cookie, but the browser attaches it to same-origin/cross-origin requests when credentials are enabled and cookie policy permits. The after demo keeps the access token only in application memory, so a page reload loses it and the client uses the refresh cookie to restore a session.

For local HTTP development the cookie's `Secure` attribute is disabled (`NODE_ENV` is not `production`), because browsers will not send a Secure cookie over ordinary `http://localhost`. Deploy behind HTTPS with `NODE_ENV=production`; then Secure is enabled. SameSite is Strict and cookie path is `/v1/auth` in both modes.

## Before versus after security comparison

| Concern | Before: localStorage access token | After: memory access token + HttpOnly refresh cookie |
|---|---|---|
| JavaScript access to credential | Any same-origin script can read it; an XSS can exfiltrate it. | Access token is not persisted; JavaScript cannot read the HttpOnly refresh cookie. An active XSS can still act as the user while the app is running. |
| Reload behavior | Token remains available after reload. | Memory token disappears; the app silently restores it using the refresh cookie. |
| Server-side revocation | A copied access token remains valid until expiry. | Hashed refresh token can be revoked; short-lived access token remains valid until its own expiry. |
| Cross-site request concern | Bearer token normally must be explicitly attached by script. | Cookie requests need CSRF defenses; this demo uses SameSite=Strict, a narrow cookie path, and exact-origin credentialed CORS. |
| Demo role | Intentionally insecure teaching example. | Preferred session pattern demonstrated by this assignment. |

## Industry lesson

Storing tokens in localStorage is a common audit finding; memory + httpOnly cookie is the usual fix. The cookie reduces credential exposure to JavaScript, but it does not remove XSS risk or the need for HTTPS, careful CORS, CSRF controls, short token lifetimes, and server-side revocation.

## Conclusion

The assignment demonstrates protected navigation, role authorization, refresh-token rotation, silent refresh, refresh failure logout, and the security distinction between browser-readable persistent storage and an HttpOnly cookie. Evidence from a live run is in the Evidence section.

## GitHub

Repository: https://github.com/<username>/<repository>

## Evidence plan and figure captions

Capture screenshots after starting both processes. Keep the address bar and relevant DevTools panel visible; redact any live bearer token if sharing screenshots publicly.

1. **Figure 1 — Before: access token exposed in localStorage.** `/before` page after demo login with DevTools Console showing the printed token and Application → Local Storage showing `demoAccessToken`.
2. **Figure 2 — After: authenticated session and role menu.** Secure `/books` page with a signed-in account, its permitted navigation links, and the on-screen access-token countdown.
3. **Figure 3 — Refresh token cookie protections.** DevTools Application → Cookies showing `refreshToken`, HttpOnly, SameSite=Strict, and `/v1/auth` path. In localhost development Secure is intentionally unchecked; explain that HTTPS deployment sets it.
4. **Figure 4 — Silent refresh.** Network panel around the countdown reaching about 20 seconds: a successful `POST /v1/auth/refresh`, rotated cookie, and the countdown reset without navigating to login.
5. **Figure 5 — Forced logout after refresh failure.** After refresh-token revocation/deletion, show failed `POST /v1/auth/refresh` followed by redirect to `/login` and cleared session UI.
6. **Figure 6 — Role-specific menus.** Capture the admin, librarian, and member navigation separately using the three seeded accounts.
7. **Figure 7 — Forbidden route.** Sign in as member and navigate directly to `/members` or `/manage-books`; show the 403 page. The server returns 403 for a forbidden API role, while the client RoleRoute also blocks the page.

## Demo procedure

1. Start server and client using the setup commands in the submission response. Open `http://localhost:5173`.
2. Open `/before`, sign in with any demo user, and inspect Console and Application → Local Storage. Clear this demo token with the page's button before moving on.
3. Open `/login`. Sign in as member: `member@library.test` / `MemberPass123!`. Confirm Books and My loans appear, and Members/Loans do not. Open `/members` directly to show 403.
4. Sign out and repeat with librarian: `librarian@library.test` / `LibrarianPass123!`. Confirm Books and Loans appear but Manage books/Members do not.
5. Sign out and repeat with admin: `admin@library.test` / `AdminPass123!`. Confirm Books, Members, and Manage books. Use the Members page to verify the seeded member record.
6. For silent refresh, sign in and watch the debug countdown. Keep Network open; around 20 seconds before token expiry, the client calls `/v1/auth/refresh`, retries transparently if an API request encounters 401, and starts a new countdown.
7. To force logout, sign in, then in DevTools Application → Cookies delete `refreshToken` before the scheduled refresh. Wait until the access token expires (or set `ACCESS_TOKEN_TTL=25s` and restart). At refresh time the refresh request fails; the app clears its in-memory session and redirects to `/login`. Alternatively revoke the current refresh token directly in SQLite with `UPDATE refresh_tokens SET revoked=1 WHERE revoked=0;`.

## Flow diagram

```mermaid
sequenceDiagram
    actor User
    participant React as React/AuthContext
    participant API as Express API
    participant DB as SQLite
    User->>React: Submit email and password
    React->>API: POST /v1/auth/login
    API->>DB: Verify bcrypt password
    API->>DB: Store SHA-256 hash of refresh token
    API-->>React: Access JWT + expiry
    API-->>User: Set HttpOnly SameSite=Strict refresh cookie
    React->>API: Protected request with Bearer access token
    API-->>React: Protected data
    Note over React: Keep access token in memory; schedule refresh 20 s before exp
    React->>API: POST /v1/auth/refresh with cookie
    API->>DB: Validate old hash, revoke old token, store new hash
    API-->>React: New access JWT; set rotated refresh cookie
    Note over React,API: If refresh cookie is missing, expired, or revoked
    API-->>React: 401 REFRESH_FAILED
    React->>API: POST /v1/auth/logout (best effort)
    React-->>User: Clear memory/timer and redirect to /login
```

## Evidence (captured from the running application)

Run on Windows 11, Node 22.19, Edge (automated via Playwright against `http://localhost:5173` and API on `:4000`). Screenshots show the application UI; the DevTools-style facts (cookie flags, localStorage contents, refresh requests) were read programmatically and are recorded in [evidence/run-log.txt](evidence/run-log.txt). Tokens shown are short-lived demo tokens.

| Figure | File | What it shows |
|---|---|---|
| 1 | [01-before-localstorage.png](evidence/01-before-localstorage.png) | `/before`: access token stored under `localStorage.demoAccessToken` and printed to the Console (`INSECURE DEMO access token: eyJ…`). |
| 2 | [04-menu-member.png](evidence/04-menu-member.png) | Secure session with in-memory token and live countdown panel. `localStorage` is empty and `document.cookie` is `""`. |
| 3 | run-log.txt | Cookie `refreshToken`: HttpOnly=true, SameSite=Strict, Path=`/v1/auth`, Secure off on localhost HTTP. |
| 4 | [06](evidence/06-countdown-before-refresh.png), [07](evidence/07-silent-refresh-reset.png) | Countdown 61 s → `POST /v1/auth/refresh` returned 200 about 40 s after login → countdown reset to 59 s, no redirect. |
| 5 | [08-forced-logout-login.png](evidence/08-forced-logout-login.png) | After deleting the `refreshToken` cookie, the next scheduled refresh returned 401 and the app redirected to `/login`. |
| 6 | [02 admin](evidence/02-menu-admin.png), [03 librarian](evidence/03-menu-librarian.png), [04 member](evidence/04-menu-member.png) | Menus — admin: Books, Members, Manage books; librarian: Books, Loans; member: Books, My loans. |
| 7 | [05-member-403.png](evidence/05-member-403.png) | Member opening `/members` is redirected to the 403 page. API check: `GET /v1/members` with a member token returns 403. |

## Verification summary

- `npm install`, `npm run seed`, and `vite build` succeed; both servers start.
- Login, refresh rotation (old token revoked), role checks (403), silent refresh, and forced logout were all exercised end to end.
- Caveat: screenshots were produced by an automated browser, so the DevTools panels themselves are not pictured. If your instructor requires literal DevTools screenshots, repeat steps 4–8 manually; the app is already running-ready.
