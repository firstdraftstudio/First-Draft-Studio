# Owner confirmation required before legal pages go live

These are draft policies, not a legal compliance certification. Confirm the following before launch:

1. **Legal identity:** full legal name of the person/entity operating First Draft Studio and whether the brand is a sole proprietorship, partnership, company, or another form. Do not publish a guessed registration number.
2. **Contact and grievance:** a monitored email address, optional phone/WhatsApp, postal address if required, named grievance contact/role, and an owner-approved response timeline. The current public inquiry form still has `YOUR_EMAIL_HERE` in `script.js`; its delivery is not configured/verified.
3. **Payments:** accepted payment methods, advance/milestone schedule, due dates, tax treatment if applicable, and any late-payment process.
4. **Refunds/cancellations:** owner-approved approach for each project stage, whether any documented costs can be deducted, and a practical acknowledgement/refund processing target. Do not introduce blanket non-refundable wording without review.
5. **Domain and hosting:** whether any package includes a domain or hosting, duration, provider/account owner, renewals, recurring fees, and who controls DNS and credentials.
6. **Ownership and handover:** when source code/design ownership transfers, third-party licences, repository/admin access, and what handover documentation is included.
7. **Project scope:** included revision rounds, what counts as a scope change, estimated timeline language, maintenance/support availability and post-launch responsibilities.
8. **Privacy/data practice:** confirm what data the current app actually stores, configured Supabase RLS/admin controls, retention practice, any analytics/cookies, and a deletion request workflow.
9. **India-specific legal review:** have a qualified professional review applicability of the Digital Personal Data Protection Act, 2023 and rules/commencement in force, Information Technology Act/rules, Consumer Protection Act and e-commerce rules if applicable, and other requirements relevant to the business model. Do not claim certified compliance without review.

## Technical limitation discovered
The public inquiry form's frontend handler currently uses an unconfigured email placeholder and does not persist the form to Supabase. The account inquiry feature exists separately. Configure and test a genuine public inquiry delivery channel before representing the public form as a working grievance contact route.
