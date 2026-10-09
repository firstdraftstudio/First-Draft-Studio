# First Draft Studio Client Platform

This build layers Supabase Auth + database workflows onto the existing First Draft Studio Vite site.

## Environment

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://obhcwyatejwpplzbvkdd.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Do not commit `.env.local`.

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Routes

Public marketing site: `/`

Customer:
- `/account`
- `/account/inquiries`
- `/account/inquiries/:id`
- `/account/projects`
- `/account/projects/:id`
- `/account/new-inquiry`

Admin:
- `/admin`
- `/admin/customers`
- `/admin/inquiries`
- `/admin/inquiries/:id`
- `/admin/projects`
- `/admin/projects/:id`

## Expected database fields

The frontend expects the existing tables to expose the fields described in the First Draft Studio platform specification. In particular:

- `profiles`: `id`, `email`, `full_name`, `phone`, `business_name`, `created_at`
- `inquiries`: `id`, `user_id`, `full_name`, `business_name`, `phone`, `email`, `business_type`, `business_description`, `website_goals`, `requirements`, `package`, `online_ordering`, `status`, `created_at`, `updated_at`
- `inquiry_messages`: `id`, `inquiry_id`, `sender_id`, `sender_role`, `message`, `created_at`
- `internal_notes`: `id`, `inquiry_id`, `admin_id`, `note`, `created_at`
- `projects`: `id`, `user_id`, `inquiry_id`, `name` or `project_name`, `agreed_price`, `status`, `start_date`, `completion_date`, `customer_updates`, `created_at`, `updated_at`
- `admin_users`: `user_id`, `role`

If your already-created tables use different column names, update the small payload/select mappings in `backend.js` rather than changing the public design.

## Security

The client checks `admin_users` before rendering the admin UI, but **Supabase RLS remains the real security boundary**. Keep customer rows restricted to the authenticated customer's user ID and keep `internal_notes` admin-only.

## Public inquiry behavior

Logged-out visitors continue using the existing public inquiry experience. Logged-in customers have their inquiry written directly to `inquiries` and are redirected into their client portal.
