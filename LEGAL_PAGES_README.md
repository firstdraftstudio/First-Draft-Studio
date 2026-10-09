# Legal pages included in the build

These are real standalone HTML pages at the project root and are explicit Vite build entries. They are not homepage sections or hash links.

- `/privacy.html`
- `/terms.html`
- `/refunds.html`
- `/service-delivery.html`
- `/contact-grievance.html`

## Apply the fix
1. Replace the old project files in your GitHub repository with the contents of this project.
2. Commit and push the changes so Cloudflare Pages/Workers runs a fresh deployment.
3. Build command: `npm run build`; output directory: `dist`.
4. After deployment, test each URL above directly, then click the footer links.

The Vite configuration explicitly builds every page into `dist`, so the links no longer depend on Vite's `public/` file-copy behavior or a SPA fallback.

Before publishing, complete the owner checklist with real contact details and have the legal text reviewed for your actual business and practices.
