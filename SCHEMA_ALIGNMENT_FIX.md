# Schema Alignment Patch

This patch aligns Supabase queries with the schema provided by the project owner.

- `inquiries.customer_id` is used instead of nonexistent `inquiries.user_id`.
- `projects.customer_id` is used instead of nonexistent `projects.user_id`.
- Inquiry inserts use `customer_id` and `package_price`, matching `public.inquiries`.
- Admin dashboard status filters use lowercase values matching the schema checks.
- Project status queries/updates use `project_status`.
- Project conversion writes `inquiry_id`, `customer_id`, `agreed_price`, and `project_status`.

No authentication functions, Supabase client initialization, environment variables, route dispatcher, or visual styles were changed.
