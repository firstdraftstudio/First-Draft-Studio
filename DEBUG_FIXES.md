# First Draft Studio client-platform debug fixes

## Root causes found

1. `backend.js` existed but was never imported by `script.js`, so the route dispatcher, Supabase client, auth state, and admin checks never ran.
2. The public Login button was wired to the old modal instead of navigating to `/login`.
3. Portal logout was bound before the dynamically-rendered portal shell existed.
4. Account/admin routes were not protected centrally because the backend router was inactive.

## Fixes

- `script.js` now imports `backend.js`.
- Added real `/login`, `/signup`, and `/forgot-password` routes.
- Login, signup, reset-password flows use Supabase Auth.
- Successful login redirects to `/account`.
- `/account/*` routes require an authenticated session.
- `/admin/*` routes check the authenticated user against `public.admin_users` before rendering admin UI.
- Unauthorized authenticated users are sent to an access-restricted state with a link to `/account`.
- Unauthenticated admin visitors are given a login route.
- Added delegated logout handling for dynamically-rendered portal shells.
- Preserved the existing public marketing website and design.

## Verification

- `node --check script.js` passes.
- `node --check backend.js` passes.
- Full `npm install` / Vite production build could not be completed in this environment because npm registry access timed out and offline cache did not contain `@supabase/supabase-js`.
- The project remains configured for the existing Supabase project through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.


ROUTE-LEVEL RENDERING FIX

The public homepage was previously static markup outside the route root. Authenticated and portal renderers wrote into #app-root, leaving the public homepage mounted underneath them.

Fixed by moving the complete public homepage into an inert #public-home-template and making #app-root the only live route container. The / route clones the template into #app-root with replaceChildren(). Auth, customer, and admin routes continue to replace #app-root with their own page view.

script.js public interactions are initialized only after the public route is rendered via the fds:route-rendered event, with cleanup of old DOM listeners/observers before a new public view is initialized. This prevents old homepage handlers from surviving route transitions.

Verified with node syntax checks for script.js and backend.js. A headless Chromium verification was attempted in the environment, but Chromium could not complete the local module-loading run reliably, so no false browser-pass claim is made. The source-level architecture now has exactly one active route root.


## ASYNC RENDERING RUNTIME FIX

### Root cause: `[object Promise]`
- `adminShell()` was incorrectly declared `async` even though it only returned an HTML string.
- One protected admin gate path assigned `adminShell(...)` directly to `root.innerHTML`, so the DOM coerced the unresolved Promise to the literal string `[object Promise]`.
- `adminShell()` is now synchronous because it does not perform asynchronous work. The admin gate is synchronous as well.
- The route dispatcher explicitly awaits every asynchronous page renderer before returning.

### Root cause: blank `/account`
- `renderAccount()` awaited the Supabase queries, but assumed `data` would always be an array. Supabase can return `data: null` when a query fails. The renderer then attempted `inquiries[0]` / array operations on `null`, causing an uncaught render exception before the application root was populated.
- The renderer now records query errors to the console and normalizes both query results to arrays before rendering.
- The route dispatcher now catches render failures and logs the exact route/error rather than leaving the application root silently blank.

### Bootstrap fix
- Startup previously called `refresh()` without awaiting its Promise.
- Startup now runs through an async `bootstrap()` function that wires events and awaits the initial `refresh()`.

### Verification
- `node --check backend.js` passed.
- `node --check script.js` passed.
- A runtime route harness executed `/login`, `/signup`, `/forgot-password`, `/account`, `/account/inquiries`, `/account/inquiries/:id`, `/account/projects`, `/account/projects/:id`, `/account/new-inquiry`, `/admin`, `/admin/customers`, `/admin/inquiries`, `/admin/inquiries/:id`, `/admin/projects`, and `/admin/projects/:id` with authenticated customer/admin states. Every renderer populated the application root and no `[object Promise]` appeared.
- A real Chromium headless run was attempted against the local HTTP server, but the provided Chromium environment hung/crashed before returning DOM output. Because of that environment failure, no false browser-pass claim is being made.


## FINAL CODEBASE AUDIT / COHERENT ARCHITECTURE

### Supabase configuration
- There is exactly one `createClient()` call in `backend.js`.
- All auth, profile, inquiry, project, message, note, and admin queries use that same client.
- The previous `.env.local` JWT was malformed for the configured project: its payload had an incorrect `iss` value. It has been restored to the Supabase anon/public key previously supplied for project `obhcwyatejwpplzbvkdd`.
- Startup now validates URL, JWT shape, project `ref`, and `role: "anon"`. Configuration failures render an explicit configuration error instead of masquerading as an auth failure.
- No service-role key is used in the frontend.

### Shared authentication
- Added one shared auth flow: `getCurrentSession`, `getCurrentUser`, `syncAuthState`, `requireAuth`, `requireAdmin`, `signIn`, `signUp`, and `signOut`.
- Supabase session state is the source of truth.
- The auth-state listener is registered once.
- Login routes to `/account` for customers and `/admin` for authorized admins. Logout routes to `/`.

### Router
- `route()` is the single route dispatcher.
- `navigate()` is the centralized internal navigation path.
- Account/admin/auth/public route transitions replace the single `#app-root` view.
- Browser `popstate` is handled by the same dispatcher.
- Protected-route redirects are handled by `route()` itself rather than recursively calling `navigate()`, preventing navigation-chain deadlocks.
- Public section routes `/pricing`, `/work`, `/process`, `/about`, `/faq`, and `/contact` render the public homepage view and scroll to their section.

### Async rendering
- `adminShell()` is synchronous because it only builds HTML.
- Async data renderers are awaited by the router.
- No async renderer return value is assigned directly to `innerHTML`, `outerHTML`, or `textContent`.
- Recursive fallback render calls that were previously fire-and-forget are awaited.
- Startup awaits the initial auth refresh.
- The router catches render exceptions and reports them instead of silently leaving a blank root.

### Customer portal
- `/account` safely normalizes failed/null Supabase result data to empty arrays.
- Account navigation uses delegated document-level navigation, so route replacement does not destroy navigation behavior.
- `/account/inquiries`, inquiry details, `/account/projects`, project details, and `/account/new-inquiry` are routed through the same dispatcher.
- New inquiries and customer messages use the shared Supabase client.

### Admin portal
- Existing `admin_users` UUID authorization remains intact.
- Dashboard, customers, inquiries, inquiry detail, projects, and project detail all render through the same root and client.
- Internal notes remain in the admin inquiry view only.

## Verification

### Static/source verification
- `node --check backend.js` passed.
- `node --check script.js` passed.
- Exactly one `createClient()` occurrence exists in application source.
- No duplicate JWT-looking key exists in application source outside `.env.local`.
- Automated scan found no async renderer directly assigned to an application `innerHTML`/`outerHTML`/`textContent` target.

### Runtime renderer harness
A Node runtime harness using the real patched router/render functions with a deterministic Supabase test double exercised:
- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/account`
- `/account/inquiries`
- `/account/inquiries/:id`
- `/account/projects`
- `/account/projects/:id`
- `/account/new-inquiry`
- `/admin`
- `/admin/customers`
- `/admin/inquiries`
- `/admin/inquiries/:id`
- `/admin/projects`
- `/admin/projects/:id`

All 16 routes populated the application root and none produced `[object Promise]` or a blank root. Separate auth-state tests verified customer rendering, admin rendering, and logout returning to `/`.

### Production build / real browser limitation
- `npm install` could not complete because this execution environment cannot resolve external package registries/DNS. The existing environment did not contain a Vite binary/cache sufficient to run `npm run build`.
- A real Chromium/Playwright navigation to localhost and file URLs is blocked by this execution environment with `ERR_BLOCKED_BY_ADMINISTRATOR`.
- Therefore a real production Vite browser session and live Supabase credential test could not be honestly marked as passed here. The runtime harness above is an execution test of the actual patched route/render functions, but it is not a substitute for the user's local browser + live Supabase environment.
