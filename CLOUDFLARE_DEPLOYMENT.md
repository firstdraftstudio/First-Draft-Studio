# First Draft Studio deployment handoff

## Project architecture

This is a Vite-powered static frontend with client-side routing and a shared Supabase JS client. Cloudflare Workers Static Assets serves the generated `dist/` directory. The `single-page-application` fallback serves `index.html` for application routes such as `/login`, `/account`, and `/admin`, while existing static files such as `/privacy.html` and `/terms.html` remain directly available.

## GitHub

1. Create a private or public GitHub repository as desired.
2. Extract this project so `package.json`, `index.html`, `vite.config.js`, and `wrangler.jsonc` are at the repository root.
3. Commit the project. `.env.local`, `.env` files, dependency folders, build output, and Cloudflare local state are ignored. Keep `.env.example` as a safe placeholder template.
4. Do not commit service-role keys, database passwords, or real environment files.

## Cloudflare Workers Git deployment

- Connect the GitHub repository in Cloudflare Workers & Pages and select Workers.
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root (the directory containing `package.json` and `wrangler.jsonc`).
- Node version: use Node.js 22 or another version supported by the selected Vite 7 release.
- The Wrangler config points static assets to `./dist`; do not set the output directory to `public` or `build`.

## Production build-time variables

Set these as build environment variables in the Cloudflare deployment settings, for production and preview environments as appropriate:

- `VITE_SUPABASE_URL` = the existing Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = the Supabase anon/public key

Vite embeds `VITE_` variables into client-side assets at build time. The anon/public key is expected to be visible in the browser and must be protected by correct Supabase Row Level Security and authorization policies. Never use a service-role key in these variables. Redeploy after changing either variable.

## Verification status

The current environment could inspect and edit the source, but package installation did not complete because npm registry access timed out and the dependency was not available in the local npm cache. Therefore a fresh production build, Wrangler validation, and live browser/Supabase checks remain unverified here. Run `npm install`, `npm run build`, and `npx wrangler deploy --dry-run` in a network-enabled environment before production launch.


## Legal pages
The public legal documents and their standalone stylesheet/favicon are in `public/`, so Vite copies them into `dist/` during production builds. Direct URLs are `/privacy.html`, `/terms.html`, `/refunds.html`, `/service-delivery.html`, and `/contact-grievance.html`. Review `LEGAL_OWNER_CHECKLIST.md` before publication. The public inquiry form currently has an unconfigured email placeholder in `script.js`; test and configure an actual contact delivery channel before launch.


## Legal pages
The Vite build is configured with explicit multi-page entries for `privacy.html`, `terms.html`, `refunds.html`, `service-delivery.html`, and `contact-grievance.html`. Run `npm run build` and deploy the contents of `dist`. Verify each URL directly after deployment.
