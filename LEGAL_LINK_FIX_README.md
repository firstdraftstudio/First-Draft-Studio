# Legal page link fix

The footer links use relative paths to the separate HTML files. The Vite build explicitly includes all five legal pages, and Cloudflare static assets no longer rewrite missing paths to the homepage.

After replacing the repository files and redeploying, test these URLs directly:
- `/privacy.html`
- `/terms.html`
- `/refunds.html`
- `/service-delivery.html`
- `/contact-grievance.html`

A fresh Cloudflare deployment is required for the changes to appear on the live site.
